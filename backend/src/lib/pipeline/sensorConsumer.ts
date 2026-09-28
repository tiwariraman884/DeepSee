/**
 * Sensor Consumer — subscribes to EventBus sensor readings, runs ML inference,
 * persists to SQLite, and broadcasts via SSE.
 *
 * Extracted from the monolithic sensorPipeline.ts for testability and clarity.
 */
import { eventBus, TOPICS, SensorReadingEvent, AnomalyEvent } from "../eventBus";
import { mlWorker } from "../mlWorker";
import { sseManager } from "../sseManager";
import { getDb } from "../../db";

export interface SensorConsumerOptions {
  onAnomaly?: (event: AnomalyEvent) => void;
}

export class SensorConsumer {
  private unsubscribe: (() => void) | null = null;

  start(options: SensorConsumerOptions = {}): void {
    this.unsubscribe = eventBus.subscribe<SensorReadingEvent>(
      TOPICS.SENSOR_READING,
      async (reading) => {
        const t0 = Date.now();
        try {
          const mlResult = await mlWorker.predict({
            temperature: reading.temperature ?? 3.5,
            ph: reading.ph ?? 8.1,
            salinity: reading.salinity ?? 34.5,
            oxygen: reading.oxygen ?? 5.0,
            turbidity: reading.turbidity ?? 0.5,
          });

          const totalMs = Date.now() - t0;

          // Persist to SQLite
          this.persistReading(reading);

          // Broadcast sensor update
          sseManager.broadcast("sensor_update", {
            sensorId: reading.sensorId,
            sensorName: reading.sensorName,
            reading,
            isAnomaly: mlResult.isAnomaly,
            mlScore: mlResult.score,
            latency_ms: totalMs,
            ts: reading.timestamp,
          });

          // Handle anomaly
          if (mlResult.isAnomaly) {
            const anomalyEvent: AnomalyEvent = {
              sensorId: reading.sensorId,
              sensorName: reading.sensorName,
              isAnomaly: true,
              score: mlResult.score,
              latency_ms: mlResult.latency_ms,
              reading,
              timestamp: reading.timestamp,
            };

            eventBus.publish<AnomalyEvent>(TOPICS.ML_ANOMALY, anomalyEvent);
            this.persistAlert(reading, mlResult);
            this.broadcastAnomaly(reading, mlResult);

            options.onAnomaly?.(anomalyEvent);

            console.log(
              `[Pipeline] ANOMALY on ${reading.sensorName} — score=${mlResult.score.toFixed(3)}, total=${totalMs}ms`
            );
          }
        } catch (err: any) {
          console.error("[Pipeline] Worker error:", err.message);
        }
      }
    );

    console.log("[Pipeline] Sensor consumer started");
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  private persistReading(reading: SensorReadingEvent): void {
    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO sensor_readings (sensor_id, ph, temp, salinity, oxygen, turbidity, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        reading.sensorId,
        reading.ph ?? null,
        reading.temperature ?? null,
        reading.salinity ?? null,
        reading.oxygen ?? null,
        reading.turbidity ?? null,
        reading.timestamp
      );

      db.prepare(
        `UPDATE sensors SET last_reading_json = ?, updated_at = ? WHERE id = ?`
      ).run(
        JSON.stringify({
          ph: reading.ph,
          temp: reading.temperature,
          salinity: reading.salinity,
          oxygen: reading.oxygen,
          turbidity: reading.turbidity,
        }),
        reading.timestamp,
        reading.sensorId
      );
    } catch (dbErr: any) {
      if (!dbErr.message?.includes("FOREIGN KEY")) {
        console.error("[Pipeline] DB error:", dbErr.message);
      }
    }
  }

  private persistAlert(reading: SensorReadingEvent, mlResult: { score: number }): void {
    const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    try {
      const db = getDb();
      db.prepare(
        `INSERT INTO alerts (id, type, message, location, timestamp, read, resolved, category)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?)`
      ).run(
        alertId,
        "critical",
        `AI Anomaly Detected — pH ${reading.ph?.toFixed(2)}, Turbidity ${reading.turbidity?.toFixed(1)} NTU`,
        reading.sensorName,
        reading.timestamp,
        "pollution"
      );
    } catch { /* ignore */ }
  }

  private broadcastAnomaly(
    reading: SensorReadingEvent,
    mlResult: { score: number; latency_ms: number }
  ): void {
    sseManager.broadcast("anomaly_alert", {
      id: `alert-${Date.now()}`,
      sensorId: reading.sensorId,
      sensorName: reading.sensorName,
      type: "critical",
      message: `CHEMICAL SPILL DETECTED — ${reading.sensorName}`,
      detail: `pH=${reading.ph?.toFixed(2)}, O₂=${reading.oxygen?.toFixed(1)} mg/L, Turbidity=${reading.turbidity?.toFixed(1)} NTU`,
      score: mlResult.score,
      latency_ms: mlResult.latency_ms,
      timestamp: reading.timestamp,
    });
  }
}
