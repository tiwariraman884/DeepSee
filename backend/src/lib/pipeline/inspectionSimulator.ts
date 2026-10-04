/**
 * Inspection Simulator — handles the on-site inspection phase after a drone
 * arrives at an anomaly location. Streams findings via SSE and persists evidence.
 */
import { eventBus, TOPICS, InspectionReadyEvent, InspectionCompletedEvent } from "../eventBus";
import { sseManager } from "../sseManager";
import { getDb } from "../../db";
import { visionPipeline, persistVisionEvidence } from "../vision/pipeline";
import { ensureVisionSource } from "../vision/runtime";
import { VisionSourceType } from "../vision/types";

const THREAT_LIBRARY = [
  { kind: "oil_film", label: "Oil/Chemical Film", confidence: 0.91, detail: "Iridescent surface sheen consistent with hydrocarbon contamination" },
  { kind: "chemical_plume", label: "Chemical Plume", confidence: 0.89, detail: "Discoloration plume advecting from the anomaly epicenter" },
  { kind: "debris_field", label: "Floating Debris Field", confidence: 0.86, detail: "Multiple buoyant objects aggregated in the convergence zone" },
  { kind: "algae_bloom", label: "Algal Bloom", confidence: 0.83, detail: "Green discoloration suggesting eutrophication response" },
  { kind: "microplastic", label: "Microplastic Aggregates", confidence: 0.78, detail: "High turbidity particles consistent with plastic breakdown" },
];

export class InspectionSimulator {
  private activeTimers = new Set<NodeJS.Timeout>();
  private unsubscribe: (() => void) | null = null;
  private startedInspections = new Set<string>();

  start(): void {
    // Idempotent: avoid duplicate EventBus listeners on restart.
    if (this.unsubscribe) return;
    this.unsubscribe = eventBus.subscribe<InspectionReadyEvent>(
      TOPICS.DRONE_INSPECTION_READY,
      (payload) => {
        this.beginInspection(payload);
      }
    );
    console.log("[Pipeline] Inspection simulator started — subscribed to drone.inspection_ready");
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.activeTimers.clear();
    this.startedInspections.clear();
  }

  /**
   * Test-only: cancel all pending inspection timers without shutting down.
   * Old mission callbacks become no-ops after this call.
   */
  resetForTests(): void {
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.activeTimers.clear();
    this.startedInspections.clear();
  }

