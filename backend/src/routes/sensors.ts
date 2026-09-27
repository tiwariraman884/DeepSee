/**
 * Sensors API Routes
 * ===================
 * Naya architecture:
 *   POST /api/sensors/ingest  → EventBus mein publish karo (MQTT broker ki tarah)
 *   POST /api/sensors/predict → RAM-loaded ML model se instant prediction
 *   GET  /api/sensors/stream  → SSE real-time stream (replaces polling)
 *   GET  /api/sensors         → All sensors from DB
 */

import { Router } from "express";
import { getDb } from "../db";
import { eventBus, TOPICS, SensorReadingEvent } from "../lib/eventBus";
import { mlWorker } from "../lib/mlWorker";
import { sseManager } from "../lib/sseManager";

const router = Router();

// ─── GET /api/sensors — All sensors from database ────────────────────────────
router.get("/", (req, res) => {
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
    const mapped = rows.map(r => ({
      id: r.id, name: r.name, type: r.type, status: r.status,
      coordinates: { lat: r.lat, lng: r.lng },
      online: r.online === 1,
      updatedAt: r.updated_at,
      lastReading: r.last_reading_json ? JSON.parse(r.last_reading_json) : {}
    }));
    return res.json({ sensors: mapped, total: mapped.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/sensors/stream — SSE real-time stream ──────────────────────────
// Frontend yahan connect karta hai aur real-time events receive karta hai
// Ye polling (har 5s mein fetch) se 100x better hai
router.get("/stream", (req, res) => {
  const clientId = sseManager.addClient(res);

  req.on("close", () => {
    sseManager.removeClient(clientId);
  });
});

// ─── GET /api/sensors/live — Legacy SSE (backwards compatible) ────────────────
router.get("/live", (req, res) => {
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
router.get("/readings/:id", (req, res) => {
  const { id } = req.params;
  const limit = Math.min(Number(req.query.limit) || 100, 1000);

  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT * FROM sensor_readings
      WHERE sensor_id = ?
      ORDER BY recorded_at DESC
      LIMIT ?
    `).all(id, limit) as any[];

    return res.json({ sensorId: id, readings: rows.reverse(), total: rows.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ─── POST /api/sensors/ingest — MQTT-like sensor data ingestion ───────────────
// Sensors apna data yahan POST karte hain
// Ye directly DB mein nahi jaata — pehle EventBus (Kafka queue) mein jaata hai
router.post("/ingest", (req, res) => {
  const { sensorId, sensorName, ...readings } = req.body;

  if (!sensorId) {
    return res.status(400).json({ error: "sensorId required" });
  }

  const event: SensorReadingEvent = {
    sensorId,
    sensorName: sensorName || sensorId,
    temperature: readings.temperature,
    ph:          readings.ph,
    salinity:    readings.salinity,
    oxygen:      readings.oxygen,
    turbidity:   readings.turbidity,
    timestamp:   new Date().toISOString(),
  };

  // Publish to EventBus (like sending to Kafka topic / MQTT broker)
  // This returns IMMEDIATELY — the pipeline worker processes it async
  eventBus.publish<SensorReadingEvent>(TOPICS.SENSOR_READING, event);

  // 202 Accepted — data queued, not yet processed (correct REST semantics)
  return res.status(202).json({
    status: "queued",
    message: "Sensor data queued for ML processing",
    sensorId,
    timestamp: event.timestamp,
  });
});

// ─── POST /api/sensors/predict — Direct ML prediction (interactive use) ───────
// Dashboard ke "Run Anomaly Detection" button ke liye
// Uses RAM-loaded model (NOT spawning new Python process each time)
router.post("/predict", async (req, res) => {
  const data = req.body;

  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No sensor data provided" });
  }

  const required = ["temperature", "ph", "salinity", "oxygen", "turbidity"];
  const missing = required.filter(f => data[f] === undefined);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
  }

  try {
    // mlWorker.predict() uses the RAM-loaded model — no Python spawn overhead
    const result = await mlWorker.predict({
      temperature: data.temperature,
      ph:          data.ph,
      salinity:    data.salinity,
      oxygen:      data.oxygen,
      turbidity:   data.turbidity,
    });

    // ── If anomaly detected → fire drone dispatch via EventBus ──────────────
    if (result.isAnomaly) {
      try {
        const db = getDb();
        // Pick the first active online sensor to use as anomaly location
        const sensor = db.prepare(
          "SELECT id, name FROM sensors WHERE online = 1 ORDER BY RANDOM() LIMIT 1"
        ).get() as any;

        const sensorId   = sensor?.id   ?? "sensor-manual";
        const sensorName = sensor?.name ?? "Manual Detection — AI Center";

        const anomalyEvent = {
          sensorId,
          sensorName,
          isAnomaly:  true,
          score:      result.score,
          latency_ms: result.latency_ms,
          reading: {
            sensorId, sensorName,
            temperature: data.temperature,
            ph:          data.ph,
            salinity:    data.salinity,
            oxygen:      data.oxygen,
            turbidity:   data.turbidity,
            timestamp:   new Date().toISOString(),
          },
          timestamp: new Date().toISOString(),
        };

        eventBus.publish(TOPICS.ML_ANOMALY, anomalyEvent);
        console.log(`[Predict] 🚨 Anomaly from AI Center → EventBus published, drone dispatch triggered`);
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
router.get("/pipeline-stats", (req, res) => {
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
