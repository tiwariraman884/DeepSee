/**
 * Demo Scenario Route — One-Click Emergency Ocean Scenario
 * ========================================================
 *
 * This endpoint triggers the REAL production pipeline with a controlled,
 * deterministic sensor anomaly. It does NOT create a fake simulation.
 *
 * Flow:
 *   POST /api/demo/emergency-scenario
 *     → Validate drone eligibility
 *     → Inject known anomalous sensor reading via EventBus
 *     → Existing pipeline: ML → Alert → Drone → Inspection → Evidence
 *     → Return immediately (async pipeline runs in background)
 */
import { Router } from "express";
import { eventBus, TOPICS, SensorReadingEvent } from "../lib/eventBus";
import { getDb } from "../db";
import { selectDrone, MIN_BATTERY_PCT } from "../lib/droneSelection";
import { requireAuth } from "../lib/authMiddleware";
import { getDroneDispatcher } from "../lib/sensorPipeline";
import { mlWorker } from "../lib/mlWorker";

const router = Router();

// ─── Scenario → inspection linkage ───────────────────────────────────────────
// The pipeline runs async: the inspection row is created ~100–500ms AFTER the
// scenario is accepted, so the scenarioId can never be embedded in the
// inspection id. Instead we record each accepted scenario's start time and
// resolve the first fixture-sensor inspection at/after that moment.
// (Matching by ID prefix is broken: millisecond timestamps differ between
// the accept call and the dispatch — the old LIKE lookup could never match.)
const scenarioStarts = new Map<string, number>();

function rememberScenario(scenarioId: string, startedAtMs: number): void {
  scenarioStarts.set(scenarioId, startedAtMs);
  // Bounded: drop entries older than 10 minutes.
  const cutoff = Date.now() - 10 * 60_000;
  for (const [key, ts] of scenarioStarts) {
    if (ts < cutoff) scenarioStarts.delete(key);
  }
}

function findInspectionForScenario(db: any, scenarioId: string): any | null {
  const registered = scenarioStarts.get(scenarioId);
  if (registered !== undefined) {
    // In-process registry: same clock as the inspection timestamps, so an
    // exact lower bound is correct — no tolerance window that could admit an
    // older inspection from a previous scenario.
    const sinceIso = new Date(registered).toISOString();
    return (db.prepare(
      `SELECT * FROM drone_inspections
       WHERE sensor_id = ? AND started_at >= ?
       ORDER BY started_at ASC LIMIT 1`
    ).get(DEMO_SENSOR_ID, sinceIso) as any) ?? null;
  }
  // Legacy fallback for ids from before the registry (or another process):
  // scenario ids look like `scenario-<epochMs>-<rand>`, with a small
  // tolerance for clock skew.
  const m = /^scenario-(\d{10,})-/.exec(String(scenarioId));
  if (!m) return null;
  const sinceIso = new Date(Number(m[1]) - 10_000).toISOString();
  return (db.prepare(
    `SELECT * FROM drone_inspections
     WHERE sensor_id = ? AND started_at >= ?
     ORDER BY started_at ASC LIMIT 1`
  ).get(DEMO_SENSOR_ID, sinceIso) as any) ?? null;
}

function buildScenarioStatus(db: any, inspection: any, scenarioId: string) {
  // Get evidence count
  const evidenceCount = (db.prepare(
    "SELECT COUNT(*) as count FROM inspection_evidence WHERE inspection_id = ?"
  ).get(inspection.id) as any)?.count ?? 0;

  return {
    scenarioId,
    inspection: {
      id: inspection.id,
      drone_name: inspection.drone_name,
      sensor_name: inspection.sensor_name,
      phase: inspection.phase,
      progress: inspection.progress,
      severity: inspection.severity,
      summary: inspection.summary,
      startedAt: inspection.started_at,
      completedAt: inspection.completed_at,
    },
    evidenceCount,
  };
}