  /**
   * Begin an on-site inspection. Called when a drone arrives at the target.
   */
  beginInspection(params: {
    inspectionId: string;
    droneId: string;
    droneName: string;
    sensorName: string;
    anomalyScore: number;
    targetLat: number;
    targetLng: number;
  }): void {
    // Duplicate-delivery safety: same inspection must never start twice
    // (e.g. EventBus redelivery or double start() subscription).
    if (this.startedInspections.has(params.inspectionId)) return;
    this.startedInspections.add(params.inspectionId);
    // Fresh vision sampling window for this mission (single-mission guard
    // means cross-mission sampling state is meaningless).
    visionPipeline.beginMissionWindow();
    const { inspectionId, droneId, droneName, sensorName, anomalyScore } = params;

    // Broadcast arrival
    sseManager.broadcast("drone_update", {
      id: droneId, name: droneName, lat: params.targetLat, lng: params.targetLng,
      status: "active", inspectionId, phase: "arrived", progress: 100,
    });
    sseManager.broadcast("inspection_phase", {
      inspectionId, droneId, droneName, phase: "arrived", location: sensorName,
      message: `${droneName} arrived at ${sensorName} — beginning camera inspection`,
      timestamp: new Date().toISOString(),
    });

    try {
      getDb().prepare("UPDATE drone_inspections SET phase = 'arrived', progress = 100 WHERE id = ?").run(inspectionId);
    } catch { /* ignore */ }

    // Generate findings
    const score = Math.abs(anomalyScore ?? 0.5);
    const findingsCount = Math.min(4, Math.max(2, Math.round(score * 6)));
    const findings = [...THREAT_LIBRARY].sort(() => Math.random() - 0.5).slice(0, findingsCount);

    // Progress callbacks
    const emitProgress = (progress: number, label: string) => {
      const at = new Date().toISOString();
      sseManager.broadcast("inspection_progress", { inspectionId, droneId, progress, label, timestamp: at });
      try {
        getDb().prepare("UPDATE drone_inspections SET progress = ?, progress_label = ? WHERE id = ?").run(progress, label, inspectionId);
      } catch { /* ignore */ }
    };

    const startedTs = new Date().toISOString();
    sseManager.broadcast("inspection_started", {
      inspectionId, droneId, droneName, location: sensorName,
      mission: "Marine Threat Inspection", timestamp: startedTs,
    });
    emitProgress(5, "Initializing");

    this.trackTimer(setTimeout(() => emitProgress(20, "Sonar sweep"), 1200));
    this.trackTimer(setTimeout(() => emitProgress(40, "Camera scan"), 2400));

    try {
      getDb().prepare("UPDATE drone_inspections SET phase = 'inspecting' WHERE id = ?").run(inspectionId);
    } catch { /* ignore */ }

    // AI frame analysis — routed through the shared vision pipeline with a
    // SIMULATED source frame. Same random sample flow as before (behavior
    // preserved), now wrapped with quality/preprocess/provenance stages
    // around the resident inference call.
    this.trackTimer(setTimeout(() => {
      this.runVisionInspectionFrame(inspectionId, droneId);
    }, 3000));
    // Stream findings
    findings.forEach((finding, i) => {
      this.trackTimer(setTimeout(() => {
        const capturedAt = new Date().toISOString();
        try {
          getDb().prepare(
            `INSERT INTO inspection_evidence (id, inspection_id, kind, label, confidence, detail, captured_at, frame_id, source_type)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).run(`ev-${Date.now()}`, inspectionId, finding.kind, finding.label, finding.confidence, finding.detail, capturedAt, null, VisionSourceType.SIMULATED);
        } catch { /* ignore */ }
        sseManager.broadcast("inspection_finding", {
          inspectionId, droneId, droneName, ...finding, capturedAt,
        });
        sseManager.broadcast("evidence_captured", {
          inspectionId, droneId, ...finding, simulation: true, capturedAt,
        });
      }, (i + 1) * 3000 + Math.random() * 800));
    });

    this.trackTimer(setTimeout(() => emitProgress(80, "Evidence verification"), findings.length * 3000 + 1000));

    // Complete inspection
    const avgConfidence = findings.reduce((a, f) => a + f.confidence, 0) / (findings.length || 1);
    const severityScore = score * 0.5 + avgConfidence * 0.3 + findings.length * 0.06;
    const severity = severityScore >= 0.75 ? "critical" : severityScore >= 0.55 ? "high" : severityScore >= 0.35 ? "medium" : "low";
    const summary = `${findings.length} threat${findings.length === 1 ? "" : "s"} identified at ${sensorName}: ${findings.map((f) => f.label).join(", ")}. ML anomaly score ${score.toFixed(3)} — severity classified as ${severity}.`;

    const inspectDuration = findings.length * 3000 + 6000;
    this.trackTimer(setTimeout(() => {
      this.completeInspection(inspectionId, droneId, droneName, sensorName, severity, summary, findings, params.targetLat, params.targetLng);
    }, inspectDuration));

    // Watchdog: if this inspection never reaches completion (crashed timers,
    // wedged inference), drain any leftover vision frames so the bounded
    // queue cannot pin memory and camera resources are verifiably released.
    // Camera adapters hold no persistent handles (per-capture processes with
    // timeout kills), so there is nothing else to release.
    this.trackTimer(setTimeout(() => {
      const pending = visionPipeline.getCounters().queueDepth;
      if (pending > 0) {
        console.log(`[Inspection] Watchdog for ${inspectionId}: draining ${pending} leftover frame(s)`);
        visionPipeline.drain().catch(() => {});
      }
    }, Math.max(inspectDuration + 60_000, 120_000)));
  }

  private completeInspection(
    inspectionId: string, droneId: string, droneName: string,
    sensorName: string, severity: string, summary: string,
    findings: { kind: string; label: string; confidence: number; detail: string }[],
    targetLat: number, targetLng: number
  ): void {
    const completedAt = new Date().toISOString();
    sseManager.broadcast("inspection_progress", { inspectionId, droneId, progress: 100, label: "Inspection complete", timestamp: completedAt });

    try {
      getDb().prepare(
        `UPDATE drone_inspections SET phase = 'complete', severity = ?, threat_json = ?, summary = ?, completed_at = ? WHERE id = ?`
      ).run(severity, JSON.stringify(findings), summary, completedAt, inspectionId);
    } catch { /* ignore */ }

    // Return the drone to its mission origin (base), NOT the sensor it just
    // inspected. Leaving it on the target permanently relocated the fleet onto
    // sensor coordinates, so every later dispatch to that sensor was 0 km and
    // the map marker never moved. Origin is read from the inspection record
    // (captured at dispatch time); when unavailable, the current row is kept.
    let returnLat = targetLat;
    let returnLng = targetLng;
    try {
      const insp = getDb()
        .prepare("SELECT origin_lat, origin_lng FROM drone_inspections WHERE id = ?")
        .get(inspectionId) as { origin_lat: number; origin_lng: number } | undefined;
      if (insp && Number.isFinite(insp.origin_lat) && Number.isFinite(insp.origin_lng)) {
        returnLat = insp.origin_lat;
        returnLng = insp.origin_lng;
      }
    } catch { /* keep target as fallback */ }

    try {
      getDb().prepare("UPDATE drones SET status = 'returning', lat = ?, lng = ?, last_update = ? WHERE id = ?")
        .run(returnLat, returnLng, completedAt, droneId);
    } catch { /* ignore */ }

    // Live position for the map: drone heads back to base at mission end.
    sseManager.broadcast("drone_update", {
      id: droneId, name: droneName, lat: returnLat, lng: returnLng,
      status: "returning", inspectionId, phase: "returning", progress: 100,
    });

    // Mark the drone idle at base once it has arrived home (short settle).
    this.trackTimer(setTimeout(() => {
      try {
        getDb().prepare("UPDATE drones SET status = 'idle', last_update = ? WHERE id = ?")
          .run(new Date().toISOString(), droneId);
      } catch { /* ignore */ }
      sseManager.broadcast("drone_update", {
        id: droneId, name: droneName, lat: returnLat, lng: returnLng,
        status: "idle", inspectionId, phase: "idle", progress: 100,
      });
    }, 4000));

    sseManager.broadcast("inspection_phase", {
      inspectionId, droneId, droneName, phase: "complete", location: sensorName,
      severity, summary, findings,
      message: `Inspection complete at ${sensorName} — severity ${severity}, ${findings.length} threats recorded`,
      timestamp: completedAt,
    });
    sseManager.broadcast("inspection_completed", {
      inspectionId, droneId, droneName, location: sensorName, severity, summary, timestamp: completedAt,
    });

    // Internal backend handoff (EventBus, not SSE): release the dispatcher's
    // single-mission guard so the next scenario is accepted immediately.
    // Published only after the DB update above has logically completed.
    eventBus.publish<InspectionCompletedEvent>(TOPICS.DRONE_INSPECTION_COMPLETED, {
      inspectionId,
      droneId,
      timestamp: completedAt,
    });

    console.log(`[Pipeline] Inspection ${inspectionId} complete — severity=${severity}, findings=${findings.length}`);
  }

  /**
   * AI frame step via the shared vision pipeline.
   * The managed camera source produces the frame (SIMULATED by default —
   * same random sample flow as the legacy path; deterministic FIXTURE when
   * configured; hardware adapters degrade gracefully when unavailable).
   * Contract preserved: same evidence columns, same SSE shapes (plus
   * additive frame provenance), silent degrade when nothing is capturable.
   */
  private runVisionInspectionFrame(inspectionId: string, droneId: string): void {
    ensureVisionSource()
      .then((source) => source.captureFrame(inspectionId, 1))
      .then((frame) => {
        const submitted = visionPipeline.submitFrame(frame);
        if (submitted !== "queued") return null; // sampling/queue gate
        return visionPipeline.processNext().then((detection) => ({ detection, frame }));
      })
      .then((result) => {
        if (!result || !result.detection) return;
        persistVisionEvidence({
          inspectionId,
          droneId,
          detection: result.detection,
          frame: result.frame,
        });
      })
      .catch(() => { /* classifier unavailable */ });
  }

  private trackTimer<T extends NodeJS.Timeout>(timer: T): T {
    this.activeTimers.add(timer);
    return timer;
  }
}
