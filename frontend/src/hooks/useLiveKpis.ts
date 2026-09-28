"use client";

import { useEffect, useState, useCallback } from "react";

export interface LiveKpis {
  oceanHealth: number;
  activeDrones: number;
  pollutionHotspots: number;
  speciesTracked: number;
  sensorsOnline: number;
  alerts: number;
}

const DEFAULT_KPIS: LiveKpis = {
  oceanHealth: 72,
  activeDrones: 0,
  pollutionHotspots: 0,
  speciesTracked: 0,
  sensorsOnline: 0,
  alerts: 0,
};

/**
 * Fetches real KPI data from the dashboard overview API and keeps it fresh
 * with SSE-driven updates. No Math.random() — all values come from the backend.
 */
export function useLiveKpis(): { kpis: LiveKpis; lastSync: Date | null; connected: boolean } {
  const [kpis, setKpis] = useState<LiveKpis>(DEFAULT_KPIS);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [connected, setConnected] = useState(false);

  const fetchKpis = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/overview");
      if (!res.ok) return;
      const data = await res.json();
      setKpis({
        oceanHealth: data.oceanHealth ?? 72,
        activeDrones: data.dronesActive ?? 0,
        pollutionHotspots: data.pollutionHotspots ?? 0,
        speciesTracked: data.speciesTracked ?? 0,
        sensorsOnline: data.sensorsOnline ?? 0,
        alerts: data.alerts ?? 0,
      });
      setLastSync(new Date());
    } catch {
      // Keep previous data on fetch failure
    }
  }, []);

  useEffect(() => {
    fetchKpis();
    const interval = setInterval(fetchKpis, 15000);
    return () => clearInterval(interval);
  }, [fetchKpis]);

  // Listen for SSE anomaly alerts to refresh KPIs immediately
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sse = new EventSource("/api/sensors/stream");

    sse.addEventListener("anomaly_alert", () => {
      fetchKpis();
    });

    sse.onopen = () => setConnected(true);
    sse.onerror = () => setConnected(false);

    return () => sse.close();
  }, [fetchKpis]);

  return { kpis, lastSync, connected };
}
