"use client";

import { useEffect, useRef, useCallback } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * Robust SSE connection hook with automatic reconnection, exponential backoff,
 * and event-driven store updates. Replaces the basic EventSource usage.
 */
export function useSSEStream() {
  const store = useAppStore();
  const retryCount = useRef(0);
  const maxRetries = 10;
  const baseDelay = 1000;
  const maxDelay = 30000;
  const eventSourceRef = useRef<EventSource | null>(null);
  const isConnecting = useRef(false);

  const connect = useCallback(() => {
    if (isConnecting.current) return;
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    isConnecting.current = true;
    const sse = new EventSource("/api/sensors/stream");
    eventSourceRef.current = sse;

    sse.onopen = () => {
      isConnecting.current = false;
      retryCount.current = 0;
      store.setSseConnected(true);
      console.log("[SSE] Connected");
    };

    sse.onerror = () => {
      isConnecting.current = false;
      store.setSseConnected(false);
      sse.close();

      if (retryCount.current < maxRetries) {
        const delay = Math.min(baseDelay * Math.pow(2, retryCount.current), maxDelay);
        retryCount.current++;
        console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${retryCount.current}/${maxRetries})`);
        setTimeout(connect, delay);
      } else {
        console.error("[SSE] Max reconnection attempts reached");
      }
    };

    // Sensor updates
    sse.addEventListener("sensor_update", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        // Update store with live sensor data
        useAppStore.setState((state) => ({
          _sensors: state._sensors.map((s) =>
            s.id === data.sensorId ? { ...s, lastReading: data.reading, updatedAt: data.ts } : s
          ),
        }));
      } catch (e) {
        console.error("[SSE] Failed to parse sensor_update", e);
      }
    });

    // Anomaly alerts
    sse.addEventListener("anomaly_alert", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        store.addAlert({
          id: data.id,
          type: data.type,
          message: data.message,
          location: data.location,
          timestamp: data.timestamp,
          read: false,
          resolved: false,
          category: "pollution",
        });
      } catch (e) {
        console.error("[SSE] Failed to parse anomaly_alert", e);
      }
    });

    // Drone dispatch
    sse.addEventListener("drone_dispatch", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        store.setDroneDispatch(data);
      } catch (e) {
        console.error("[SSE] Failed to parse drone_dispatch", e);
      }
    });

    // Drone position updates
    sse.addEventListener("drone_update", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        store.updateDronePosition(data);
      } catch (e) {
        console.error("[SSE] Failed to parse drone_update", e);
      }
    });

    // Inspection phase changes
    sse.addEventListener("inspection_phase", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        store.setInspectionPhase(data.inspectionId, data.phase);
        store.addInspectionTimeline(data.inspectionId, data.message);
      } catch (e) {
        console.error("[SSE] Failed to parse inspection_phase", e);
      }
    });

    // Inspection progress
    sse.addEventListener("inspection_progress", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        store.setInspectionProgress(data.inspectionId, data.progress, data.label);
      } catch (e) {
        console.error("[SSE] Failed to parse inspection_progress", e);
      }
    });

    // Inspection findings
    sse.addEventListener("inspection_finding", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        store.addInspectionFinding(data.inspectionId, {
          kind: data.kind,
          label: data.label,
          confidence: data.confidence,
          detail: data.detail,
        });
      } catch (e) {
        console.error("[SSE] Failed to parse inspection_finding", e);
      }
    });

    // AI detection
    sse.addEventListener("ai_detection", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        store.setAiDetection(data.inspectionId, {
          label: data.label,
          confidence: data.confidence,
          conservation: data.conservation,
          simulation: data.simulation,
        });
      } catch (e) {
        console.error("[SSE] Failed to parse ai_detection", e);
      }
    });

    // Inspection completed
    sse.addEventListener("inspection_completed", (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        store.setInspectionMeta(data.inspectionId, {
          severity: data.severity,
          summary: data.summary,
          completedAt: data.timestamp,
        });
      } catch (e) {
        console.error("[SSE] Failed to parse inspection_completed", e);
      }
    });

    // Heartbeat — keep connection alive
    sse.addEventListener("heartbeat", () => {
      // Connection is alive, no action needed
    });
  }, [store]);

  useEffect(() => {
    connect();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [connect]);
}
