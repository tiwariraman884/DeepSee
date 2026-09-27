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
  targetSensor: string;
  location: string;
  droneId: string;
  eta_seconds: number;
  timestamp: string;
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
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
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
  const [droneDispatch, setDroneDispatch] = useState<DroneDispatchEvent | null>(null);

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

    // ── drone_dispatch ────────────────────────────────────────────────────
    es.addEventListener("drone_dispatch", (e) => {
      const data: DroneDispatchEvent = JSON.parse(e.data);
      setDroneDispatch(data);
      setStatus(prev => ({
        ...prev,
        lastEvent: "drone_dispatch",
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
  }, [addAlert]);

  useEffect(() => {
    connect();

    return () => {
      esRef.current?.close();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connect]);

  return { status, liveReadings, latestAnomaly, droneDispatch };
}
