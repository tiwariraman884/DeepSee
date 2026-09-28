import { Router } from "express";
import { getDb } from "../db";
import { execFile } from "child_process";
import path from "path";
import fs from "fs";
import { getPythonBin, getMlDir } from "../lib/python";
import { speciesWorker } from "../lib/speciesWorker";
import { requireAuth } from "../lib/authMiddleware";
import { validate } from "../lib/validate";
import { speciesClassifySchema } from "../lib/validation";

const router = Router();

const LABEL_MAP_PATH = path.join(process.cwd(), "..", "ml", "species_label_map.json");

let _labelMap: any = null;
function getLabelMap(): any {
  if (_labelMap) return _labelMap;
  try {
    _labelMap = JSON.parse(fs.readFileSync(LABEL_MAP_PATH, "utf-8"));
  } catch {
    _labelMap = { classToSpecies: {}, displayNames: {} };
  }
  return _labelMap;
}

function normalizeClass(raw: string, map: any): string {
  if (!raw) return "";
  const keys = Object.keys(map.classToSpecies || {});
  if (keys.includes(raw)) return raw;
  const lower = raw.trim().toLowerCase();
  return keys.find(
    (k) =>
      k.toLowerCase() === lower ||
      k.toLowerCase().replace(/[\s_]/g, "") === lower.replace(/[\s_]/g, "")
  ) ?? raw.trim();
}

router.get("/", requireAuth, (req, res) => {
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

router.post("/classify", requireAuth, validate(speciesClassifySchema), async (req, res) => {
  const { image_b64 } = req.body;

  let result: any;
  try {
    result = await classifyImage(image_b64);
  } catch (err: any) {
    console.error("[CV Classify] Error:", err?.message || err);
    return res.status(500).json({ error: "Classification failed", detail: String(err?.message || err) });
  }

  return res.json(enrich(result));
});

async function classifyImage(image_b64: string): Promise<any> {
  if (!speciesWorker.isReady) {
    try {
      await speciesWorker.start();
    } catch (err: any) {
      console.warn("[CV Classify] Worker unavailable, using one-shot fallback:", err?.message);
    }
  }

  if (speciesWorker.isReady) {
    return speciesWorker.classify(image_b64);
  }

  return runOneShot(image_b64);
}

function runOneShot(image_b64: string): Promise<any> {
  const mlDir = getMlDir();
  const scriptPath = path.join(mlDir, "classify_species.py");

  return new Promise((resolve, reject) => {
    const child = execFile(
      getPythonBin(),
      [scriptPath],
      { cwd: mlDir, maxBuffer: 1024 * 1024 * 10, timeout: 180000 },
      (error, stdout, stderr) => {
        if (error) return reject(new Error(stderr || error.message));
        try {
          resolve(JSON.parse(stdout.trim()));
        } catch {
          reject(new Error("Invalid response from model"));
        }
      }
    );
    child.stdin?.write(JSON.stringify({ image_b64 }));
    child.stdin?.end();
  });
}

function enrich(result: any): any {
  if (result?.status !== "success" || !result.species) return result;

  const map = getLabelMap();
  const cls = normalizeClass(result.species, map);
  const speciesIds: string[] = map.classToSpecies?.[cls] ?? [];

  result.rawLabel = result.species;
  result.label = cls;
  result.displayName = map.displayNames?.[cls] ?? cls.replace(/[_-]/g, " ");
  result.covered = speciesIds.length > 0;

  if (speciesIds.length === 0) {
    result.matches = [];
    return result;
  }

  try {
    const db = getDb();
    const placeholders = speciesIds.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT * FROM species WHERE id IN (${placeholders})`)
      .all(...speciesIds) as any[];
    result.matches = rows.map((r) => ({
      id: r.id, name: r.name, scientificName: r.scientific_name,
      status: r.status, habitat: r.habitat, region: r.region, image: r.image,
    }));
  } catch {
    result.matches = [];
  }

  return result;
}

export default router;