// ─── Deterministic Sensor Fixture ────────────────────────────────────────────
const DEMO_SENSOR_ID = "sensor_001";
const DEMO_SENSOR_NAME = "Temp Station Alpha";
const DEMO_ANOMALY_READING = {
  temperature: 3.1,
  ph: 5.8,
  salinity: 34.5,
  oxygen: 1.5,
  turbidity: 18.0,
};

/**
 * POST /api/demo/emergency-scenario
 *
 * Starts a controlled emergency scenario using the real pipeline.
 * Returns immediately — the workflow runs asynchronously.
 */
router.post("/emergency-scenario", requireAuth, (req, res) => {
  console.log("[Demo] Emergency scenario request received");
  try {
  // ── 1. Check ML worker availability ──────────────────────────────────────
  if (!mlWorker.isReady()) {
    console.log("[Demo] Emergency scenario failed: ml_worker_not_ready");
    return res.status(503).json({
      status: "unavailable",
      success: false,
      code: "ML_WORKER_NOT_READY",
      reason: "ml_worker_not_ready",
      message: "Scenario failed — anomaly inference unavailable.",
    });
  }

  // ── 2. Check active inspection guard ────────────────────────────────────
  const dispatcher = getDroneDispatcher();
  if (dispatcher?.isInspectionActive()) {
    console.log("[Demo] Emergency scenario failed: inspection_in_progress");
    return res.status(409).json({
      status: "busy",
      success: false,
      code: "INSPECTION_BUSY",
      reason: "inspection_in_progress",
      message: "Another inspection is currently active.",
    });
  }

  // ── 3. Verify drone eligibility (using existing selection logic) ─────────
  const db = getDb();
  const sensor = db.prepare("SELECT id, name, lat, lng FROM sensors WHERE id = ?").get(DEMO_SENSOR_ID) as any;
  if (!sensor) {
    console.log(`[Demo] Emergency scenario failed: sensor fixture '${DEMO_SENSOR_ID}' not found`);
    return res.status(500).json({
      status: "error",
      success: false,
      code: "SCENARIO_START_FAILED",
      reason: "sensor_not_found",
      message: `Demo sensor fixture '${DEMO_SENSOR_ID}' not found in database.`,
    });
  }

  const candidates = db.prepare("SELECT id, name, lat, lng, battery, status FROM drones").all() as any[];
  const selection = selectDrone(candidates, { targetLat: sensor.lat, targetLng: sensor.lng });

  if (!selection) {
    const idleCount = candidates.filter((d) => d.status === "idle").length;
    console.log("[Demo] Emergency scenario failed: no_eligible_drone");
    return res.status(409).json({
      status: "unavailable",
      success: false,
      code: "NO_DRONE_AVAILABLE",
      reason: "no_eligible_drone",
      message: idleCount === 0
        ? "Scenario cannot start — no eligible drone available. Fleet fully engaged."
        : `Scenario cannot start — no eligible drone. Drones below ${MIN_BATTERY_PCT}% battery.`,
    });
  }

  // ── 4. Generate scenario ID and inject sensor reading via EventBus ───────
  const scenarioId = `scenario-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = new Date().toISOString();

  console.log(`[Demo] Sensor input prepared: ${DEMO_SENSOR_ID} (${DEMO_SENSOR_NAME})`);

  const sensorEvent: SensorReadingEvent = {
    sensorId: DEMO_SENSOR_ID,
    sensorName: DEMO_SENSOR_NAME,
    ...DEMO_ANOMALY_READING,
    timestamp,
    source: "simulated",
  };

  // Publish to EventBus — this triggers the REAL pipeline:
  // sensor.reading → ML predict → anomaly → alert → drone dispatch → inspection
  console.log("[Demo] Scenario sensor ingest triggered — waiting for anomaly pipeline");
  eventBus.publish<SensorReadingEvent>(TOPICS.SENSOR_READING, sensorEvent);

  // ── 5. Return immediately (async pipeline runs in background) ───────────
  console.log(`[Demo] Emergency scenario accepted: ${scenarioId} (drone ${selection.selected.name})`);
  rememberScenario(scenarioId, Date.now());
  return res.status(202).json({
    status: "started",
    scenarioId,
    message: "Emergency ocean scenario started",
    sensor: {
      id: DEMO_SENSOR_ID,
      name: DEMO_SENSOR_NAME,
    },
    drone: {
      name: selection.selected.name,
      battery: selection.selected.battery,
      distanceKm: selection.distanceKm,
    },
    timestamp,
  });
  } catch (err: any) {
    console.log(`[Demo] Emergency scenario failed: ${err?.message ?? "unknown error"}`);
    return res.status(500).json({
      status: "error",
      success: false,
      code: "SCENARIO_START_FAILED",
      reason: "internal_error",
      message: "Internal scenario error.",
    });
  }
});

/**
 * GET /api/demo/scenario/:id
 *
 * Get the current status of a running scenario. Resolves the inspection
 * deterministically via the recorded scenario start time (see above) —
 * never by millisecond ID-prefix matching.
 */
router.get("/scenario/:id", requireAuth, (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const inspection = findInspectionForScenario(db, String(id));
  if (!inspection) {
    return res.status(404).json({ error: "Scenario not found" });
  }

  return res.json(buildScenarioStatus(db, inspection, String(id)));
});

/**
 * GET /api/demo/active-mission
 *
 * Current autonomous-response mission for late-joining clients (a tab opened
 * mid-mission missed the live `drone_dispatch` SSE event). Derived from the
 * persisted inspection row — including the full decided searoute from
 * `route_json` — so map/drone pages can render the path + position without
 * having observed the original dispatch broadcast.
 */
router.get("/active-mission", requireAuth, (_req, res) => {
  const db = getDb();
  try {
    const inspection = db.prepare(
      `SELECT * FROM drone_inspections
       WHERE phase IN ('en_route', 'arrived', 'inspecting')
       ORDER BY started_at DESC LIMIT 1`
    ).get() as any;
    if (!inspection) {
      return res.json({ active: false });
    }
    let path: { lat: number; lng: number }[] = [];
    try {
      const parsed = JSON.parse(inspection.route_json ?? "[]");
      if (Array.isArray(parsed)) {
        path = parsed.filter(
          (p: any) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
        );
      }
    } catch { /* malformed route → no path, mission still reported */ }
    return res.json({
      active: true,
      inspection: {
        id: inspection.id,
        phase: inspection.phase,
        progress: inspection.progress,
        droneId: inspection.drone_id,
        droneName: inspection.drone_name,
        sensorId: inspection.sensor_id,
        sensorName: inspection.sensor_name,
        startedAt: inspection.started_at,
      },
      dispatch: {
        droneId: inspection.drone_id,
        droneName: inspection.drone_name,
        location: inspection.sensor_name,
        targetSensor: inspection.sensor_id,
        targetLat: inspection.target_lat,
        targetLng: inspection.target_lng,
        originLat: inspection.origin_lat,
        originLng: inspection.origin_lng,
        path,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to read active mission" });
  }
});

/**
 * GET /api/demo/inspection/:inspectionId
 *
 * Direct deterministic lookup preferred by the frontend once the
 * `inspection_completed` SSE event (which carries the inspectionId) arrives.
 */
router.get("/inspection/:inspectionId", requireAuth, (req, res) => {
  const inspectionId = String(req.params.inspectionId ?? "");
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(inspectionId)) {
    return res.status(400).json({ error: "Invalid inspection ID." });
  }
  const db = getDb();
  const inspection = db.prepare(
    "SELECT * FROM drone_inspections WHERE id = ?"
  ).get(inspectionId) as any;
  if (!inspection) {
    return res.status(404).json({ error: "Inspection not found" });
  }
  return res.json(buildScenarioStatus(db, inspection, inspectionId));
});

export default router;
