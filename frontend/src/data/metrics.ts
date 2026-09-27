import type { OceanHealthScore, TimeSeriesPoint, RiskPrediction, Sensor } from "@/types";
import { pollution } from "./pollution.json";
import { species } from "./species.json";
import { sensors } from "./sensors.json";

export const oceanHealth: OceanHealthScore = computeOceanHealth(pollution, species, sensors);

export const timeSeries: TimeSeriesPoint[] = [
  { label: "Jan", pollution: 62, biodiversity: 70, waterQuality: 84 },
  { label: "Feb", pollution: 60, biodiversity: 68, waterQuality: 83 },
  { label: "Mar", pollution: 65, biodiversity: 66, waterQuality: 82 },
  { label: "Apr", pollution: 58, biodiversity: 65, waterQuality: 81 },
  { label: "May", pollution: 54, biodiversity: 63, waterQuality: 80 },
  { label: "Jun", pollution: 50, biodiversity: 62, waterQuality: 79 },
  { label: "Jul", pollution: 58, biodiversity: 64, waterQuality: 81 },
];

export const riskPredictions: RiskPrediction[] = [
  {
    category: "coral_bleaching",
    region: "Caribbean",
    score: 82,
    confidence: 91,
    horizon: "1m",
    narrative:
      "Sustained thermal stress projected to trigger mass bleaching across 64% of reef zone.",
  },
  {
    category: "pollution_expansion",
    region: "North Pacific Gyre",
    score: 74,
    confidence: 85,
    horizon: "6m",
    narrative:
      "Plastic accumulation expected to expand 18% driven by seasonal currents.",
  },
  {
    category: "biodiversity_loss",
    region: "Gulf of California",
    score: 88,
    confidence: 78,
    horizon: "1y",
    narrative:
      "Vaquita population projected to decline below recovery threshold without intervention.",
  },
  {
    category: "illegal_fishing",
    region: "Galapagos",
    score: 61,
    confidence: 69,
    horizon: "1m",
    narrative:
      "Increased vessel traffic near protected zone raises illegal fishing probability.",
  },
  {
    category: "coral_bleaching",
    region: "Coral Triangle",
    score: 55,
    confidence: 73,
    horizon: "6m",
    narrative: "Moderate bleaching risk with local reef resilience buffering impact.",
  },
  {
    category: "pollution_expansion",
    region: "Mediterranean",
    score: 79,
    confidence: 88,
    horizon: "1m",
    narrative:
      "Recurring illegal discharge predicted to expand contaminated zone by 12%.",
  },
];

// ── Derived Ocean Health Score (Doc 23.7) ─────────────────────────────────────
// Computed from the four source datasets so the Time Machine horizon shifts are
// real, not hand-authored constants.

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function computePollutionScore(events: { severity: number }[]): number {
  if (events.length === 0) return 100;
  const avg = events.reduce((s, e) => s + e.severity, 0) / events.length;
  return clamp(100 - avg * 10);
}

function computeBiodiversityIndex(
  items: { conservation: string; populationTrend: string }[]
): number {
  if (items.length === 0) return 100;
  const statusWeight: Record<string, number> = { stable: 1, vulnerable: 0.6, endangered: 0.3 };
  let sum = 0;
  for (const s of items) {
    const base = statusWeight[s.conservation] ?? 0.5;
    const trendAdj =
      s.populationTrend === "increasing" ? 0.1 : s.populationTrend === "decreasing" ? -0.1 : 0;
    sum += clamp((base + trendAdj) * 100);
  }
  return clamp(sum / items.length);
}

function computeWaterQualityIndex(
  sensors: {
    online: boolean;
    lastReading: { ph?: number; temp?: number; salinity?: number; oxygen?: number; turbidity?: number };
  }[]
): number {
  if (sensors.length === 0) return 100;
  const onlineRatio = sensors.filter((s) => s.online).length / sensors.length;
  let readingScore = 0;
  for (const s of sensors) {
    const r = s.lastReading;
    let score = 1;
    if (r.ph !== undefined) score *= r.ph >= 7.8 && r.ph <= 8.4 ? 1 : 0.7;
    if (r.temp !== undefined) score *= r.temp >= 10 && r.temp <= 30 ? 1 : 0.8;
    if (r.oxygen !== undefined) score *= r.oxygen >= 4 ? 1 : 0.6;
    if (r.turbidity !== undefined) score *= r.turbidity <= 15 ? 1 : 0.7;
    readingScore += score;
  }
  readingScore /= sensors.length;
  return clamp((onlineRatio * 0.5 + readingScore * 0.5) * 100);
}

export function computeOceanHealth(
  pollutionEvents: { severity: number }[],
  allSpecies: { category: string; conservation: string; populationTrend: string }[],
  allSensors: { online: boolean; lastReading: Sensor["lastReading"] }[]
): OceanHealthScore {
  const pollutionScore = computePollutionScore(pollutionEvents);
  const biodiversityScore = computeBiodiversityIndex(allSpecies);
  const waterQualityScore = computeWaterQualityIndex(allSensors);
  const coralHealthScore = computeBiodiversityIndex(
    allSpecies.filter((s) => s.category === "coral")
  );

  const overall = clamp(
    pollutionScore * 0.3 +
      biodiversityScore * 0.3 +
      waterQualityScore * 0.2 +
      coralHealthScore * 0.2
  );

  return {
    overall,
    pollution: pollutionScore,
    biodiversity: biodiversityScore,
    waterQuality: waterQualityScore,
    coralHealth: coralHealthScore,
  };
}
