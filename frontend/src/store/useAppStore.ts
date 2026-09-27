import { create } from "zustand";
import type { TimeHorizon, PollutionEvent, Species, Sensor, Alert } from "@/types";
import { computeOceanHealth } from "@/data/metrics";

export interface HorizonProjection {
  oceanHealth: number;
  pollutionHotspots: number;
  speciesTracked: number;
  changePct: number; // delta vs. baseline (today)
  label: string;
}

// ─── Horizon trend factors ────────────────────────────────────────────────────
// factor > 0 worsens pollution & species decline; < 0 improves them.
const HORIZON_TREND: Record<TimeHorizon, { factor: number; label: string; action: boolean }> = {
  today: { factor: 0, label: "Current", action: false },
  "1m": { factor: 0.08, label: "Projected", action: false },
  "6m": { factor: 0.18, label: "Projected", action: false },
  "1y": { factor: 0.3, label: "Projected", action: false },
  "5y": { factor: -0.12, label: "With Action", action: true },
};

interface AppState {
  selectedRegion: string | null;
  timeHorizon: TimeHorizon;
  dateRange: string;
  activeDrones: number;
  // live data cache (populated by fetchSummary)
  _pollution: PollutionEvent[];
  _species: Species[];
  _sensors: Sensor[];
  _alerts: Alert[];
  _loaded: boolean;
  setRegion: (region: string | null) => void;
  setTimeHorizon: (h: TimeHorizon) => void;
  setDateRange: (range: string) => void;
  fetchSummary: () => Promise<void>;
  addAlert: (alert: Alert) => void;
  getSummary: () => {
    oceanHealth: number;
    pollutionHotspots: number;
    speciesTracked: number;
    sensorsOnline: number;
    alerts: number;
  };
  getHorizonProjection: () => HorizonProjection;
  startLiveUpdates: () => void;
}

function project(
  horizon: TimeHorizon,
  pollution: PollutionEvent[],
  species: Species[],
  sensors: Sensor[],
  baseline: ReturnType<typeof computeOceanHealth>
): HorizonProjection {
  const { factor, label } = HORIZON_TREND[horizon];
  if (factor === 0) {
    return {
      oceanHealth: baseline.overall,
      pollutionHotspots: pollution.length,
      speciesTracked: species.length,
      changePct: 0,
      label,
    };
  }

  const projectedPollution = pollution.map((p) => ({
    ...p,
    severity: Math.max(1, Math.min(10, Math.round(p.severity + factor * 10 * (p.trend === "decreasing" ? -1 : 1)))),
  }));

  const projectedSpecies = species.map((s) => {
    const last = s.population[s.population.length - 1];
    const delta = factor * (s.populationTrend === "increasing" ? -1 : 1) * 0.2 * last;
    const next = Math.max(0, Math.round(last + delta));
    return { ...s, population: [...s.population.slice(1), next] };
  });

  const projectedSensors = sensors.map((s) => ({
    ...s,
    online: factor > 0 ? s.online && s.status !== "offline" : s.online,
  }));

  const score = computeOceanHealth(projectedPollution, projectedSpecies, projectedSensors);
  const changePct = Math.round(((score.overall - baseline.overall) / baseline.overall) * 100);
  const hotspots = factor > 0 ? pollution.length + Math.round(factor * 10) : pollution.length;
  const tracked = factor > 0 ? Math.max(0, species.length - Math.round(factor * 5)) : species.length;

  return { oceanHealth: score.overall, pollutionHotspots: hotspots, speciesTracked: tracked, changePct, label };
}

export const useAppStore = create<AppState>((set, get) => ({
  selectedRegion: null,
  timeHorizon: "today",
  dateRange: "Last 30 days",
  activeDrones: 0,
  _pollution: [],
  _species: [],
  _sensors: [],
  _alerts: [],
  _loaded: false,

  setRegion: (region) => set({ selectedRegion: region }),
  setTimeHorizon: (h) => set({ timeHorizon: h }),
  setDateRange: (range) => set({ dateRange: range }),
  addAlert: (alert) => set((state) => ({ _alerts: [alert, ...state._alerts] })),

  fetchSummary: async () => {
    if (get()._loaded) return;
    try {
      const [pollutionRes, speciesRes, sensorsRes, alertsRes, dronesRes] = await Promise.all([
        fetch("/api/pollution"),
        fetch("/api/species"),
        fetch("/api/sensors"),
        fetch("/api/alerts"),
        fetch("/api/drones"),
      ]);

      const [{ pollution }, { species }, { sensors }, { alerts }, { drones }] = await Promise.all([
        pollutionRes.ok ? pollutionRes.json() : { pollution: [] },
        speciesRes.ok ? speciesRes.json() : { species: [] },
        sensorsRes.ok ? sensorsRes.json() : { sensors: [] },
        alertsRes.ok ? alertsRes.json() : { alerts: [] },
        dronesRes.ok ? dronesRes.json() : { drones: [] },
      ]);

      set({
        _pollution: pollution ?? [],
        _species: species ?? [],
        _sensors: sensors ?? [],
        _alerts: alerts ?? [],
        activeDrones: (drones ?? []).filter((d: { status: string }) => d.status === "active").length,
        _loaded: true,
      });
    } catch {
      set({ _loaded: true });
    }
  },

  startLiveUpdates: () => {
    // Only connect if not running in SSR
    if (typeof window === "undefined") return;
    
    // Check if we already have an EventSource attached to window to prevent duplicates
    if ((window as any)._sensorSSE) return;

    const sse = new EventSource("/api/sensors/live");
    (window as any)._sensorSSE = sse;

    sse.onmessage = (event) => {
      try {
        const liveSensors = JSON.parse(event.data);
        set({ _sensors: liveSensors });
        
        // Auto-detect anomalies in frontend from live data (simple rule or send to predict API)
        // For now, simulator creates sudden large shifts in turbidity/pH
      } catch (e) {
        console.error("Failed to parse SSE data", e);
      }
    };
  },

  getSummary: () => {
    const { _pollution, _species, _sensors, _alerts } = get();
    const baseline = computeOceanHealth(_pollution, _species, _sensors);
    return {
      oceanHealth: baseline.overall,
      pollutionHotspots: _pollution.length,
      speciesTracked: _species.length,
      sensorsOnline: _sensors.filter((s) => s.status === "online").length,
      alerts: _alerts.filter((a) => !a.resolved).length,
    };
  },

  getHorizonProjection: () => {
    const { _pollution, _species, _sensors, timeHorizon } = get();
    const baseline = computeOceanHealth(_pollution, _species, _sensors);
    return project(timeHorizon, _pollution, _species, _sensors, baseline);
  },
}));


