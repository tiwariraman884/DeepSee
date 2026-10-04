/**
 * Sensors API Routes
 * ===================
 *
 *   POST /api/sensors/ingest  → EventBus mein publish karo
 *   POST /api/sensors/predict → RAM-loaded ML model se instant prediction
 *   GET  /api/sensors/stream  → SSE real-time stream
 *   GET  /api/sensors         → All sensors from DB
 */
import { Router } from "express";
import { getDb } from "../db";
import { eventBus, TOPICS, SensorReadingEvent } from "../lib/eventBus";
import { mlWorker } from "../lib/mlWorker";
import { sseManager } from "../lib/sseManager";
import { requireAuth } from "../lib/authMiddleware";
import { deviceAuth } from "../lib/deviceAuth";
import { validate } from "../lib/validate";
import { sensorPredictSchema, sensorIngestSchema, deviceDiagnosticsSchema } from "../lib/validation";
import { recordMlInferenceLatency } from "../lib/runtimeMetrics";
import { recordDeviceDiagnostics } from "../lib/deviceRegistry";
import { missingMlFeatures } from "../lib/pipeline/sensorConsumer";

const router = Router();

// ─── GET /api/sensors — All sensors from database ────────────────────────────
router.get("/", requireAuth, (req, res) => {
  const status = req.query.status as string;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  let query = `SELECT * FROM sensors WHERE 1=1`;
  const params: any[] = [];

  if (status && status !== "all") {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY updated_at DESC LIMIT ?`;
  params.push(limit);

  try {
    const db = getDb();
    const rows = db.prepare(query).all(...params) as any[];
    // Provenance: latest persisted reading per sensor (one query, no N+1).
    // Sensors with no sourced readings omit these fields rather than guessing.
    let provenance = new Map<string, any>();
    try {
      const prov = db.prepare(
        `SELECT sensor_id, source, device_id, MAX(recorded_at) AS last_at
         FROM sensor_readings GROUP BY sensor_id`
      ).all() as any[];
      provenance = new Map(prov.map((p) => [p.sensor_id, p]));
    } catch { /* readings table unavailable — omit provenance */ }
    const mapped = rows.map(r => {
      const p = provenance.get(r.id);
      return {
        id: r.id, name: r.name, type: r.type, status: r.status,
        coordinates: { lat: r.lat, lng: r.lng },
        online: r.online === 1,
        updatedAt: r.updated_at,
        lastReading: r.last_reading_json ? JSON.parse(r.last_reading_json) : {},
        ...(p?.source ? { source: p.source } : {}),
        ...(p?.device_id ? { deviceId: p.device_id } : {}),
        ...(p?.last_at ? { lastReadingAt: p.last_at } : {}),
      };
    });
    return res.json({ sensors: mapped, total: mapped.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/sensors/stream — SSE real-time stream ──────────────────────────
router.get("/stream", requireAuth, (req, res) => {
  const clientId = sseManager.addClient(res);
  req.on("close", () => sseManager.removeClient(clientId));
});

// ─── GET /api/sensors/live — Legacy SSE (backwards compatible) ────────────────
router.get("/live", requireAuth, (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const sendSensors = () => {
    try {
      const db = getDb();
      const rows = db.prepare(`SELECT * FROM sensors WHERE online=1 ORDER BY updated_at DESC LIMIT 100`).all() as any[];
      const mapped = rows.map(r => ({
        id: r.id, name: r.name, type: r.type, status: r.status,
        coordinates: { lat: r.lat, lng: r.lng },
        online: r.online === 1,
        updatedAt: r.updated_at,
        lastReading: r.last_reading_json ? JSON.parse(r.last_reading_json) : {}
      }));
      res.write(`data: ${JSON.stringify(mapped)}\n\n`);
    } catch (err) {
      console.error("[SSE-Legacy] Error:", err);
    }
  };

  sendSensors();
  const interval = setInterval(sendSensors, 5000);
  req.on("close", () => clearInterval(interval));
});

// ─── GET /api/sensors/readings/:id — Time-series data for a sensor ────────────
router.get("/readings/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const limit = Math.min(Number(req.query.limit) || 100, 1000);

  try {
    const db = getDb();
    const rows = db.prepare(
      `SELECT * FROM sensor_readings WHERE sensor_id = ? ORDER BY recorded_at DESC LIMIT ?`
    ).all(id, limit) as any[];

    return res.json({ sensorId: id, readings: rows.reverse(), total: rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/sensors/ingest — MQTT-like sensor data ingestion ───────────────
// ONE endpoint, ONE pipeline. Browser/API clients authenticate via requireAuth
// (source "manual"); hardware devices via deviceAuth (source "hardware").
// Both reach the same handler below — no second ingestion path exists.
function ingestAuth(req: any, res: any, next: any): void {
  if (req.headers["x-device-id"]) return deviceAuth(req, res, next);
  return requireAuth(req, res, next);
}

router.post("/ingest", ingestAuth, validate(sensorIngestSchema), (req, res) => {
  const { sensorId, sensorName, ...readings } = req.body;
  const device = (req as any).device as { deviceId: string } | undefined;
  // Firmware bench mode declares itself via header and is stored as
  // hardware_test — traceable, never masquerading as real hardware.
  const testMode =
    !!device && String(req.headers["x-device-mode"] ?? "").toLowerCase() === "test";
  const source = device ? (testMode ? "hardware_test" : "hardware") : "manual";
  const deviceId = device?.deviceId;

  // ML-readiness is determined synchronously from payload completeness —
  // incomplete vectors are persisted as telemetry but never enter the model.
  const missing = missingMlFeatures(readings);

  const event: SensorReadingEvent = {
    sensorId,
    sensorName: sensorName || sensorId,
    temperature: readings.temperature,
    ph: readings.ph,
    salinity: readings.salinity,
    oxygen: readings.oxygen,
    turbidity: readings.turbidity,
    timestamp: new Date().toISOString(),
    source,
    ...(deviceId ? { deviceId } : {}),
  };

  if (device) {
    console.log(`[Device] ESP32 ${deviceId} authenticated`);
    console.log(
      `[Device] Telemetry received — temperature=${readings.temperature ?? "n/a"}°C` +
      (missing.length > 0 ? " — ML status: waiting_for_features" : " — ML-ready vector")
    );
  }

  eventBus.publish<SensorReadingEvent>(TOPICS.SENSOR_READING, event);

  return res.status(202).json({
    status: "queued",
    message: "Sensor data queued for ML processing",
    sensorId,
    source,
    ...(deviceId ? { deviceId } : {}),
    mlReady: missing.length === 0,
    missingFeatures: missing,
    timestamp: event.timestamp,
  });
});

// ─── POST /api/sensors/diagnostics — device self-report (Phase 6B) ───────────
// Throttled by the firmware (~1/min). Accepted + logged, never persisted as
// readings. Surfaced in System Intelligence exactly as reported.
router.post("/diagnostics", deviceAuth, validate(deviceDiagnosticsSchema), (req, res) => {
  const device = (req as any).device as { deviceId: string };
  const record = recordDeviceDiagnostics(device.deviceId, req.body ?? {});
  console.log(
    `[Device] Diagnostics from ${device.deviceId} (fw=${record.firmwareVersion ?? "?"}, rssi=${record.wifiRssi ?? "?"})`
  );
  return res.status(202).json({ status: "accepted", deviceId: device.deviceId });
});

// ─── POST /api/sensors/predict — Direct ML prediction (interactive use) ───────
router.post("/predict", requireAuth, validate(sensorPredictSchema), async (req, res) => {
  const data = req.body;

  try {
    const result = await mlWorker.predict({
      temperature: data.temperature,
      ph: data.ph,
      salinity: data.salinity,
      oxygen: data.oxygen,
      turbidity: data.turbidity,
    });
    recordMlInferenceLatency(result.latency_ms);

    // If anomaly detected → fire drone dispatch via EventBus
    if (result.isAnomaly) {
      try {
        const db = getDb();
        const sensor = db.prepare(
          "SELECT id, name FROM sensors WHERE online = 1 ORDER BY RANDOM() LIMIT 1"
        ).get() as any;

        const sensorId = sensor?.id ?? "sensor-manual";
        const sensorName = sensor?.name ?? "Manual Detection — AI Center";

        const anomalyEvent = {
          sensorId, sensorName,
          isAnomaly: true,
          score: result.score,
          latency_ms: result.latency_ms,
          reading: {
            sensorId, sensorName,
            temperature: data.temperature, ph: data.ph,
            salinity: data.salinity, oxygen: data.oxygen,
            turbidity: data.turbidity,
            timestamp: new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        };

        eventBus.publish(TOPICS.ML_ANOMALY, anomalyEvent);
        console.log(`[Predict] Anomaly from AI Center → EventBus published, drone dispatch triggered`);
      } catch (dispatchErr: any) {
        console.warn("[Predict] Could not trigger drone dispatch:", dispatchErr.message);
      }
    }

    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: "ML prediction failed", detail: err.message });
  }
});

// ─── GET /api/sensors/pipeline-stats — Pipeline health & metrics ──────────────
router.get("/pipeline-stats", requireAuth, (req, res) => {
  return res.json({
    mlWorker: {
      ready: mlWorker.isReady(),
      status: mlWorker.isReady() ? "model_in_ram" : "loading",
    },
    eventBus: eventBus.getStats(),
    sse: sseManager.getStats(),
  });
});

export default router;
