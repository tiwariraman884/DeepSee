import type { Species, SpeciesStatus } from "@/types";
import { statusLabels } from "@/lib/constants";

export type SpeciesTrend = "up" | "down" | "flat";

export interface SpeciesMetrics {
  /** Percentage change across the 5-year population series (positive = growth). */
  trendPct: number;
  trend: SpeciesTrend;
  /** Conservation progress as a 0-100 health score. */
  healthScore: number;
  /** Human-readable threat band from the species threat level. */
  threatLabel: string;
  /** Color token for the threat band. */
  threatColor: string;
  /** Threat band background utility. */
  threatBg: string;
  /** AI-derived risk rating for the species. */
  aiRisk: "Low" | "Medium" | "High" | "Critical";
  /** One-sentence, data-driven conservation insight. */
  insight: string;
}

const aiRiskFromStatus: Record<SpeciesStatus, SpeciesMetrics["aiRisk"]> = {
  critically_endangered: "Critical",
  endangered: "High",
  vulnerable: "Medium",
  near_threatened: "Low",
  least_concern: "Low",
};

/** Numeric weight for sorting species by descending AI risk. */
export function aiRiskFromSort(status: SpeciesStatus): number {
  return (
    {
      critically_endangered: 4,
      endangered: 3,
      vulnerable: 2,
      near_threatened: 1,
      least_concern: 0,
    } as const
  )[status];
}

const aiRiskColor: Record<SpeciesMetrics["aiRisk"], string> = {
  Low: "#34d399",
  Medium: "#F59E0B",
  High: "#fb923c",
  Critical: "#fb7185",
};

export function getSpeciesMetrics(species: Species): SpeciesMetrics {
  const series = species.population ?? [];
  const first = series[0] ?? 0;
  const last = series[series.length - 1] ?? 0;
  const raw = first > 0 ? ((last - first) / first) * 100 : 0;
  const trendPct = Math.round(raw);
  const trend: SpeciesTrend = trendPct > 1 ? "up" : trendPct < -1 ? "down" : "flat";
  const primaryThreat = species.threats?.[0] ?? "environmental pressure";

  const directionWord =
    trend === "down"
      ? "declined"
      : trend === "up"
      ? "recovered"
      : "remained stable";

  const statusWord = statusLabels[species.status] ?? "Unknown";
  const insight =
    trend === "flat"
      ? `${species.name} populations have remained stable, indicating resilience across the ${species.region} ecosystem.`
      : `${species.name} populations have ${directionWord} ${Math.abs(trendPct)}% over the last 5 years, driven primarily by ${primaryThreat.toLowerCase()}. Current status: ${statusWord}.`;

  const threatLevel = species.threatLevel ?? "medium";

  return {
    trendPct,
    trend,
    healthScore: species.conservationProgress ?? 50,
    threatLabel:
      threatLevel.charAt(0).toUpperCase() + threatLevel.slice(1),
    threatColor:
      threatLevel === "critical"
        ? "#fb7185"
        : threatLevel === "high"
        ? "#fb923c"
        : threatLevel === "medium"
        ? "#fbbf24"
        : "#34d399",
    threatBg:
      threatLevel === "critical"
        ? "bg-rose-500/15 border-rose-500/30"
        : threatLevel === "high"
        ? "bg-orange-500/15 border-orange-500/30"
        : threatLevel === "medium"
        ? "bg-amber-500/15 border-amber-500/30"
        : "bg-emerald-500/15 border-emerald-500/30",
    aiRisk: aiRiskFromStatus[species.status] ?? "Medium",
    insight,
  };
}

export function trendColor(trend: SpeciesTrend): string {
  return trend === "down" ? "#EF4444" : trend === "up" ? "#10B981" : "#94A3B8";
}

export function aiRiskColorToken(risk: SpeciesMetrics["aiRisk"]): string {
  return aiRiskColor[risk];
}
