import { Router } from "express";
import { getDb } from "../db";
import { execFile } from "child_process";
import path from "path";

const router = Router();

const VALID_TYPES = ["plastic", "oil_spill", "chemical", "ghost_net", "illegal_dumping"];
const VALID_SEVERITIES = ["low", "medium", "high", "critical"];

function severityRange(query: string): { min: number; max: number } | null {
  const n = Number(query);
  if (!Number.isNaN(n)) return { min: n, max: n };
  if (query === "low") return { min: 1, max: 3 };
  if (query === "medium") return { min: 4, max: 6 };
  if (query === "high") return { min: 7, max: 8 };
  if (query === "critical") return { min: 9, max: 10 };
  return null;
}

router.get("/", (req, res) => {
  const type = req.query.type as string;
  const severity = req.query.severity as string;
  const region = req.query.region as string;
  const status = req.query.status as string;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  let query = `SELECT * FROM pollution_events WHERE 1=1`;
  const params: any[] = [];

  if (type && type !== "all") {
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: "Invalid pollution type" });
    query += ` AND type = ?`;
    params.push(type);
  }

  if (severity && severity !== "all") {
    const range = severityRange(severity);
    if (!range) return res.status(400).json({ error: "Invalid severity" });
    query += ` AND severity >= ? AND severity <= ?`;
    params.push(range.min, range.max);
  }

  if (region && region !== "all") {
    query += ` AND region = ?`;
    params.push(region);
  }

  if (status && status !== "all") {
    query += ` AND status = ?`;
    params.push(status);
  }

  query += ` ORDER BY detected_at DESC LIMIT ?`;
  params.push(limit);

  try {
    const db = getDb();
    const rows = db.prepare(query).all(...params) as any[];
    const mapped = rows.map((r) => ({
      id: r.id, name: r.name, type: r.type,
      latitude: r.latitude, longitude: r.longitude,
      severity: r.severity, concentration: r.concentration,
      affectedArea: r.affected_area, region: r.region,
      detectedAt: r.detected_at, trend: r.trend, status: r.status,
    }));
    return res.json({ pollution: mapped, total: mapped.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/:id", (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT * FROM pollution_events WHERE id = ?").get(req.params.id) as any;
    if (!row) return res.status(404).json({ error: "Not found" });
    const mapped = {
      id: row.id, name: row.name, type: row.type,
      latitude: row.latitude, longitude: row.longitude,
      severity: row.severity, concentration: row.concentration,
      affectedArea: row.affected_area, region: row.region,
      detectedAt: row.detected_at, trend: row.trend, status: row.status,
    };
    return res.json({ event: mapped });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/forecast", (req, res) => {
  const { severity, trend, name } = req.body;
  if (severity === undefined) return res.status(400).json({ error: "Missing severity" });

  const mlDir = path.join(process.cwd(), "..", "ml");
  const scriptPath = path.join(mlDir, "forecast_spread.py");

  const inputData = { severity, trend: trend || "stable", name: name || "Unknown Event" };

  execFile("python", [scriptPath, JSON.stringify(inputData)], { cwd: mlDir }, (error, stdout, stderr) => {
    if (error) {
      console.error("[ML Forecast] Error:", stderr);
      return res.status(500).json({ error: "Failed to run forecast", detail: stderr });
    }
    try {
      const result = JSON.parse(stdout.trim());
      return res.json(result);
    } catch {
      return res.status(500).json({ error: "Invalid response from model" });
    }
  });
});

export default router;
