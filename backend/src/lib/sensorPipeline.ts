/**
 * DeepSea Sensor Data Pipeline
 * ==============================
 * Ye Worker service hai jo EventBus se sensor readings consume karti hai,
 * ML inference run karti hai, database mein store karti hai, aur
 * SSE ke through dashboard ko push karti hai.
 *
 * Flow:
 *   1. Sensor POST /api/sensors/ingest → EventBus publish("sensor.reading")
 *   2. THIS WORKER → subscribe("sensor.reading")
 *   3. mlWorker.predict(data) → ~1-5ms (model already in RAM)
 *   4. SQLite mein store karo (sensor_readings table)
 *   5. Agar anomaly → EventBus publish("ml.anomaly") + store alert
 *   6. sseManager.broadcast() → sabhi dashboard clients ko push
 *
 * Ye Kafka Consumer Group ka MVP simulation hai.
 */

import { eventBus, TOPICS, SensorReadingEvent, AnomalyEvent } from "./eventBus";
import { mlWorker } from "./mlWorker";
import { sseManager } from "./sseManager";
import { getDb } from "../db";
import { selectDrone, MIN_BATTERY_PCT, formatEta } from "./droneSelection";
import { analyseFrame } from "./inspectionAI";
const searoute = require("searoute-js");

let isInitialized = false;

// Only one anomaly-response inspection at a time. The sensor simulator fires
// anomalies every few seconds, and without a guard each new dispatch spawns a
// fresh 30s flight that overwrites the previous mission's state — the camera
// feed would perpetually show IN TRANSIT and never reach the inspection phase.
let activeInspection: { id: string; droneId: string; startedAt: number } | null = null;
const ACTIVE_MISSION_TIMEOUT_MS = 120_000; // safety release if a phase event is lost

/**
 * Test/QA hook: release the single-mission guard so a subsequent dispatch is
 * not suppressed by a mission started in an earlier test. Timers from the old
 * mission keep running harmlessly (they only touch their own inspection id).
 */
export function resetActiveInspectionGuard(): void {
  activeInspection = null;
}

