/**
 * Drone Dispatcher — subscribes to ML anomaly events, selects the best drone,
 * creates inspection missions, and broadcasts dispatch events via SSE.
 */
import { eventBus, TOPICS, AnomalyEvent, InspectionReadyEvent, InspectionCompletedEvent } from "../eventBus";
import { sseManager } from "../sseManager";
import { getDb } from "../../db";
import { selectDrone, MIN_BATTERY_PCT, formatEta } from "../droneSelection";
const searoute = require("searoute-js");

const ACTIVE_MISSION_TIMEOUT_MS = 120_000;

/** Great-circle distance in km (haversine). */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function polylineKm(points: { lat: number; lng: number }[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return total;
}

/** Great-circle interpolation between two points (t in [0,1]). */
function greatCircleInterp(
  lat1: number, lng1: number, lat2: number, lng2: number, t: number
): { lat: number; lng: number } {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const lam1 = toRad(lng1);
  const lam2 = toRad(lng2);
  const dSigma =
    2 * Math.asin(Math.sqrt(Math.sin((phi2 - phi1) / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin((lam2 - lam1) / 2) ** 2));
  if (dSigma < 1e-12) return { lat: lat1, lng: lng1 };
  const a = Math.sin((1 - t) * dSigma) / Math.sin(dSigma);
  const b = Math.sin(t * dSigma) / Math.sin(dSigma);
  const x = a * Math.cos(phi1) * Math.cos(lam1) + b * Math.cos(phi2) * Math.cos(lam2);
  const y = a * Math.cos(phi1) * Math.sin(lam1) + b * Math.cos(phi2) * Math.sin(lam2);
  const z = a * Math.sin(phi1) + b * Math.sin(phi2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lng: toDeg(Math.atan2(y, x)) };
}

/**
 * Resample a path to a smooth dense polyline (~one point per 15 km, clamped
 * to 8–60 points) so the map curve and the 15-step flight animation move
 * continuously instead of jumping between a handful of waypoints.
 */
function densifyPath(points: { lat: number; lng: number }[]): { lat: number; lng: number }[] {
  if (points.length < 2) return points;
  const totalKm = Math.max(polylineKm(points), 0.001);
  const count = Math.min(60, Math.max(8, Math.round(totalKm / 15)));
  // Walk arc-length proportionally across segments.
  const segLens: number[] = [];
  for (let i = 1; i < points.length; i++) {
    segLens.push(haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng));
  }
  const out: { lat: number; lng: number }[] = [];
  for (let i = 0; i < count; i++) {
    const target = (i / (count - 1)) * totalKm;
    let acc = 0;
    let seg = 0;
    while (seg < segLens.length - 1 && acc + segLens[seg] < target) {
      acc += segLens[seg];
      seg++;
    }
    const segLen = Math.max(segLens[seg], 1e-9);
    const t = Math.min(1, Math.max(0, (target - acc) / segLen));
    const a = points[seg];
    const b = points[seg + 1];
    out.push(greatCircleInterp(a.lat, a.lng, b.lat, b.lng, t));
  }
  // Pin exact endpoints (float rounding must not drift the marker).
  out[0] = { ...points[0] };
  out[out.length - 1] = { ...points[points.length - 1] };
  return out;
}

export class DroneDispatcher {
  private unsubscribe: (() => void) | null = null;
  private unsubscribeCompleted: (() => void) | null = null;
  private activeInspection: { id: string; droneId: string; startedAt: number } | null = null;
  private missionTimers = new Set<NodeJS.Timeout>();

  start(): void {
    // Idempotent: avoid duplicate EventBus listeners on restart.
    if (!this.unsubscribe) {
      this.unsubscribe = eventBus.subscribe<AnomalyEvent>(
        TOPICS.ML_ANOMALY,
        (anomaly) => this.handleAnomaly(anomaly)
      );
    }
    if (!this.unsubscribeCompleted) {
      this.unsubscribeCompleted = eventBus.subscribe<InspectionCompletedEvent>(
        TOPICS.DRONE_INSPECTION_COMPLETED,
        (payload) => this.handleInspectionCompleted(payload)
      );
    }
    console.log("[Pipeline] Drone dispatcher started");
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeCompleted?.();
    this.unsubscribeCompleted = null;
    for (const timer of this.missionTimers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.missionTimers.clear();
    this.activeInspection = null;
  }

  resetGuard(): void {
    this.activeInspection = null;
  }

  /**
   * Test-only: reset active mission state and cancel all pending timers.
   * Does NOT shut down the pipeline — just clears mission lifecycle state.
   */
  resetForTests(): void {
    this.activeInspection = null;
    for (const timer of this.missionTimers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.missionTimers.clear();
  }

  /** Check if an inspection is currently active. */
  isInspectionActive(): boolean {
    if (!this.activeInspection) return false;
    const age = Date.now() - this.activeInspection.startedAt;
    return age < ACTIVE_MISSION_TIMEOUT_MS;
  }

  /** Get the current active inspection ID (for scenario tracking). */
  getActiveInspectionId(): string | null {
    return this.activeInspection?.id ?? null;
  }

  /**
   * Release the single-mission guard when the inspection it belongs to
   * completes. The ID check is load-bearing: stale/out-of-order completion
   * events for other inspections must NOT clear the active mission.
   */
  private handleInspectionCompleted(payload: InspectionCompletedEvent): void {
    if (!this.activeInspection) return;
    if (this.activeInspection.id !== payload.inspectionId) return;
    this.activeInspection = null;
    console.log(
      `[Pipeline] Inspection ${payload.inspectionId} completed — mission guard released`
    );
  }

  private handleAnomaly(anomaly: AnomalyEvent): void {
    try {
      const db = getDb();
      const sensor = db.prepare("SELECT lat, lng FROM sensors WHERE id = ?").get(anomaly.sensorId) as any;
      if (!sensor) return;

      // Single-mission guard
      if (this.activeInspection) {
        const age = Date.now() - this.activeInspection.startedAt;
        if (age < ACTIVE_MISSION_TIMEOUT_MS) {
          console.log(`[Pipeline] Dispatch suppressed — inspection ${this.activeInspection.id} still in progress`);
          return;
        }
        this.activeInspection = null;
      }

      // Select drone
      const candidates = db.prepare("SELECT id, name, lat, lng, battery, status FROM drones").all() as any[];
      const selection = selectDrone(candidates, { targetLat: sensor.lat, targetLng: sensor.lng });

      if (!selection) {
        this.handleNoDroneAvailable(anomaly, candidates);
        return;
      }

      this.dispatchDrone(anomaly, sensor, selection);
    } catch (err: any) {
      console.error("[Pipeline] Drone dispatch error:", err.message);
    }
  }

  private handleNoDroneAvailable(anomaly: AnomalyEvent, candidates: any[]): void {
    const idleCount = candidates.filter((d) => d.status === "idle").length;
    const message = idleCount === 0
      ? `No drones available for dispatch to ${anomaly.sensorName} — fleet fully engaged`
      : `No eligible drone for ${anomaly.sensorName} — available drones below ${MIN_BATTERY_PCT}% battery`;
    console.warn(`[Pipeline] ${message}`);
    sseManager.broadcast("dispatch_unavailable", {
      sensorId: anomaly.sensorId,
      sensorName: anomaly.sensorName,
      reason: idleCount === 0 ? "fleet_engaged" : "battery_insufficient",
      message,
      timestamp: new Date().toISOString(),
    });
  }

  private dispatchDrone(anomaly: AnomalyEvent, sensor: any, selection: any): void {
    const db = getDb();
    const drone = selection.selected;
    const targetLat = sensor.lat;
    const targetLng = sensor.lng;
    const currentLat = drone.lat;
    const currentLng = drone.lng;

    // Generate maritime route
    const pathCoordinates = this.computeRoute(currentLat, currentLng, targetLat, targetLng);

    // Mark drone active
    const startedAt = new Date().toISOString();
    try {
      db.prepare("UPDATE drones SET status = 'active', last_update = ? WHERE id = ?").run(startedAt, drone.id);
    } catch { /* DB busy */ }

    // Create inspection record
    const inspectionId = `insp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.activeInspection = { id: inspectionId, droneId: drone.id, startedAt: Date.now() };

    try {
      db.prepare(
        `INSERT INTO drone_inspections
         (id, drone_id, drone_name, sensor_id, sensor_name, phase, eta_seconds, progress,
          target_lat, target_lng, origin_lat, origin_lng, route_json, started_at, selection_reason, distance_km)
         VALUES (?, ?, ?, ?, ?, 'en_route', ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        inspectionId, drone.id, drone.name, anomaly.sensorId, anomaly.sensorName,
        selection.etaSeconds, targetLat, targetLng, currentLat, currentLng,
        JSON.stringify(pathCoordinates), startedAt, selection.reason, selection.distanceKm
      );
    } catch (inspErr: any) {
      console.warn("[Pipeline] Could not create inspection record:", inspErr.message);
    }

    // Link to alert
    try {
      const alertRow = db.prepare(
        "SELECT id FROM alerts WHERE resolved = 0 AND location = ? ORDER BY timestamp DESC LIMIT 1"
      ).get(anomaly.sensorName) as any;
      if (alertRow) {
        db.prepare("UPDATE drone_inspections SET alert_id = ? WHERE id = ?").run(alertRow.id, inspectionId);
      }
    } catch { /* best-effort */ }

    // Broadcast dispatch
    sseManager.broadcast("drone_dispatch", {
      reason: "anomaly_detected",
      inspectionId,
      targetSensor: anomaly.sensorId,
      location: anomaly.sensorName,
      droneId: drone.id,
      droneName: drone.name,
      eta_seconds: selection.etaSeconds,
      eta_display: formatEta(selection.etaSeconds),
      distance_km: selection.distanceKm,
      battery: drone.battery,
      selection_reason: selection.reason,
      timestamp: anomaly.timestamp,
      targetLat, targetLng, originLat: currentLat, originLng: currentLng,
      path: pathCoordinates,
    });

    console.log(
      `[Pipeline] Dispatched drone ${drone.name} to ${anomaly.sensorName} — ${selection.distanceKm} km, ETA ${formatEta(selection.etaSeconds)}`
    );

    // Start flight simulation
    this.simulateFlight(drone, inspectionId, pathCoordinates, targetLat, targetLng, anomaly);
  }

  private computeRoute(lat1: number, lng1: number, lat2: number, lng2: number): { lat: number; lng: number }[] {
    const origin = { lat: lat1, lng: lng1 };
    const target = { lat: lat2, lng: lng2 };
    const directKm = haversineKm(lat1, lng1, lat2, lng2);

    // Co-located endpoints need no routing — a straight (possibly zero-length)
    // segment; the flight loop still animates arrival + progress.
    if (directKm < 1) return [origin, target];

    let routed: { lat: number; lng: number }[] | null = null;
    try {
      const route = searoute(
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lng1, lat1] } },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lng2, lat2] } }
      );
      const coords: number[][] = route?.geometry?.type === "LineString" ? route.geometry.coordinates : [];
      if (coords.length >= 2) {
        routed = coords.map((c) => ({ lng: c[0], lat: c[1] }));
        // Pin endpoints so the flown path starts at the drone and ends at the
        // target — otherwise the marker can jump or appear not to move.
        if (routed[0].lat !== lat1 || routed[0].lng !== lng1) routed.unshift(origin);
        const last = routed[routed.length - 1];
        if (last.lat !== lat2 || last.lng !== lng2) routed.push(target);
      }
    } catch {
      routed = null;
    }

    if (routed) {
      const routedKm = polylineKm(routed);
      // Sanity gate: the searoute network graph occasionally returns absurd
      // detours for short hops (e.g. a 1500 km loop for a 385 km mission).
      // Reject those and fly direct instead of teleporting across the map.
      if (routedKm <= Math.max(2.5 * directKm, directKm + 50)) {
        console.log(`[Pipeline] Maritime route accepted (${routed.length} points, ~${Math.round(routedKm)} km)`);
        return densifyPath(routed);
      }
      console.log(
        `[Pipeline] Sea-route rejected as detour (~${Math.round(routedKm)} km vs ${Math.round(directKm)} km direct) — flying direct transit`
      );
    }
    // Direct great-circle transit, densified so both the map polyline and the
    // 15-step flight animation are smooth instead of jumpy.
    return densifyPath([origin, target]);
  }

  private simulateFlight(
    drone: any,
    inspectionId: string,
    pathCoordinates: { lat: number; lng: number }[],
    targetLat: number,
    targetLng: number,
    anomaly: AnomalyEvent
  ): void {
    const totalSteps = 15;
    // Guard against a degenerate route (origin == target, or a single point):
    // an empty/zero-length path made the drone "fly" with unchanging
    // coordinates, so the marker appeared frozen on the map. Fall back to an
    // explicit origin → target segment so there is always real displacement.
    const path =
      pathCoordinates.length >= 2
        ? pathCoordinates
        : [
            { lat: drone.lat, lng: drone.lng },
            { lat: targetLat, lng: targetLng },
          ];
    const pathPoints = path.length;
    let stepCount = 0;
    let currentLat = path[0].lat;
    let currentLng = path[0].lng;

    const movementInterval = this.trackTimer(setInterval(() => {
      stepCount++;
      const progress = Math.min(100, Math.round((stepCount / totalSteps) * 100));
      const targetIndex = Math.min(Math.floor((stepCount / totalSteps) * (pathPoints - 1)), pathPoints - 1);
      currentLat = path[targetIndex].lat;
      currentLng = path[targetIndex].lng;

      sseManager.broadcast("drone_update", {
        id: drone.id, name: drone.name, lat: currentLat, lng: currentLng,
        status: "active", battery: Math.max(0, drone.battery - stepCount),
        inspectionId, phase: "en_route", progress,
      });

      try {
        getDb().prepare("UPDATE drone_inspections SET progress = ? WHERE id = ?").run(progress, inspectionId);
        getDb().prepare("UPDATE drones SET lat = ?, lng = ?, last_update = ? WHERE id = ?")
          .run(currentLat, currentLng, new Date().toISOString(), drone.id);
      } catch { /* DB locked */ }

      if (stepCount >= totalSteps) {
        clearInterval(movementInterval);
        this.missionTimers.delete(movementInterval);
        // Frontend notification (SSE contract preserved)…
        sseManager.broadcast("inspection_ready", { inspectionId, droneId: drone.id, targetLat, targetLng });
        // …plus the internal backend handoff via EventBus.
        const readyEvent: InspectionReadyEvent = {
          inspectionId,
          droneId: drone.id,
          droneName: drone.name,
          sensorName: anomaly.sensorName,
          anomalyScore: anomaly.score,
          targetLat,
          targetLng,
        };
        eventBus.publish<InspectionReadyEvent>(TOPICS.DRONE_INSPECTION_READY, readyEvent);
        console.log(`[Pipeline] Drone ${drone.name} arrived at ${anomaly.sensorName} — inspection handoff published`);
      }
    }, 2000));
  }

  private trackTimer<T extends NodeJS.Timeout>(timer: T): T {
    this.missionTimers.add(timer);
    return timer;
  }
}
