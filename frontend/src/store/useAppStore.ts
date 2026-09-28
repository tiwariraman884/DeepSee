import { create } from "zustand";
import type { TimeHorizon, PollutionEvent, Species, Sensor, Alert } from "@/types";
import { computeOceanHealth } from "@/data/metrics";

export interface DroneDispatchInfo {
  reason: string;
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
  path?: { lat: number; lng: number }[];
}

export interface DronePositionInfo {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  status: string;
  battery?: number;
  inspectionId?: string;
  phase?: string;
  progress?: number;
}

/** Live state of an anomaly-response inspection mission. */
export interface InspectionState {
  id: string;
  phase: string;
  progress: number;
  progressLabel?: string;
  droneId: string;
  droneName: string;
  location: string;
  severity?: string;
  summary?: string;
  completedAt?: string;
  startedAt?: string;
  /** Dispatch decision metadata (deterministic selection, explainable). */
  selection?: { distanceKm: number; etaDisplay: string; reason: string };
  /** Species-AI result from the simulated frame analysis (real model, simulated frame). */
  aiDetection?: { label: string; confidence: number; conservation?: string; simulation: boolean };
  findings: { kind: string; label: string; confidence: number; detail: string }[];
  /** Mission timeline entries (newest last). */
  timeline: { time: string; message: string }[];
}

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
  // Global drone tracking — persists across page navigation
  droneDispatch: DroneDispatchInfo | null;
  dronePositions: Record<string, DronePositionInfo>;
  // Live anomaly-response inspection (one at a time is enough for the demo UI)
  inspection: InspectionState | null;
  setRegion: (region: string | null) => void;
  setTimeHorizon: (h: TimeHorizon) => void;
  setDateRange: (range: string) => void;
  fetchSummary: () => Promise<void>;
  addAlert: (alert: Alert) => void;
  setDroneDispatch: (d: DroneDispatchInfo | null) => void;
  updateDronePosition: (d: DronePositionInfo) => void;
  setInspectionPhase: (id: string, phase: string, progress?: number) => void;
  setInspectionMeta: (id: string, meta: Partial<Pick<InspectionState, "droneId" | "droneName" | "location" | "severity" | "summary" | "completedAt">>) => void;
  addInspectionFinding: (id: string, finding: { kind: string; label: string; confidence: number; detail: string }) => void;
  setInspectionSelection: (id: string, sel: { distanceKm: number; etaDisplay: string; reason: string; startedAt: string }) => void;
  setInspectionProgress: (id: string, progress: number, label: string) => void;
  setAiDetection: (id: string, d: { label: string; confidence: number; conservation?: string; simulation: boolean }) => void;
  addInspectionTimeline: (id: string, message: string) => void;
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
  droneDispatch: null,
  dronePositions: {},
  inspection: null,

  setRegion: (region) => set({ selectedRegion: region }),
  setTimeHorizon: (h) => set({ timeHorizon: h }),
  setDateRange: (range) => set({ dateRange: range }),
  addAlert: (alert) =>
    set((state) => {
      // SSE reconnects replay events that are already in the list, and the same
      // alert can arrive from both the SSE stream and a REST refresh. Prepending
      // blindly produced duplicate React keys, so replace-if-present instead.
      const existing = state._alerts.findIndex((a) => a.id === alert.id);
      if (existing !== -1) {
        const next = state._alerts.slice();
        next[existing] = alert;
        return { _alerts: next };
      }
      return { _alerts: [alert, ...state._alerts] };
    }),
  setDroneDispatch: (d) => set({ droneDispatch: d }),
  updateDronePosition: (d) => set((state) => ({ dronePositions: { ...state.dronePositions, [d.id]: d } })),

  setInspectionPhase: (id, phase, progress) =>
    set((state) => {
      const prev = state.inspection && state.inspection.id === id ? state.inspection : null;
      return {
        inspection: {
          id,
          phase,
          progress: progress ?? prev?.progress ?? (phase === "arrived" ? 100 : 0),
          progressLabel: prev?.progressLabel,
          droneId: prev?.droneId ?? "",
          droneName: prev?.droneName ?? "",
          location: prev?.location ?? "",
          severity: prev?.severity,
          summary: prev?.summary,
          completedAt: prev?.completedAt,
          startedAt: prev?.startedAt,
          selection: prev?.selection,
          aiDetection: prev?.aiDetection,
          // Findings belong to their own mission — a new inspection starts with a
          // clean feed, otherwise the previous mission's overlays leak into transit.
          findings: prev?.findings ?? [],
          timeline: prev?.timeline ?? [],
        },
      };
    }),

  setInspectionMeta: (id, meta) =>
    set((state) => ({
      inspection: state.inspection && state.inspection.id === id
        ? { ...state.inspection, ...meta }
        : state.inspection,
    })),

  addInspectionFinding: (id, finding) =>
    set((state) => {
      if (!state.inspection || state.inspection.id !== id) return {};
      if (state.inspection.findings.some((f) => f.label === finding.label)) return {}; // de-dupe replayed SSE
      return { inspection: { ...state.inspection, findings: [...state.inspection.findings, finding] } };
    }),

  setInspectionSelection: (id, sel) =>
    set((state) => ({
      inspection: state.inspection && state.inspection.id === id
        ? { ...state.inspection, selection: { distanceKm: sel.distanceKm, etaDisplay: sel.etaDisplay, reason: sel.reason }, startedAt: sel.startedAt }
        : state.inspection,
    })),

  setInspectionProgress: (id, progress, label) =>
    set((state) => {
      if (!state.inspection || state.inspection.id !== id) return {};
      if (state.inspection.progressLabel === label) return {}; // de-dupe replayed SSE
      return {
        inspection: {
          ...state.inspection,
          progress,
          progressLabel: label,
          timeline: [...state.inspection.timeline, { time: new Date().toISOString(), message: `${label} (${progress}%)` }].slice(-50),
        },
      };
    }),

  setAiDetection: (id, d) =>
    set((state) => {
      if (!state.inspection || state.inspection.id !== id) return {};
      return {
        inspection: {
          ...state.inspection,
          aiDetection: d,
          timeline: [...state.inspection.timeline, { time: new Date().toISOString(), message: `AI detection: ${d.label} (${d.confidence}%)` }].slice(-50),
        },
      };
    }),

  addInspectionTimeline: (id, message) =>
    set((state) => {
      if (!state.inspection || state.inspection.id !== id) return {};
      if (state.inspection.timeline.some((t) => t.message === message)) return {}; // de-dupe replayed SSE
      return {
        inspection: {
          ...state.inspection,
          timeline: [...state.inspection.timeline, { time: new Date().toISOString(), message }].slice(-50),
        },
      };
    }),

  fetchSummary: async () => {
    if (get()._loaded) return;
    try {
      const [pollutionRes, speciesRes, sensorsRes, alertsRes, dronesRes] = await Promise.all([
        fetch("/api/pollution"),
        fetch("/api/species"),
        fetch("/api/sensors"),
        // Explicit small page — the dashboard renders every alert it receives,
        // so pulling the unbounded list produced 200+ cards on first paint.
        fetch("/api/alerts?limit=25"),
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

// Debug/QA handle — lets browser tests assert on live store state.
if (typeof window !== "undefined") {
  (window as any).__useAppStore = useAppStore;
}


