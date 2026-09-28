"use client";

/**
 * useSSEStream — Real-time SSE connection hook
 * =============================================
 * Backend ke /api/sensors/stream se connect karta hai aur
 * real-time events receive karta hai bina page refresh ke.
 *
 * Events:
 *   "sensor_update"  → Naya sensor reading aaya (with ML anomaly flag)
 *   "anomaly_alert"  → 🚨 Chemical spill / anomaly detected
 *   "drone_dispatch" → 🚁 Drone dispatch triggered automatically
 *   "heartbeat"      → Connection alive check
 *   "connected"      → Initial connection confirmed
 */

import { useEffect, useRef, useCallback, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

export interface SensorUpdateEvent {
  sensorId: string;
  sensorName: string;
  reading: {
    temperature?: number;
    ph?: number;
    salinity?: number;
    oxygen?: number;
    turbidity?: number;
    timestamp: string;
  };
  isAnomaly: boolean;
  mlScore: number;
  latency_ms: number;
  ts: string;
}

export interface AnomalyAlertEvent {
  id: string;
  sensorId: string;
  sensorName: string;
  type: "critical" | "warning" | "info";
  message: string;
  detail: string;
  score: number;
  latency_ms: number;
  timestamp: string;
}

export interface DroneDispatchEvent {
  reason: string;
  inspectionId?: string;
  targetSensor: string;
  location: string;
  droneId: string;
  droneName?: string;
  eta_seconds: number;
  timestamp: string;
  targetLat?: number;
  targetLng?: number;
  originLat?: number;
  originLng?: number;
}

export interface DroneUpdateEvent {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  status: string;
  battery?: number;
  /** Present when the update belongs to an anomaly-response inspection. */
  inspectionId?: string;
  phase?: string;
  progress?: number;
}

/** Emitted when the drone reaches the anomaly site and begins inspection. */
export interface InspectionPhaseEvent {
  inspectionId: string;
  droneId: string;
  droneName: string;
  phase: "arrived" | "inspecting" | "complete" | "aborted";
  location: string;
  severity?: string;
  summary?: string;
  findings?: InspectionFinding[];
  message: string;
  timestamp: string;
}

/** A single threat identified by the drone camera during inspection. */
export interface InspectionFinding {
  kind: string;
  label: string;
  confidence: number;
  detail: string;
  capturedAt?: string;
}

export interface SSEStatus {
  connected: boolean;
  clientId: string | null;
  lastEvent: string | null;
  lastEventAt: Date | null;
  reconnectCount: number;
  anomalyCount: number;
}

export function useSSEStream() {
  const addAlert = useAppStore((s) => s.addAlert);
  const setDroneDispatchGlobal = useAppStore((s) => s.setDroneDispatch);
  const updateDronePosition = useAppStore((s) => s.updateDronePosition);
  // Read from global store so state persists across page navigation
  const droneDispatch = useAppStore((s) => s.droneDispatch);
  const dronePositions = useAppStore((s) => s.dronePositions);

  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  // The inspection_finding SSE event does not carry its inspectionId in some
  // fallback paths — remember the most recent active one from drone_update.
  const activeInspectionIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<SSEStatus>({
    connected: false,
    clientId: null,
    lastEvent: null,
    lastEventAt: null,
    reconnectCount: 0,
    anomalyCount: 0,
  });

  // Live sensor readings state (latest N readings for sparklines)
  const [liveReadings, setLiveReadings] = useState<SensorUpdateEvent[]>([]);
  const [latestAnomaly, setLatestAnomaly] = useState<AnomalyAlertEvent | null>(null);

  const connect = useCallback(() => {
    // Close existing connection
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource("/api/sensors/stream");
    esRef.current = es;

    // ── connected ─────────────────────────────────────────────────────────
    es.addEventListener("connected", (e) => {
      const data = JSON.parse(e.data);
      setStatus(prev => ({
        ...prev,
        connected: true,
        clientId: data.clientId,
        lastEvent: "connected",
        lastEventAt: new Date(),
      }));
    });

    // ── sensor_update ─────────────────────────────────────────────────────
    es.addEventListener("sensor_update", (e) => {
      const data: SensorUpdateEvent = JSON.parse(e.data);
      setLiveReadings(prev => {
        const next = [data, ...prev].slice(0, 50);  // Keep last 50 readings
        return next;
      });
      setStatus(prev => ({
        ...prev,
        lastEvent: "sensor_update",
        lastEventAt: new Date(),
      }));
    });

    // ── anomaly_alert ─────────────────────────────────────────────────────
    es.addEventListener("anomaly_alert", (e) => {
      const data: AnomalyAlertEvent = JSON.parse(e.data);
      setLatestAnomaly(data);
      setStatus(prev => ({
        ...prev,
        lastEvent: "anomaly_alert",
        lastEventAt: new Date(),
        anomalyCount: prev.anomalyCount + 1,
      }));

      // Push into global alert store (appears in dashboard alert panel)
      addAlert({
        id:        data.id,
        type:      data.type,
        message:   data.message,
        location:  data.sensorName,
        timestamp: data.timestamp,
        read:      false,
        resolved:  false,
        category:  "pollution",
      });
    });

    // ── drone_dispatch (mission start: selection metadata + timeline) ─────
    es.addEventListener("drone_dispatch", (e) => {
      const data = JSON.parse(e.data) as DroneDispatchEvent & {
        eta_display?: string; distance_km?: number; selection_reason?: string;
      };
      setDroneDispatchGlobal(data);  // persists in global store across pages
      if (data.inspectionId) {
        const store = useAppStore.getState();
        store.setInspectionPhase(data.inspectionId, "en_route", 0);
        store.setInspectionSelection(data.inspectionId, {
          distanceKm: data.distance_km ?? 0,
          etaDisplay: data.eta_display ?? "—",
          reason: data.selection_reason ?? "nearest eligible drone",
          startedAt: data.timestamp,
        });
        store.addInspectionTimeline(
          data.inspectionId,
          `${data.droneName ?? "Drone"} dispatched → ${data.location}` +
          (data.distance_km != null ? ` (${data.distance_km} km · ETA ${data.eta_display ?? "—"})` : "")
        );
      }
      setStatus(prev => ({
        ...prev,
        lastEvent: "drone_dispatch",
        lastEventAt: new Date(),
      }));
    });

    // ── drone_update (live position from auto-dispatch) ───────────────────
    es.addEventListener("drone_update", (e) => {
      const data: DroneUpdateEvent = JSON.parse(e.data);
      updateDronePosition(data);  // persists in global store across pages
      // Track the live inspection phase so the camera feed reacts in real time.
      if (data.inspectionId && data.phase) {
        activeInspectionIdRef.current = data.inspectionId;
        useAppStore.getState().setInspectionPhase(data.inspectionId, data.phase, data.progress);
      }
      setStatus(prev => ({
        ...prev,
        lastEvent: "drone_update",
        lastEventAt: new Date(),
      }));
    });

    // ── inspection_phase (arrived / inspecting / complete) ────────────────
    es.addEventListener("inspection_phase", (e) => {
      const data: InspectionPhaseEvent = JSON.parse(e.data);
      const store = useAppStore.getState();
      store.setInspectionPhase(data.inspectionId, data.phase, data.phase === "complete" ? 100 : undefined);
      store.setInspectionMeta(data.inspectionId, {
        droneId: data.droneId,
        droneName: data.droneName,
        location: data.location,
        severity: data.severity,
        summary: data.summary,
        completedAt: data.phase === "complete" ? data.timestamp : undefined,
      });
      store.addInspectionTimeline(
        data.inspectionId,
        data.phase === "complete"
          ? `Inspection completed — severity ${data.severity ?? "n/a"}`
          : `Drone arrived on site (${data.location})`
      );
      setStatus(prev => ({
        ...prev,
        lastEvent: "inspection_phase",
        lastEventAt: new Date(),
      }));
    });

    // ── inspection_started (canonical lifecycle start) ────────────────────
    es.addEventListener("inspection_started", (e) => {
      const data = JSON.parse(e.data) as { inspectionId: string; mission?: string };
      useAppStore.getState().addInspectionTimeline(
        data.inspectionId,
        `Inspection started${data.mission ? ` (${data.mission})` : ""}`
      );
      setStatus(prev => ({ ...prev, lastEvent: "inspection_started", lastEventAt: new Date() }));
    });

    // ── inspection_progress (0→100 with step labels) ──────────────────────
    es.addEventListener("inspection_progress", (e) => {
      const data = JSON.parse(e.data) as { inspectionId: string; progress: number; label: string };
      useAppStore.getState().setInspectionProgress(data.inspectionId, data.progress, data.label);
      setStatus(prev => ({ ...prev, lastEvent: "inspection_progress", lastEventAt: new Date() }));
    });

    // ── ai_detection (species classifier result on a sample frame) ────────
    es.addEventListener("ai_detection", (e) => {
      const data = JSON.parse(e.data) as { inspectionId: string; label: string; confidence: number; conservation?: string; simulation?: boolean };
      useAppStore.getState().setAiDetection(data.inspectionId, {
        label: data.label,
        confidence: data.confidence,
        conservation: data.conservation,
        simulation: data.simulation ?? true,
      });
      setStatus(prev => ({ ...prev, lastEvent: "ai_detection", lastEventAt: new Date() }));
    });

    // ── evidence_captured (canonical evidence event) ──────────────────────
    es.addEventListener("evidence_captured", (e) => {
      const data = JSON.parse(e.data) as { inspectionId: string; label: string; confidence: number; detail: string; kind: string };
      const store = useAppStore.getState();
      store.addInspectionFinding(data.inspectionId, data);
      store.addInspectionTimeline(
        data.inspectionId,
        `Evidence captured: ${data.label} (${Math.round(data.confidence * 100)}%)`
      );
      setStatus(prev => ({ ...prev, lastEvent: "evidence_captured", lastEventAt: new Date() }));
    });

    // ── inspection_finding (legacy alias of evidence_captured) ────────────
    es.addEventListener("inspection_finding", (e) => {
      const data = JSON.parse(e.data) as InspectionFinding & { inspectionId: string };
      // evidence_captured handles store updates; this legacy listener stays for
      // older backends that only emit inspection_finding.
      useAppStore.getState().addInspectionFinding(data.inspectionId, data);
      setStatus(prev => ({
        ...prev,
        lastEvent: "inspection_finding",
        lastEventAt: new Date(),
      }));
    });

    // ── heartbeat ─────────────────────────────────────────────────────────
    es.addEventListener("heartbeat", () => {
      setStatus(prev => ({
        ...prev,
        connected: true,
        lastEvent: "heartbeat",
        lastEventAt: new Date(),
      }));
    });

    // ── Connection error → auto-reconnect ─────────────────────────────────
    es.onerror = () => {
      setStatus(prev => ({
        ...prev,
        connected: false,
        lastEvent: "error",
        lastEventAt: new Date(),
      }));
      es.close();

      // Reconnect after 3 seconds
      reconnectTimerRef.current = setTimeout(() => {
        setStatus(prev => ({ ...prev, reconnectCount: prev.reconnectCount + 1 }));
        connect();
      }, 3000);
    };
  }, [addAlert, setDroneDispatchGlobal, updateDronePosition]);

  useEffect(() => {
    connect();

    return () => {
      esRef.current?.close();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  return { status, liveReadings, latestAnomaly, droneDispatch, dronePositions };
}
