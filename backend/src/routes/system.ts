/**
 * System Intelligence API (Step 5).
 * ============================================================
 * Authenticated observability snapshot built ONLY from real runtime state:
 *
 *   services   — process.uptime, SELECT 1 timing, mlWorker lifecycle,
 *                eventBus.getStats(), sseManager.getStats()
 *   operations — COUNT(*) over SQLite (sensors/drones/inspections/alerts/evidence)
 *   performance— bounded in-memory rolling latency telemetry (runtimeMetrics)
 *   models     — documented validation artifacts (ml/*.json), never live claims
 *   lastIncident — most recent completed inspection + evidence count
 *
 * No Math.random(), no static runtime numbers, no composite health scores.
 */
import { Router } from "express";
import fs from "fs";
import path from "path";
import { getDb } from "../db";
import { requireAuth } from "../lib/authMiddleware";
import { eventBus } from "../lib/eventBus";
import { sseManager } from "../lib/sseManager";
import { mlWorker } from "../lib/mlWorker";
import { getMlInferenceStats, getPipelineStats } from "../lib/runtimeMetrics";
import { getDroneDispatcher, isSensorPipelineActive } from "../lib/sensorPipeline";
import { getDeviceDiagnostics } from "../lib/deviceRegistry";
import { visionPipeline } from "../lib/vision/pipeline";

const router = Router();

const ML_DIR = path.join(__dirname, "..", "..", "..", "ml");

