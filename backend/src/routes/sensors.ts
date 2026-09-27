import { Router } from "express";
import { execFile } from "child_process";
import path from "path";
import { getDb } from "../db";

const router = Router();

// GET /api/sensors - List all sensors
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

// GET /api/sensors/live - SSE endpoint for live sensor updates
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
      console.error("[SSE] Error fetching sensors:", err);
    }
  };

  sendSensors();
  const interval = setInterval(sendSensors, 5000);

  req.on("close", () => {
    clearInterval(interval);
  });
});

// POST /api/sensors/predict - Run ML Anomaly Detection on sensor data
// Body: { temperature: number, ph: number, salinity: number, oxygen: number, turbidity: number }
router.post("/predict", (req, res) => {
  const data = req.body;

  if (!data || Object.keys(data).length === 0) {
    return res.status(400).json({ error: "No sensor data provided" });
  }

  const required = ["temperature", "ph", "salinity", "oxygen", "turbidity"];
  const missing = required.filter(f => data[f] === undefined);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(", ")}` });
  }

  // Path to the Python predict script and ml directory
  const mlDir = path.join(process.cwd(), "..", "ml");
  const scriptPath = path.join(mlDir, "predict.py");

  execFile("python", [scriptPath, JSON.stringify(data)], { cwd: mlDir }, (error, stdout, stderr) => {
    if (error) {
      console.error("[ML] Error:", stderr);
      return res.status(500).json({ error: "Failed to run ML prediction", detail: stderr });
    }

    try {
      const result = JSON.parse(stdout.trim());
      return res.json(result);
    } catch {
      console.error("[ML] Could not parse output:", stdout);
      return res.status(500).json({ error: "Invalid response from ML model" });
    }
  });
});

export default router;
