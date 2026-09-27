/**
 * DeepSea Sensor Data Pipeline
 * ==============================
 * Ye Worker service hai jo EventBus se sensor readings consume karti hai,
 * ML inference run karti hai, database mein store karti hai, aur
 * SSE ke through dashboard ko push karti hai.
 *
 * Flow:
 *   1. Sensor POST /api/sensors/ingest → EventBus publish("sensor.reading")
 *   2. THIS WORKER → subscribe("sensor.reading")
 *   3. mlWorker.predict(data) → ~1-5ms (model already in RAM)
 *   4. SQLite mein store karo (sensor_readings table)
 *   5. Agar anomaly → EventBus publish("ml.anomaly") + store alert
 *   6. sseManager.broadcast() → sabhi dashboard clients ko push
 *
 * Ye Kafka Consumer Group ka MVP simulation hai.
 */

import { eventBus, TOPICS, SensorReadingEvent, AnomalyEvent } from "./eventBus";
import { mlWorker } from "./mlWorker";
import { sseManager } from "./sseManager";
import { getDb } from "../db";
const searoute = require("searoute-js");

let isInitialized = false;

/** Initialize the sensor pipeline worker */
export function initSensorPipeline(): void {
  if (isInitialized) return;
  isInitialized = true;

  console.log("[Pipeline] Sensor data pipeline worker starting...");

  // ── Step 2: Subscribe to sensor readings (like Kafka consumer) ────────────
  eventBus.subscribe<SensorReadingEvent>(TOPICS.SENSOR_READING, async (reading) => {
    const t0 = Date.now();

    try {
      // ── Step 3: ML Inference (sub-5ms, model in RAM) ──────────────────────
      const mlResult = await mlWorker.predict({
        temperature: reading.temperature ?? 3.5,
        ph:          reading.ph          ?? 8.1,
        salinity:    reading.salinity    ?? 34.5,
        oxygen:      reading.oxygen      ?? 5.0,
        turbidity:   reading.turbidity   ?? 0.5,
      });

      const totalMs = Date.now() - t0;

      // ── Step 4: Store in SQLite time-series table ─────────────────────────
      try {
        const db = getDb();
        db.prepare(`
          INSERT INTO sensor_readings (sensor_id, ph, temp, salinity, oxygen, turbidity, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          reading.sensorId,
          reading.ph ?? null,
          reading.temperature ?? null,
          reading.salinity ?? null,
          reading.oxygen ?? null,
          reading.turbidity ?? null,
          reading.timestamp
        );

        // Update sensor's last_reading_json
        db.prepare(`
          UPDATE sensors
          SET last_reading_json = ?, updated_at = ?
          WHERE id = ?
        `).run(
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
        // Sensor might not exist in DB yet — that's okay for simulation
        if (!dbErr.message?.includes("FOREIGN KEY")) {
          console.error("[Pipeline] DB error:", dbErr.message);
        }
      }

      // ── Step 5: Broadcast sensor update via SSE ───────────────────────────
      sseManager.broadcast("sensor_update", {
        sensorId:   reading.sensorId,
        sensorName: reading.sensorName,
        reading:    reading,
        isAnomaly:  mlResult.isAnomaly,
        mlScore:    mlResult.score,
        latency_ms: totalMs,
        ts:         reading.timestamp,
      });

      // ── Step 5b: If ANOMALY detected → create alert & broadcast ──────────
      if (mlResult.isAnomaly) {
        const anomalyEvent: AnomalyEvent = {
          sensorId:   reading.sensorId,
          sensorName: reading.sensorName,
          isAnomaly:  true,
          score:      mlResult.score,
          latency_ms: mlResult.latency_ms,
          reading,
          timestamp:  reading.timestamp,
        };

        // Publish to ml.anomaly topic (other consumers can react to this)
        eventBus.publish<AnomalyEvent>(TOPICS.ML_ANOMALY, anomalyEvent);

        // Store alert in DB
        const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        try {
          const db = getDb();
          db.prepare(`
            INSERT INTO alerts (id, type, message, location, timestamp, read, resolved, category)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?)
          `).run(
            alertId,
            "critical",
            `AI Anomaly Detected — pH ${reading.ph?.toFixed(2)}, Turbidity ${reading.turbidity?.toFixed(1)} NTU`,
            reading.sensorName,
            reading.timestamp,
            "pollution"
          );
        } catch { /* ignore */ }

        // Push real-time anomaly alert via SSE
        sseManager.broadcast("anomaly_alert", {
          id:         alertId,
          sensorId:   reading.sensorId,
          sensorName: reading.sensorName,
          type:       "critical",
          message:    `🚨 CHEMICAL SPILL DETECTED — ${reading.sensorName}`,
          detail:     `pH=${reading.ph?.toFixed(2)}, O₂=${reading.oxygen?.toFixed(1)} mg/L, Turbidity=${reading.turbidity?.toFixed(1)} NTU`,
          score:      mlResult.score,
          latency_ms: mlResult.latency_ms,
          timestamp:  reading.timestamp,
        });

        console.log(`[Pipeline] 🚨 ANOMALY on ${reading.sensorName} — score=${mlResult.score.toFixed(3)}, total=${totalMs}ms`);
      }

    } catch (err: any) {
      console.error("[Pipeline] Worker error:", err.message);
    }
  });

  // ── Subscribe to ml.anomaly for drone auto-dispatch logic ─────────────────
  eventBus.subscribe<AnomalyEvent>(TOPICS.ML_ANOMALY, (anomaly) => {
    try {
      const db = getDb();
      
      // 1. Get the sensor's coordinates
      const sensor = db.prepare("SELECT lat, lng FROM sensors WHERE id = ?").get(anomaly.sensorId) as any;
      if (!sensor) return;

      // 2. Find an idle drone, fallback to any drone if none are idle
      let drone = db.prepare("SELECT * FROM drones WHERE status = 'idle' ORDER BY battery DESC LIMIT 1").get() as any;
      if (!drone) {
        console.log("[Pipeline] ⚠️ No idle drones available, falling back to any drone for dispatch...");
        drone = db.prepare("SELECT * FROM drones ORDER BY battery DESC LIMIT 1").get() as any;
        if (!drone) {
          console.log("[Pipeline] ❌ No drones exist in the database!");
          return;
        }
      }

      console.log(`[Pipeline] 🚁 Dispatching drone ${drone.name} to sensor ${anomaly.sensorName}`);

      // 3. Mark drone as active/responding (best-effort DB write)
      try {
        db.prepare("UPDATE drones SET status = 'active', last_update = ? WHERE id = ?").run(
          new Date().toISOString(), drone.id
        );
      } catch { /* DB busy — SSE will still broadcast */ }

      // 4. Determine coordinates
      let currentLat = drone.lat;
      let currentLng = drone.lng;
      const targetLat = sensor.lat;
      const targetLng = sensor.lng;

      // Generate maritime route to avoid land
      const originFeature = {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [currentLng, currentLat] }
      };
      const destFeature = {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [targetLng, targetLat] }
      };
      
      const route = searoute(originFeature, destFeature);
      // Route returns GeoJSON LineString coordinates: [lng, lat][]
      const pathCoordinates = route.geometry.coordinates.map((coord: number[]) => ({
        lng: coord[0],
        lat: coord[1]
      }));

      // Broadcast the dispatch event — include target coordinates for map path
      sseManager.broadcast("drone_dispatch", {
        reason:       "anomaly_detected",
        targetSensor: anomaly.sensorId,
        location:     anomaly.sensorName,
        droneId:      drone.id,
        droneName:    drone.name,
        eta_seconds:  60,
        timestamp:    anomaly.timestamp,
        targetLat:    targetLat,
        targetLng:    targetLng,
        originLat:    currentLat,
        originLng:    currentLng,
        path:         pathCoordinates,
      });

      // 5. Simulate movement towards the sensor along the maritime route
      // We will move through the pathCoordinates array over 30 seconds
      const totalSteps = 15;
      const pathPoints = pathCoordinates.length;
      let stepCount = 0;

      const movementInterval = setInterval(() => {
        stepCount++;
        
        // Interpolate progress along the path coordinates
        const progress = stepCount / totalSteps;
        const targetIndex = Math.min(Math.floor(progress * (pathPoints - 1)), pathPoints - 1);
        
        // For smoother animation, we could interpolate between two points, but for 
        // simulation jumping to the nearest waypoint is sufficient.
        currentLat = pathCoordinates[targetIndex].lat;
        currentLng = pathCoordinates[targetIndex].lng;

        // ALWAYS broadcast SSE first (map updates even if DB is busy)
        sseManager.broadcast("drone_update", {
          id: drone.id,
          name: drone.name,
          lat: currentLat,
          lng: currentLng,
          status: 'active',
          battery: Math.max(0, drone.battery - stepCount)
        });

        // Best-effort DB update (skip silently if locked)
        try {
          db.prepare("UPDATE drones SET lat = ?, lng = ?, last_update = ? WHERE id = ?").run(
            currentLat, currentLng, new Date().toISOString(), drone.id
          );
        } catch { /* DB temporarily locked — SSE already sent */ }

        if (stepCount >= totalSteps) {
          clearInterval(movementInterval);
          // Drone arrived
          sseManager.broadcast("drone_update", {
            id: drone.id,
            name: drone.name,
            status: 'idle',
            lat: targetLat,
            lng: targetLng,
            battery: Math.max(0, drone.battery - stepCount)
          });
          try {
            db.prepare("UPDATE drones SET status = 'idle', lat = ?, lng = ?, last_update = ? WHERE id = ?").run(
              targetLat, targetLng, new Date().toISOString(), drone.id
            );
          } catch { /* ignore */ }
          console.log(`[Pipeline] 🚁 Drone ${drone.name} arrived at ${anomaly.sensorName}.`);
        }
      }, 2000);

    } catch (err: any) {
      console.error("[Pipeline] Drone dispatch error:", err.message);
    }
  });

  console.log("[Pipeline] ✅ Sensor pipeline worker ready — subscribed to sensor.reading & ml.anomaly");
}
