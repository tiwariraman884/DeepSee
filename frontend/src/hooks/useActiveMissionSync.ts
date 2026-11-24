"use client";

import { useEffect } from "react";
import {
  useAppStore,
  type DroneDispatchInfo,
  type InspectionState,
} from "@/store/useAppStore";

/**
 * Late-joiner sync: a tab opened mid-mission missed the live
 * `drone_dispatch` SSE broadcast. Hydrate the current mission (including the
 * full decided searoute) from the persisted inspection row so maps render
 * the path immediately; live `drone_update` events then animate the marker.
 *
 * The same endpoint returns a recently completed mission, so the Drone Center
 * still shows the finished route, camera evidence and drone telemetry after
 * the scenario ends instead of falling back to an empty fleet view.
 * No-op when a dispatch is already known.
 */
export function useActiveMissionSync() {
  const droneDispatch = useAppStore((s) => s.droneDispatch);
  const setDroneDispatch = useAppStore((s) => s.setDroneDispatch);
  const setInspection = useAppStore((s) => s.setInspection);
  const updateDronePosition = useAppStore((s) => s.updateDronePosition);

  useEffect(() => {
    if (droneDispatch) return;
    let cancelled = false;
    fetch("/api/demo/active-mission")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.dispatch || !data.inspection) return;
        // A live SSE event may have won the race while this fetch was in flight.
        if (useAppStore.getState().droneDispatch) return;

        const i = data.inspection;
        const dispatch: DroneDispatchInfo = {
          reason: data.dispatch.reason ?? "anomaly_detected",
          targetSensor: data.dispatch.targetSensor ?? i.sensorId,
          location: data.dispatch.location ?? i.sensorName,
          droneId: data.dispatch.droneId ?? i.droneId,
          droneName: data.dispatch.droneName ?? i.droneName,
          eta_seconds: data.dispatch.eta_seconds ?? 0,
          timestamp: data.dispatch.timestamp ?? i.startedAt,
          targetLat: data.dispatch.targetLat,
          targetLng: data.dispatch.targetLng,
          originLat: data.dispatch.originLat,
          originLng: data.dispatch.originLng,
          path: data.dispatch.path,
        };

        const findings = Array.isArray(i.findings)
          ? i.findings.filter(
              (f: any) =>
                f &&
                typeof f.kind === "string" &&
                typeof f.label === "string" &&
                typeof f.confidence === "number" &&
                typeof f.detail === "string"
            )
          : [];

        const timeline = [
          {
            time: i.startedAt,
            message: `Dispatched ${i.droneName} to ${i.sensorName}`,
          },
        ];
        if (i.completedAt) {
          timeline.push({
            time: i.completedAt,
            message: `Inspection complete${i.severity ? ` — ${i.severity} severity` : ""}`,
          });
        }

        const inspection: InspectionState = {
          id: i.id,
          phase: i.phase,
          progress: i.progress ?? 0,
          progressLabel: i.progressLabel ?? undefined,
          droneId: i.droneId,
          droneName: i.droneName,
          location: i.sensorName,
          severity: i.severity ?? undefined,
          summary: i.summary ?? undefined,
          completedAt: i.completedAt ?? undefined,
          startedAt: i.startedAt,
          selection: i.selection
            ? {
                distanceKm: Number(i.selection.distanceKm) || 0,
                etaDisplay: i.selection.etaDisplay ?? "—",
                reason: i.selection.reason ?? "",
              }
            : undefined,
          findings,
          timeline,
        };

        setInspection(inspection);
        setDroneDispatch(dispatch);
        if (data.drone?.id) {
          updateDronePosition({
            ...data.drone,
            inspectionId: i.id,
            phase: i.phase,
            progress: i.progress ?? 0,
          });
        }
      })
      .catch(() => {
        // Best-effort only — live SSE remains the primary channel.
      });
    return () => {
      cancelled = true;
    };
  }, [droneDispatch, setDroneDispatch, setInspection, updateDronePosition]);
}