function readArtifact(fileName: string): any | null {
  try {
    const raw = fs.readFileSync(path.join(ML_DIR, fileName), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function count(db: any, sql: string, ...params: any[]): number {
  try {
    return (db.prepare(sql).get(...params) as any)?.c ?? 0;
  } catch {
    return 0;
  }
}

router.get("/intelligence", requireAuth, (_req, res) => {
  const t0 = Date.now();
  try {
    const db = getDb();

    // ── Services: real internal checks ───────────────────────────────────────
    const dbT0 = Date.now();
    db.prepare("SELECT 1 AS ok").get();
    const dbLatencyMs = Date.now() - dbT0;

    const bus = eventBus.getStats();
    const sse = sseManager.getStats();
    const mlLifecycle = mlWorker.getLifecycleState();
    // Transparent rule: any failed or dead-lettered delivery degrades the bus.
    const busStatus = bus.failed === 0 && bus.deadLettered === 0 ? "healthy" : "degraded";

    // ── Operations: COUNT(*) only ────────────────────────────────────────────
    const sensorsTotal = count(db, "SELECT COUNT(*) c FROM sensors");
    const sensorsOnline = count(db, "SELECT COUNT(*) c FROM sensors WHERE online = 1");

    const droneRows = (() => {
      try {
        return db.prepare("SELECT status, COUNT(*) c FROM drones GROUP BY status").all() as any[];
      } catch {
        return [];
      }
    })();
    const drones: Record<string, number> = { total: 0, active: 0, idle: 0, offline: 0, charging: 0, returning: 0 };
    for (const row of droneRows) {
      drones.total += row.c;
      if (row.status in drones) drones[row.status] = row.c;
    }

    const inspectionsActive = count(
      db, "SELECT COUNT(*) c FROM drone_inspections WHERE phase IN ('en_route','arrived','inspecting')"
    );
    const inspectionsCompletedToday = count(
      db, "SELECT COUNT(*) c FROM drone_inspections WHERE phase = 'complete' AND completed_at >= datetime('now','start of day')"
    );
    const inspectionsTotal = count(db, "SELECT COUNT(*) c FROM drone_inspections");

    const alertsToday = count(db, "SELECT COUNT(*) c FROM alerts WHERE timestamp >= datetime('now','start of day')");
    const alertsCritical = count(db, "SELECT COUNT(*) c FROM alerts WHERE type = 'critical' AND resolved = 0");
    const alertsUnresolved = count(db, "SELECT COUNT(*) c FROM alerts WHERE resolved = 0");

    const evidenceToday = count(db, "SELECT COUNT(*) c FROM inspection_evidence WHERE captured_at >= datetime('now','start of day')");
    const evidenceTotal = count(db, "SELECT COUNT(*) c FROM inspection_evidence");

    // ── Last completed incident (single query + subselect, no N+1) ───────────
    let lastIncident: any = null;
    try {
      const row = db.prepare(
        `SELECT i.id, i.severity, i.sensor_name, i.drone_name, i.started_at, i.completed_at,
                (SELECT COUNT(*) FROM inspection_evidence e WHERE e.inspection_id = i.id) AS evidence_count
         FROM drone_inspections i
         WHERE i.phase = 'complete'
         ORDER BY i.completed_at DESC
         LIMIT 1`
      ).get() as any;
      if (row) {
        const dur =
          row.started_at && row.completed_at &&
          Number.isFinite(Date.parse(row.completed_at) - Date.parse(row.started_at))
            ? Math.round((Date.parse(row.completed_at) - Date.parse(row.started_at)) / 1000)
            : null;
        lastIncident = {
          inspectionId: row.id,
          severity: row.severity,
          sensorName: row.sensor_name,
          droneName: row.drone_name,
          evidenceCount: row.evidence_count,
          durationSeconds: dur,
          completedAt: row.completed_at,
        };
      }
    } catch { /* lastIncident stays null */ }

    // ── Models: documented artifacts only ────────────────────────────────────
    const anomalyArtifact = readArtifact("anomaly_validation_metrics.json");
    const speciesArtifact = readArtifact("species_classifier_metrics.json");

    const dispatcher = getDroneDispatcher();
    const vision = visionPipeline.getCounters();
    const visionSource = visionPipeline.getActiveSource()?.getStatus() ?? null;
    const visionCaptureAvg = (visionSource as any)?.captureStats?.avgCaptureMs ?? null;

    // ── Hardware telemetry (Phase 6A: ESP32 gateway) ─────────────────────────
    // Application heartbeat policy: a device is ONLINE only if telemetry was
    // received within OFFLINE_AFTER_SECONDS (default 90s — device posts every
    // 10–15s). Computed live from persisted timestamps; nothing is claimed
    // from mere registration.
    const OFFLINE_AFTER_SECONDS = Math.max(
      10, Number(process.env.OFFLINE_AFTER_SECONDS ?? 90) || 90
    );
    let hardware: any = { registered: false };
    try {
      const hwSensor = db.prepare("SELECT * FROM sensors WHERE id = 'esp32_001'").get() as any;
      if (hwSensor) {
        // Prefer the latest HARDWARE-sourced reading: other writers (e.g. a
        // dev live-data simulator) may post rows for this sensor ID that must
        // never masquerade as device telemetry.
        const last = db.prepare(
          `SELECT temp, ph, salinity, oxygen, turbidity, recorded_at, source, device_id
           FROM sensor_readings WHERE sensor_id = 'esp32_001' AND source = 'hardware'
           ORDER BY recorded_at DESC LIMIT 1`
        ).get() as any;
        const lastSeen = last?.recorded_at ?? hwSensor.updated_at ?? null;
        const ageSec = lastSeen && Number.isFinite(Date.parse(lastSeen))
          ? Math.max(0, Math.round((Date.now() - Date.parse(lastSeen)) / 1000))
          : null;
        const feats = last
          ? (["temperature", "ph", "salinity", "oxygen", "turbidity"] as const).map((f) => ({
              name: f,
              value: f === "temperature" ? last.temp : (last as any)[f],
            }))
          : [];
        // Registered but silent: every required feature is still missing.
        const missing = last
          ? feats.filter((f) => typeof f.value !== "number" || !Number.isFinite(f.value)).map((f) => f.name)
          : ["temperature", "ph", "salinity", "oxygen", "turbidity"];
        hardware = {
          registered: true,
          deviceId: "esp32_001",
          name: hwSensor.name,
          online: ageSec !== null && ageSec <= OFFLINE_AFTER_SECONDS,
          lastSeen,
          ageSeconds: ageSec,
          offlineAfterSeconds: OFFLINE_AFTER_SECONDS,
          lastReading: last
            ? {
                temperature: last.temp ?? null,
                ph: last.ph ?? null,
                salinity: last.salinity ?? null,
                oxygen: last.oxygen ?? null,
                turbidity: last.turbidity ?? null,
                recordedAt: last.recorded_at,
                source: last.source ?? null,
                deviceId: last.device_id ?? null,
              }
            : null,
          mlReady: last ? missing.length === 0 : false,
          missingFeatures: missing,
          coordinates:
            hwSensor.lat !== null && hwSensor.lng !== null
              ? { lat: hwSensor.lat, lng: hwSensor.lng }
              : null,
          // Self-reported by the device (session-scoped, may be absent).
          diagnostics: getDeviceDiagnostics("esp32_001"),
        };
      }
    } catch { /* hardware stays { registered: false } */ }

    return res.json({
      generatedAt: new Date().toISOString(),
      services: {
        api: { status: "healthy", uptimeSeconds: Math.round(process.uptime()) },
        database: { status: "healthy", latencyMs: dbLatencyMs },
        mlWorker: { status: mlLifecycle, ready: mlWorker.isReady() },
        eventBus: {
          status: busStatus,
          published: bus.published,
          delivered: bus.delivered,
          failed: bus.failed,
          retried: bus.retried,
          deadLettered: bus.deadLettered,
          queueSize: bus.queueSize,
        },
        sse: {
          status: "live",
          clients: sse.activeClients,
          eventsBroadcast: (sse as any).eventsBroadcast ?? 0,
        },
      },
      operations: {
        sensors: { total: sensorsTotal, online: sensorsOnline, offline: sensorsTotal - sensorsOnline },
        drones,
        inspections: { active: inspectionsActive, completedToday: inspectionsCompletedToday, total: inspectionsTotal },
        alerts: { today: alertsToday, critical: alertsCritical, unresolved: alertsUnresolved },
        evidence: { today: evidenceToday, total: evidenceTotal },
      },
      pipeline: {
        ingestion: { active: isSensorPipelineActive() },
        mlInference: getMlInferenceStats(),
        sensorToAlert: getPipelineStats(),
        dispatcher: { missionActive: dispatcher?.isInspectionActive() ?? false },
      },
      performance: {
        // Honestly labeled: assembly time of THIS endpoint, not global API latency.
        intelligenceEndpointMs: Date.now() - t0,
        database: { queryLatencyMs: dbLatencyMs },
      },
      models: {
        anomaly: anomalyArtifact
          ? {
              available: true,
              model: anomalyArtifact.model ?? null,
              evaluationType: anomalyArtifact.evaluationType ?? "synthetic-validation",
              precision: anomalyArtifact.precision ?? null,
              recall: anomalyArtifact.recall ?? null,
              f1: anomalyArtifact.f1 ?? null,
              falsePositiveRate: anomalyArtifact.falsePositiveRate ?? null,
              falseNegativeRate: anomalyArtifact.falseNegativeRate ?? null,
              confusionMatrix: anomalyArtifact.confusionMatrix ?? null,
              dataset: anomalyArtifact.dataset ?? null,
              disclaimer: anomalyArtifact.disclaimer ?? null,
            }
          : { available: false },
        species: speciesArtifact
          ? {
              available: true,
              model: speciesArtifact.approach ?? null,
              evaluationType: "hold-out validation",
              validationSamples: speciesArtifact.validationSamples ?? null,
              validationAccuracy: speciesArtifact.validationAccuracy ?? null,
              macroF1: speciesArtifact.macroF1 ?? null,
              weightedF1: speciesArtifact.weightedF1 ?? null,
              classCount: speciesArtifact.classCount ?? null,
              dataset: speciesArtifact.dataset ?? null,
            }
          : { available: false },
      },
      lastIncident,
      hardware,
      // Session/runtime vision telemetry only (counters reset on restart).
      vision: {
        sourceType: visionSource?.sourceType ?? null,
        state: visionSource?.state ?? "DISABLED",
        cameraId: visionSource?.cameraId ?? null,
        connected: visionSource?.connected ?? false,
        framesCaptured: vision.framesCaptured,
        framesProcessed: vision.framesProcessed,
        framesDropped: vision.framesDropped,
        queueDepth: vision.queueDepth,
        avgInferenceMs: vision.avgInferenceMs,
        avgCaptureLatencyMs: visionCaptureAvg,
        deviceInfo: (visionSource as any)?.deviceInfo ?? null,
        captureStats: (visionSource as any)?.captureStats ?? null,
        lastFrameAt: vision.lastFrameAt,
        lastFrameId: vision.lastFrameId,
        lastQualityStatus: vision.lastQualityStatus,
        measuredFps: vision.measuredFps,
        cameraConnected: visionSource?.connected ?? false,
        rovTelemetryAvailable: false,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to assemble system intelligence" });
  }
});

export default router;
