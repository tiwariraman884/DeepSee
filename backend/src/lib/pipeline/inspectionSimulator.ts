/**
 * Inspection Simulator — handles the on-site inspection phase after a drone
 * arrives at an anomaly location. Streams findings via SSE and persists evidence.
 */
import { sseManager } from "../sseManager";
import { getDb } from "../../db";
import { analyseFrame } from "../inspectionAI";

const THREAT_LIBRARY = [
  { kind: "oil_film", label: "Oil/Chemical Film", confidence: 0.91, detail: "Iridescent surface sheen consistent with hydrocarbon contamination" },
  { kind: "chemical_plume", label: "Chemical Plume", confidence: 0.89, detail: "Discoloration plume advecting from the anomaly epicenter" },
  { kind: "debris_field", label: "Floating Debris Field", confidence: 0.86, detail: "Multiple buoyant objects aggregated in the convergence zone" },
  { kind: "algae_bloom", label: "Algal Bloom", confidence: 0.83, detail: "Green discoloration suggesting eutrophication response" },
  { kind: "microplastic", label: "Microplastic Aggregates", confidence: 0.78, detail: "High turbidity particles consistent with plastic breakdown" },
];

export class InspectionSimulator {
  private activeTimers = new Set<NodeJS.Timeout>();

  start(): void {
    console.log("[Pipeline] Inspection simulator started");
  }

  stop(): void {
    for (const timer of this.activeTimers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.activeTimers.clear();
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

    // AI frame analysis
    this.trackTimer(setTimeout(() => {
      analyseFrame()
        .then((detection) => {
          if (!detection) return;
          const capturedAt = new Date().toISOString();
          try {
            getDb().prepare(
              `INSERT INTO inspection_evidence (id, inspection_id, kind, label, confidence, detail, captured_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)`
            ).run(`ev-${Date.now()}`, inspectionId, detection.kind, detection.label, detection.confidence, detection.detail, capturedAt);
          } catch { /* ignore */ }
          sseManager.broadcast("ai_detection", { inspectionId, droneId, ...detection, capturedAt });
          sseManager.broadcast("evidence_captured", {
            inspectionId, droneId, kind: detection.kind, label: detection.label,
            confidence: detection.confidence / 100, detail: detection.detail,
            simulation: true, capturedAt,
          });
        })
        .catch(() => { /* classifier unavailable */ });
    }, 3000));

    // Stream findings
    findings.forEach((finding, i) => {
      this.trackTimer(setTimeout(() => {
        const capturedAt = new Date().toISOString();
        try {
          getDb().prepare(
            `INSERT INTO inspection_evidence (id, inspection_id, kind, label, confidence, detail, captured_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(`ev-${Date.now()}`, inspectionId, finding.kind, finding.label, finding.confidence, finding.detail, capturedAt);
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

    try {
      getDb().prepare("UPDATE drones SET status = 'idle', lat = ?, lng = ?, last_update = ? WHERE id = ?")
        .run(targetLat, targetLng, completedAt, droneId);
    } catch { /* ignore */ }

    sseManager.broadcast("inspection_phase", {
      inspectionId, droneId, droneName, phase: "complete", location: sensorName,
      severity, summary, findings,
      message: `Inspection complete at ${sensorName} — severity ${severity}, ${findings.length} threats recorded`,
      timestamp: completedAt,
    });
    sseManager.broadcast("inspection_completed", {
      inspectionId, droneId, droneName, location: sensorName, severity, summary, timestamp: completedAt,
    });

    console.log(`[Pipeline] Inspection ${inspectionId} complete — severity=${severity}, findings=${findings.length}`);
  }

  private trackTimer<T extends NodeJS.Timeout>(timer: T): T {
    this.activeTimers.add(timer);
    return timer;
  }
}