/** Initialize the sensor pipeline worker */
export function initSensorPipeline(): void {
  if (isInitialized) return;
  isInitialized = true;

  console.log("[Pipeline] Sensor data pipeline worker starting...");

  // ── Step 2: Subscribe to sensor readings (like Kafka consumer) ────────────
  eventBus.subscribe<SensorReadingEvent>(TOPICS.SENSOR_READING, async (reading) => {
    const t0 = Date.now();

    try {
      // ── Step 3: ML Inference (sub-5ms, model in RAM) ──────────────────────
      const mlResult = await mlWorker.predict({
        temperature: reading.temperature ?? 3.5,
        ph:          reading.ph          ?? 8.1,
        salinity:    reading.salinity    ?? 34.5,
        oxygen:      reading.oxygen      ?? 5.0,
        turbidity:   reading.turbidity   ?? 0.5,
      });

      const totalMs = Date.now() - t0;

      // ── Step 4: Store in SQLite time-series table ─────────────────────────
      try {
        const db = getDb();
        db.prepare(`
          INSERT INTO sensor_readings (sensor_id, ph, temp, salinity, oxygen, turbidity, recorded_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          reading.sensorId,
          reading.ph ?? null,
          reading.temperature ?? null,
          reading.salinity ?? null,
          reading.oxygen ?? null,
          reading.turbidity ?? null,
          reading.timestamp
        );

        // Update sensor's last_reading_json
        db.prepare(`
          UPDATE sensors
          SET last_reading_json = ?, updated_at = ?
          WHERE id = ?
        `).run(
          JSON.stringify({
            ph: reading.ph,
            temp: reading.temperature,
            salinity: reading.salinity,
            oxygen: reading.oxygen,
            turbidity: reading.turbidity,
          }),
          reading.timestamp,
          reading.sensorId
        );
      } catch (dbErr: any) {
        // Sensor might not exist in DB yet — that's okay for simulation
        if (!dbErr.message?.includes("FOREIGN KEY")) {
          console.error("[Pipeline] DB error:", dbErr.message);
        }
      }

      // ── Step 5: Broadcast sensor update via SSE ───────────────────────────
      sseManager.broadcast("sensor_update", {
        sensorId:   reading.sensorId,
        sensorName: reading.sensorName,
        reading:    reading,
        isAnomaly:  mlResult.isAnomaly,
        mlScore:    mlResult.score,
        latency_ms: totalMs,
        ts:         reading.timestamp,
      });

      // ── Step 5b: If ANOMALY detected → create alert & broadcast ──────────
      if (mlResult.isAnomaly) {
        const anomalyEvent: AnomalyEvent = {
          sensorId:   reading.sensorId,
          sensorName: reading.sensorName,
          isAnomaly:  true,
          score:      mlResult.score,
          latency_ms: mlResult.latency_ms,
          reading,
          timestamp:  reading.timestamp,
        };

        // Publish to ml.anomaly topic (other consumers can react to this)
        eventBus.publish<AnomalyEvent>(TOPICS.ML_ANOMALY, anomalyEvent);

        // Store alert in DB
        const alertId = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        try {
          const db = getDb();
          db.prepare(`
            INSERT INTO alerts (id, type, message, location, timestamp, read, resolved, category)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?)
          `).run(
            alertId,
            "critical",
            `AI Anomaly Detected — pH ${reading.ph?.toFixed(2)}, Turbidity ${reading.turbidity?.toFixed(1)} NTU`,
            reading.sensorName,
            reading.timestamp,
            "pollution"
          );
        } catch { /* ignore */ }

        // Push real-time anomaly alert via SSE
        sseManager.broadcast("anomaly_alert", {
          id:         alertId,
          sensorId:   reading.sensorId,
          sensorName: reading.sensorName,
          type:       "critical",
          message:    `🚨 CHEMICAL SPILL DETECTED — ${reading.sensorName}`,
          detail:     `pH=${reading.ph?.toFixed(2)}, O₂=${reading.oxygen?.toFixed(1)} mg/L, Turbidity=${reading.turbidity?.toFixed(1)} NTU`,
          score:      mlResult.score,
          latency_ms: mlResult.latency_ms,
          timestamp:  reading.timestamp,
        });

        console.log(`[Pipeline] 🚨 ANOMALY on ${reading.sensorName} — score=${mlResult.score.toFixed(3)}, total=${totalMs}ms`);
      }

    } catch (err: any) {
      console.error("[Pipeline] Worker error:", err.message);
    }
  });

  // ── Subscribe to ml.anomaly for drone auto-dispatch logic ─────────────────
  eventBus.subscribe<AnomalyEvent>(TOPICS.ML_ANOMALY, (anomaly) => {
    try {
      const db = getDb();

      // 1. Get the sensor's coordinates
      const sensor = db.prepare("SELECT lat, lng FROM sensors WHERE id = ?").get(anomaly.sensorId) as any;
      if (!sensor) return;

      // ── Single-mission guard first: one inspection at a time ──────────────
      if (activeInspection) {
        const age = Date.now() - activeInspection.startedAt;
        if (age < ACTIVE_MISSION_TIMEOUT_MS) {
          console.log(`[Pipeline] ⏭️ Dispatch suppressed — inspection ${activeInspection.id} still in progress (${Math.round(age / 1000)}s)`);
          return;
        }
        console.log("[Pipeline] ⏱️ Stale active inspection record — releasing");
        activeInspection = null;
      }

      // ── Deterministic drone selection (see lib/droneSelection.ts) ─────────
      const candidates = db.prepare(
        "SELECT id, name, lat, lng, battery, status FROM drones"
      ).all() as any[];
      const selection = selectDrone(candidates, {
        targetLat: sensor.lat,
        targetLng: sensor.lng,
      });

      if (!selection) {
        const idleCount = candidates.filter((d) => d.status === "idle").length;
        const message = idleCount === 0
          ? `No drones available for dispatch to ${anomaly.sensorName} — fleet fully engaged`
          : `No eligible drone for ${anomaly.sensorName} — available drones below ${MIN_BATTERY_PCT}% battery`;
        console.warn(`[Pipeline] ❌ ${message}`);
        sseManager.broadcast("dispatch_unavailable", {
          sensorId: anomaly.sensorId,
          sensorName: anomaly.sensorName,
          reason: idleCount === 0 ? "fleet_engaged" : "battery_insufficient",
          message,
          timestamp: new Date().toISOString(),
        });
        try {
          db.prepare(`
            INSERT INTO alerts (id, type, message, location, timestamp, read, resolved, category)
            VALUES (?, 'warning', ?, ?, ?, 0, 0, 'response')
          `).run(
            `alert-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            message, anomaly.sensorName, new Date().toISOString()
          );
        } catch { /* ignore */ }
        return;
      }

      const drone = selection.selected;
      console.log(
        `[Pipeline] 🚁 Dispatching drone ${drone.name} to sensor ${anomaly.sensorName} — ` +
        `${selection.distanceKm} km, battery ${drone.battery}%, ETA ${formatEta(selection.etaSeconds)} (${selection.reason})`
      );

      // ── Determine coordinates & maritime route ───────────────────────────
      let currentLat = drone.lat;
      let currentLng = drone.lng;
      const targetLat = sensor.lat;
      const targetLng = sensor.lng;

      // Generate maritime route to avoid land
      const originFeature = {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [currentLng, currentLat] }
      };
      const destFeature = {
        type: "Feature",
        properties: {},
        geometry: { type: "Point", coordinates: [targetLng, targetLat] }
      };

      // Generate maritime route to avoid land. searoute-js returns a Point
      // geometry (or throws) when origin and destination are close together,
      // which crashes dispatch with "coordinates must be an array of two or
      // more positions" — fall back to a direct two-point path in that case.
      let pathCoordinates: { lng: number; lat: number }[];
      try {
        const route = searoute(originFeature, destFeature);
        const coords: number[][] =
          route?.geometry?.type === "LineString" ? route.geometry.coordinates : [];
        pathCoordinates =
          coords.length >= 2
            ? coords.map((coord) => ({ lng: coord[0], lat: coord[1] }))
            : [
                { lng: currentLng, lat: currentLat },
                { lng: targetLng, lat: targetLat },
              ];
      } catch {
        console.warn("[Pipeline] searoute failed — using direct origin→destination path");
        pathCoordinates = [
          { lng: currentLng, lat: currentLat },
          { lng: targetLng, lat: targetLat },
        ];
      }

      // ── Mark drone as responding ────────────────────────────────────────
      const startedAt = new Date().toISOString();
      try {
        db.prepare("UPDATE drones SET status = 'active', last_update = ? WHERE id = ?").run(
          startedAt, drone.id
        );
      } catch { /* DB busy — SSE will still broadcast */ }

      // ── Create the inspection record (reactive mission lifecycle) ─────────
      // Lifecycle: en_route → arrived → inspecting → complete | aborted
      const inspectionId = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      activeInspection = { id: inspectionId, droneId: drone.id, startedAt: Date.now() };
      try {
        db.prepare(`
          INSERT INTO drone_inspections
            (id, drone_id, drone_name, sensor_id, sensor_name, phase, eta_seconds, progress,
             target_lat, target_lng, origin_lat, origin_lng, route_json, started_at,
             selection_reason, distance_km)
          VALUES (?, ?, ?, ?, ?, 'en_route', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          inspectionId, drone.id, drone.name, anomaly.sensorId, anomaly.sensorName,
          selection.etaSeconds, targetLat, targetLng, currentLat, currentLng,
          JSON.stringify(pathCoordinates), startedAt,
          selection.reason, selection.distanceKm
        );
      } catch (inspErr: any) {
        console.warn("[Pipeline] Could not create inspection record:", inspErr.message);
      }

      // Link the inspection to the most recent unresolved alert for this sensor.
      let alertId: string | null = null;
      try {
        const alertRow = db.prepare(
          "SELECT id FROM alerts WHERE resolved = 0 AND location = ? ORDER BY timestamp DESC LIMIT 1"
        ).get(anomaly.sensorName) as any;
        if (alertRow) {
          alertId = alertRow.id;
          db.prepare("UPDATE drone_inspections SET alert_id = ? WHERE id = ?").run(alertId, inspectionId);
        }
      } catch { /* linkage is best-effort */ }

      // Broadcast the dispatch event — include target coordinates for map path
      sseManager.broadcast("drone_dispatch", {
        reason:       "anomaly_detected",
        inspectionId: inspectionId,
        targetSensor: anomaly.sensorId,
        location:     anomaly.sensorName,
        droneId:      drone.id,
        droneName:    drone.name,
        eta_seconds:  selection.etaSeconds,
        eta_display:  formatEta(selection.etaSeconds),
        distance_km:  selection.distanceKm,
        battery:      drone.battery,
        selection_reason: selection.reason,
        timestamp:    anomaly.timestamp,
        targetLat:    targetLat,
        targetLng:    targetLng,
        originLat:    currentLat,
        originLng:    currentLng,
        path:         pathCoordinates,
      });

      // ── Step 4: Live flight simulation along the maritime route ───────────
      // We will move through the pathCoordinates array over 30 seconds
      const totalSteps = 15;
      const pathPoints = pathCoordinates.length;
      let stepCount = 0;

      const movementInterval = setInterval(() => {
        stepCount++;

        // Interpolate progress along the path coordinates
        const progress = Math.min(100, Math.round((stepCount / totalSteps) * 100));
        const targetIndex = Math.min(Math.floor((stepCount / totalSteps) * (pathPoints - 1)), pathPoints - 1);

        // For smoother animation, we could interpolate between two points, but for
        // simulation jumping to the nearest waypoint is sufficient.
        currentLat = pathCoordinates[targetIndex].lat;
        currentLng = pathCoordinates[targetIndex].lng;

        // ALWAYS broadcast SSE first (map updates even if DB is busy)
        sseManager.broadcast("drone_update", {
          id: drone.id,
          name: drone.name,
          lat: currentLat,
          lng: currentLng,
          status: 'active',
          battery: Math.max(0, drone.battery - stepCount),
          inspectionId,
          phase: 'en_route',
          progress,
        });

        try {
          db.prepare("UPDATE drone_inspections SET progress = ? WHERE id = ?").run(progress, inspectionId);
        } catch { /* ignore */ }

        // Best-effort DB update (skip silently if locked)
        try {
          db.prepare("UPDATE drones SET lat = ?, lng = ?, last_update = ? WHERE id = ?").run(
            currentLat, currentLng, new Date().toISOString(), drone.id
          );
        } catch { /* DB temporarily locked — SSE already sent */ }

        if (stepCount >= totalSteps) {
          clearInterval(movementInterval);
          beginInspection();
        }
      }, 2000);

      // ── Step 5: On-site inspection simulation ─────────────────────────────
      // The drone holds station over the anomaly while the camera feed captures
      // simulated environmental threats. Findings stream as SSE events, then the
      // incident is classified and recorded (Step 7).
      function beginInspection(): void {
        sseManager.broadcast("drone_update", {
          id: drone.id,
          name: drone.name,
          lat: targetLat,
          lng: targetLng,
          status: 'active',
          battery: Math.max(0, drone.battery - totalSteps),
          inspectionId,
          phase: 'arrived',
          progress: 100,
        });
        sseManager.broadcast("inspection_phase", {
          inspectionId,
          droneId: drone.id,
          droneName: drone.name,
          phase: 'arrived',
          location: anomaly.sensorName,
          message: `🚁 ${drone.name} arrived at ${anomaly.sensorName} — beginning camera inspection`,
          timestamp: new Date().toISOString(),
        });
        try {
          db.prepare("UPDATE drone_inspections SET phase = 'arrived', progress = 100 WHERE id = ?").run(inspectionId);
        } catch { /* ignore */ }

        // ── Simulated threat findings from the drone camera ─────────────────
        // NOTE: these are heuristic DEMO DETECTIONS, not model outputs. Only
        // the marine-species classification below runs a real trained model.
        const threatLibrary: { kind: string; label: string; confidence: number; detail: string }[] = [
          { kind: "oil_film",       label: "Oil/Chemical Film",       confidence: 0.91, detail: "Iridescent surface sheen consistent with hydrocarbon contamination" },
          { kind: "chemical_plume", label: "Chemical Plume",          confidence: 0.89, detail: "Discoloration plume advecting from the anomaly epicenter" },
          { kind: "debris_field",   label: "Floating Debris Field",   confidence: 0.86, detail: "Multiple buoyant objects aggregated in the convergence zone" },
          { kind: "algae_bloom",    label: "Algal Bloom",             confidence: 0.83, detail: "Green discoloration suggesting eutrophication response" },
          { kind: "microplastic",   label: "Microplastic Aggregates", confidence: 0.78, detail: "High turbidity particles consistent with plastic breakdown" },
        ];

        // Threats detected scale with the ML anomaly score (stronger anomaly → more findings).
        const score = Math.abs(anomaly.score ?? 0.5);
        const findingsCount = Math.min(4, Math.max(2, Math.round(score * 6)));
        const findings = threatLibrary
          .sort(() => Math.random() - 0.5)
          .slice(0, findingsCount);

        // Canonical inspection lifecycle event + legacy phase alias.
        const emitProgress = (progress: number, label: string, at: string) => {
          sseManager.broadcast("inspection_progress", { inspectionId, droneId: drone.id, progress, label, timestamp: at });
          try {
            db.prepare("UPDATE drone_inspections SET progress = ?, progress_label = ? WHERE id = ?").run(progress, label, inspectionId);
          } catch { /* ignore */ }
        };

        const startedTs = new Date().toISOString();
        sseManager.broadcast("inspection_started", {
          inspectionId,
          droneId: drone.id,
          droneName: drone.name,
          location: anomaly.sensorName,
          mission: "Marine Threat Inspection",
          timestamp: startedTs,
        });
        emitProgress(5, "Initializing", startedTs);

        setTimeout(() => emitProgress(20, "Sonar sweep", new Date().toISOString()), 1200);
        setTimeout(() => emitProgress(40, "Camera scan", new Date().toISOString()), 2400);

        try {
          db.prepare("UPDATE drone_inspections SET phase = 'inspecting' WHERE id = ?").run(inspectionId);
        } catch { /* ignore */ }

        // ── AI frame analysis: the REAL species classifier on a sample frame ──
        setTimeout(() => {
          analyseFrame()
            .then((detection) => {
              if (!detection) return; // degrade to heuristic findings only
              const capturedAt = new Date().toISOString();
              try {
                db.prepare(`
                  INSERT INTO inspection_evidence
                    (id, inspection_id, kind, label, confidence, detail, captured_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                  `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  inspectionId, detection.kind, detection.label,
                  detection.confidence, detection.detail, capturedAt
                );
              } catch { /* ignore */ }
              sseManager.broadcast("ai_detection", { inspectionId, droneId: drone.id, ...detection, capturedAt });
              sseManager.broadcast("evidence_captured", {
                inspectionId,
                droneId: drone.id,
                kind: detection.kind,
                label: detection.label,
                // evidence_captured consumers treat confidence as a 0–1 fraction
                // (threat findings are 0–1); ai_detection keeps the percentage.
                confidence: detection.confidence / 100,
                detail: detection.detail,
                simulation: true,
                capturedAt,
              });
              console.log(`[Pipeline] 🧠 AI detection: ${detection.label} (${detection.confidence}%) [simulation]`);
            })
            .catch(() => { /* classifier unavailable — heuristic findings only */ });
        }, 3000);

        // Stream each finding ~3s apart with jitter so the camera feed scans
        // live rather than arriving as a bulk dump.
        findings.forEach((finding, i) => {
          setTimeout(() => {
            const capturedAt = new Date().toISOString();

            // Persist evidence (best-effort)
            try {
              db.prepare(`
                INSERT INTO inspection_evidence
                  (id, inspection_id, kind, label, confidence, detail, captured_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
              `).run(
                `ev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                inspectionId, finding.kind, finding.label,
                finding.confidence, finding.detail, capturedAt
              );
            } catch { /* ignore */ }

            sseManager.broadcast("inspection_finding", {
              inspectionId,
              droneId: drone.id,
              droneName: drone.name,
              kind: finding.kind,
              label: finding.label,
              confidence: finding.confidence,
              detail: finding.detail,
              capturedAt,
            });
            sseManager.broadcast("evidence_captured", {
              inspectionId,
              droneId: drone.id,
              kind: finding.kind,
              label: finding.label,
              confidence: finding.confidence,
              detail: finding.detail,
              simulation: true,
              capturedAt,
            });
          }, (i + 1) * 3000 + Math.random() * 800);
        });

        setTimeout(() => emitProgress(80, "Evidence verification", new Date().toISOString()), findings.length * 3000 + 1000);

        // ── Step 7: Classify the incident and record the response ───────────
        // Severity from the ML score, finding confidence, and finding count.
        const avgConfidence = findings.reduce((a, f) => a + f.confidence, 0) / (findings.length || 1);
        const severityScore = score * 0.5 + avgConfidence * 0.3 + findings.length * 0.06;
        const severity = severityScore >= 0.75 ? "critical" : severityScore >= 0.55 ? "high" : severityScore >= 0.35 ? "medium" : "low";
        const summary = `${findings.length} threat${findings.length === 1 ? "" : "s"} identified at ${anomaly.sensorName}: ${findings.map(f => f.label).join(", ")}. ML anomaly score ${score.toFixed(3)} — severity classified as ${severity}. Recommend containment dispatch and sensor re-sampling within 6 hours.`;

        const completeInspection = () => {
          activeInspection = null; // fleet available for the next anomaly
          const completedAt = new Date().toISOString();
          emitProgress(100, "Inspection complete", completedAt);
          try {
            db.prepare(`
              UPDATE drone_inspections
              SET phase = 'complete', severity = ?, threat_json = ?, summary = ?, completed_at = ?
              WHERE id = ?
            `).run(
              severity, JSON.stringify(findings), summary, completedAt, inspectionId
            );
          } catch { /* ignore */ }

          try {
            db.prepare("UPDATE drones SET status = 'idle', lat = ?, lng = ?, last_update = ? WHERE id = ?").run(
              targetLat, targetLng, completedAt, drone.id
            );
          } catch { /* ignore */ }

          sseManager.broadcast("inspection_phase", {
            inspectionId,
            droneId: drone.id,
            droneName: drone.name,
            phase: 'complete',
            location: anomaly.sensorName,
            severity,
            summary,
            findings,
            message: `✅ Inspection complete at ${anomaly.sensorName} — severity ${severity}, ${findings.length} threats recorded`,
            timestamp: completedAt,
          });
          sseManager.broadcast("inspection_completed", {
            inspectionId,
            droneId: drone.id,
            droneName: drone.name,
            location: anomaly.sensorName,
            severity,
            summary,
            timestamp: completedAt,
          });

          console.log(`[Pipeline] ✅ Inspection ${inspectionId} complete — severity=${severity}, findings=${findings.length}`);
        };

        // Inspection window: findings stream out, then a short grace period.
        const inspectDuration = findings.length * 3000 + 6000;
        setTimeout(completeInspection, inspectDuration);
      }

    } catch (err: any) {
      console.error("[Pipeline] Drone dispatch error:", err.message);
    }
  });

  console.log("[Pipeline] ✅ Sensor pipeline worker ready — subscribed to sensor.reading & ml.anomaly");
}
