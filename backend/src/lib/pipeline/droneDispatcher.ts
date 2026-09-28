/**
 * Drone Dispatcher — subscribes to ML anomaly events, selects the best drone,
 * creates inspection missions, and broadcasts dispatch events via SSE.
 */
import { eventBus, TOPICS, AnomalyEvent } from "../eventBus";
import { sseManager } from "../sseManager";
import { getDb } from "../../db";
import { selectDrone, MIN_BATTERY_PCT, formatEta } from "../droneSelection";
const searoute = require("searoute-js");

const ACTIVE_MISSION_TIMEOUT_MS = 120_000;

export class DroneDispatcher {
  private unsubscribe: (() => void) | null = null;
  private activeInspection: { id: string; droneId: string; startedAt: number } | null = null;
  private missionTimers = new Set<NodeJS.Timeout>();

  start(): void {
    this.unsubscribe = eventBus.subscribe<AnomalyEvent>(
      TOPICS.ML_ANOMALY,
      (anomaly) => this.handleAnomaly(anomaly)
    );
    console.log("[Pipeline] Drone dispatcher started");
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
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
    try {
      const route = searoute(
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lng1, lat1] } },
        { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [lng2, lat2] } }
      );
      const coords: number[][] = route?.geometry?.type === "LineString" ? route.geometry.coordinates : [];
      return coords.length >= 2
        ? coords.map((c) => ({ lng: c[0], lat: c[1] }))
        : [{ lng: lng1, lat: lat1 }, { lng: lng2, lat: lat2 }];
    } catch {
      return [{ lng: lng1, lat: lat1 }, { lng: lng2, lat: lat2 }];
    }
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
    const pathPoints = pathCoordinates.length;
    let stepCount = 0;
    let currentLat = pathCoordinates[0].lat;
    let currentLng = pathCoordinates[0].lng;

    const movementInterval = this.trackTimer(setInterval(() => {
      stepCount++;
      const progress = Math.min(100, Math.round((stepCount / totalSteps) * 100));
      const targetIndex = Math.min(Math.floor((stepCount / totalSteps) * (pathPoints - 1)), pathPoints - 1);
      currentLat = pathCoordinates[targetIndex].lat;
      currentLng = pathCoordinates[targetIndex].lng;

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
        // Inspection is handled by InspectionSimulator
        sseManager.broadcast("inspection_ready", { inspectionId, droneId: drone.id, targetLat, targetLng });
      }
    }, 2000));
  }

  private trackTimer<T extends NodeJS.Timeout>(timer: T): T {
    this.missionTimers.add(timer);
    return timer;
  }
}
