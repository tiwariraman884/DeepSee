/**
 * Inspection AI — simulated camera-frame analysis for drone inspections.
 * ======================================================================
 * Software-only simulation (no physical cameras / RTSP / WebRTC):
 *
 *   1. Picks one local sample frame from frontend/public/species/samples/
 *      (the same images the Species Classifier page uses).
 *   2. Runs it through the EXISTING resident species worker (real ML model,
 *      real label mapping from ml/species_label_map.json).
 *   3. Enriches with conservation data from the existing species DB.
 *
 * Everything the pipeline emits from this module is explicitly tagged
 * `simulation: true` so the UI can label detections as SIMULATION /
 * DEMO DETECTION instead of implying production-grade real-world perception.
 * The threat-type findings (oil film, debris, ...) are heuristic demo
 * detections, NOT model outputs — only the species classification below is
 * backed by an actual trained model.
 */

import fs from "fs";
import path from "path";
import { speciesWorker } from "./speciesWorker";
import { getDb } from "../db";

let _labelMap: any = null;
function getLabelMap(): any {
  if (_labelMap) return _labelMap;
  try {
    _labelMap = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "..", "ml", "species_label_map.json"), "utf-8")
    );
  } catch {
    _labelMap = { classToSpecies: {}, displayNames: {} };
  }
  return _labelMap;
}

function getSamplesDir(): string {
  return path.join(process.cwd(), "..", "frontend", "public", "species", "samples");
}

/** Pick a deterministic-ish random sample frame (uniform over available files). */
export function pickSampleFrame(): { file: string; base64: string } | null {
  try {
    const dir = getSamplesDir();
    const files = fs.readdirSync(dir).filter((f) => /\.(webp|png|jpe?g)$/i.test(f));
    if (files.length === 0) return null;
    const file = files[Math.floor(Math.random() * files.length)];
    return { file, base64: fs.readFileSync(path.join(dir, file)).toString("base64") };
  } catch {
    return null;
  }
}

export interface AiDetection {
  kind: "marine_species";
  label: string;
  confidence: number;
  detail: string;
  /** Always true for findings emitted by this simulation module. */
  simulation: boolean;
  conservation?: string;
  frameFile?: string;
}

/**
 * Analyse one sample frame with the real species classifier.
 * Returns null when the worker is unavailable — callers must degrade to
 * heuristic findings only rather than fabricating a detection.
 */
export async function analyseFrame(): Promise<AiDetection | null> {
  const frame = pickSampleFrame();
  if (!frame) return null;

  let raw: any = null;
  try {
    if (!speciesWorker.isReady) {
      try { await speciesWorker.start(); } catch { /* fall through */ }
    }
    if (!speciesWorker.isReady) return null;
    raw = await speciesWorker.classify(frame.base64);
  } catch {
    return null;
  }

  if (raw?.status !== "success" || !raw.species) return null;

  const map = getLabelMap();
  const keys = Object.keys(map.classToSpecies || {});
  const lower = String(raw.species).trim().toLowerCase();
  const cls =
    keys.find((k) => k.toLowerCase() === lower) ??
    keys.find((k) => k.toLowerCase().replace(/[\s_]/g, "") === lower.replace(/[\s_]/g, "")) ??
    String(raw.species).trim();

  const speciesIds: string[] = map.classToSpecies?.[cls] ?? [];
  const displayName: string = map.displayNames?.[cls] ?? cls.replace(/_/g, " ");

  // Conservation from the existing species DB (first mapped species).
  let conservation: string | undefined;
  if (speciesIds.length > 0) {
    try {
      const db = getDb();
      const row = db
        .prepare("SELECT conservation, threat_level FROM species WHERE id = ?")
        .get(speciesIds[0]) as any;
      if (row) conservation = row.threat_level ?? row.conservation;
    } catch { /* enrichment is best-effort */ }
  }

  const confidence = Math.round((raw.confidence ?? raw.score ?? 0) * 1000) / 10;

  return {
    kind: "marine_species",
    label: displayName,
    confidence,
    detail: `Potential protected species detected in inspection frame (${frame.file})`,
    simulation: true,
    conservation,
    frameFile: frame.file,
  };
}
