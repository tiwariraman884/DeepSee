"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * Late-joiner sync: a tab opened mid-mission missed the live
 * `drone_dispatch` SSE broadcast. Hydrate the current mission (including the
 * full decided searoute) from the persisted inspection row so maps render
 * the path immediately; live `drone_update` events then animate the marker.
 * No-op when a dispatch is already known.
 */
export function useActiveMissionSync() {
  const droneDispatch = useAppStore((s) => s.droneDispatch);
  const setDroneDispatch = useAppStore((s) => s.setDroneDispatch);

  useEffect(() => {
    if (droneDispatch) return;
    let cancelled = false;
    fetch("/api/demo/active-mission")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.active && data.dispatch) {
          setDroneDispatch(data.dispatch);
        }
      })
      .catch(() => {
        // Best-effort only — live SSE remains the primary channel.
      });
    return () => {
      cancelled = true;
    };
  }, [droneDispatch, setDroneDispatch]);
}
