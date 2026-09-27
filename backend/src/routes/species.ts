import { Router } from "express";
import { getDb } from "../db";
import { execFile } from "child_process";
import path from "path";

const router = Router();

router.get("/", (req, res) => {
  const status = req.query.status as string;
  const region = req.query.region as string;
  const limit = Math.min(Number(req.query.limit) || 200, 1000);

  let query = `SELECT * FROM species WHERE 1=1`;
  const params: any[] = [];

  if (status && status !== "all") {
    query += ` AND status = ?`;
    params.push(status);
  }
  if (region && region !== "all") {
    query += ` AND region = ?`;
    params.push(region);
  }

  query += ` ORDER BY name ASC LIMIT ?`;
  params.push(limit);

  try {
    const db = getDb();
    const rows = db.prepare(query).all(...params) as any[];
    const mapped = rows.map(r => ({
      id: r.id, name: r.name, scientificName: r.scientific_name,
      status: r.status, category: r.category, conservation: r.conservation,
      population: r.population_json ? JSON.parse(r.population_json) : [],
      populationTrend: r.population_trend, habitat: r.habitat,
      region: r.region, conservationProgress: r.conservation_progress,
      threatLevel: r.threat_level,
      threats: r.threats_json ? JSON.parse(r.threats_json) : [],
      coordinates: { lat: r.lat, lng: r.lng },
      image: r.image
    }));
    return res.json({ species: mapped, total: mapped.length });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post("/classify", (req, res) => {
  const { image_b64 } = req.body;
  if (!image_b64) return res.status(400).json({ error: "Missing image base64 data" });

  const mlDir = path.join(process.cwd(), "..", "ml");
  const scriptPath = path.join(mlDir, "classify_species.py");

  // Setting larger maxBuffer since we pass base64 over stdout/stdin if needed, 
  // but we pass via args. Since args have limits, we should pass via stdin if it's large.
  // Actually, passing a base64 string via command line arguments can exceed max length.
  // Setting larger maxBuffer since stdout can be large theoretically, though we just output small JSON.
  const child = execFile("python", [scriptPath], { cwd: mlDir, maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
    if (error) {
      console.error("[CV Classify] Error:", stderr);
      return res.status(500).json({ error: "Classification failed", detail: stderr });
    }
    try {
      const result = JSON.parse(stdout.trim());
      return res.json(result);
    } catch {
      return res.status(500).json({ error: "Invalid response from model" });
    }
  });

  child.stdin?.write(JSON.stringify({ image_b64 }));
  child.stdin?.end();
});

export default router;
