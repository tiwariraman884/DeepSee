import type { TimeHorizon } from "@/types";

export interface MetricProjection {
  oceanHealth: number;
  pollution: number; // hotspots / index 0-100
  species: number; // tracked count
  risk: number; // 0-100
  temperature: number; // °C anomaly
  coralHealth: number; // 0-100
}

const BASELINE: MetricProjection = {
  oceanHealth: 72,
  pollution: 58,
  species: 148,
  risk: 47,
  temperature: 1.4,
  coralHealth: 64,
};

// Deterministic per-horizon deltas. Positive factor worsens, negative improves.
const HORIZON_DELTA: Record<TimeHorizon, Partial<MetricProjection>> = {
  today: {},
  "1m": { oceanHealth: -3, pollution: +4, species: -2, risk: +5, temperature: +0.2, coralHealth: -4 },
  "6m": { oceanHealth: -8, pollution: +10, species: -9, risk: +14, temperature: +0.5, coralHealth: -12 },
  "1y": { oceanHealth: -14, pollution: +16, species: -21, risk: +24, temperature: +0.9, coralHealth: -21 },
  "5y": { oceanHealth: -1, pollution: -6, species: +6, risk: -8, temperature: +0.3, coralHealth: +5 },
};

export function getMetricProjection(horizon: TimeHorizon): MetricProjection {
  const d = HORIZON_DELTA[horizon];
  return {
    oceanHealth: clamp(BASELINE.oceanHealth + (d.oceanHealth ?? 0)),
    pollution: clamp(BASELINE.pollution + (d.pollution ?? 0)),
    species: Math.max(0, Math.round(BASELINE.species + (d.species ?? 0))),
    risk: clamp(BASELINE.risk + (d.risk ?? 0)),
    temperature: round1(BASELINE.temperature + (d.temperature ?? 0)),
    coralHealth: clamp(BASELINE.coralHealth + (d.coralHealth ?? 0)),
  };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export const HORIZON_ORDER: TimeHorizon[] = ["today", "1m", "6m", "1y", "5y"];

export const HORIZON_LABELS: Record<TimeHorizon, string> = {
  today: "Today",
  "1m": "1 Month",
  "6m": "6 Months",
  "1y": "1 Year",
  "5y": "5 Years",
};

export function confidenceForHorizon(horizon: TimeHorizon): number {
  // Nearer-term predictions are more confident.
  return { today: 99.1, "1m": 96.3, "6m": 91.7, "1y": 84.2, "5y": 72.5 }[horizon];
}
