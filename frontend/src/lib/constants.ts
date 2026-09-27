import type {
  PollutionType,
  Severity,
  SpeciesStatus,
  AlertType,
  DroneStatus,
} from "@/types";

export const pollutionLabels: Record<PollutionType, string> = {
  plastic: "Plastic Accumulation",
  oil_spill: "Oil Spill",
  chemical: "Chemical Waste",
  ghost_net: "Ghost Fishing Net",
  illegal_dumping: "Illegal Dumping",
};

export const severityMeta: Record<
  Severity,
  { label: string; color: string; bg: string }
> = {
  low: { label: "Low", color: "text-emerald-300", bg: "bg-emerald-500/15 border-emerald-500/30" },
  medium: { label: "Medium", color: "text-amber-300", bg: "bg-amber-500/15 border-amber-500/30" },
  high: { label: "High", color: "text-orange-300", bg: "bg-orange-500/15 border-orange-500/30" },
  critical: { label: "Critical", color: "text-rose-300", bg: "bg-rose-500/15 border-rose-500/30" },
};

// Numeric PollutionEvent.severity (1-10) → display band (Doc 23).
export function severityBand(score: number): { label: string; color: string } {
  if (score >= 9) return { label: "Critical", color: "text-rose-300" };
  if (score >= 7) return { label: "High", color: "text-orange-300" };
  if (score >= 4) return { label: "Medium", color: "text-amber-300" };
  return { label: "Low", color: "text-emerald-300" };
}

export function severityMarkerColor(score: number): string {
  if (score >= 9) return "#fb7185";
  if (score >= 7) return "#fb923c";
  if (score >= 4) return "#fbbf24";
  return "#34d399";
}

export function severityRadius(score: number): number {
  return score >= 9 ? 12 : 9;
}

export const statusLabels: Record<SpeciesStatus, string> = {
  least_concern: "Least Concern",
  near_threatened: "Near Threatened",
  vulnerable: "Vulnerable",
  endangered: "Endangered",
  critically_endangered: "Critically Endangered",
};

export const alertMeta: Record<
  AlertType,
  { label: string; color: string; bg: string; icon: string }
> = {
  critical: { label: "Critical", color: "text-rose-300", bg: "bg-rose-500/15 border-rose-500/30", icon: "alert-triangle" },
  warning: { label: "Warning", color: "text-amber-300", bg: "bg-amber-500/15 border-amber-500/30", icon: "alert-circle" },
  info: { label: "Info", color: "text-ocean-300", bg: "bg-ocean-500/15 border-ocean-500/30", icon: "info" },
};

export const droneStatusMeta: Record<
  DroneStatus,
  { label: string; color: string; dot: string }
> = {
  active: { label: "Active", color: "text-emerald-300", dot: "bg-emerald-400" },
  returning: { label: "Returning", color: "text-ocean-300", dot: "bg-ocean-400" },
  charging: { label: "Charging", color: "text-amber-300", dot: "bg-amber-400" },
  idle: { label: "Idle", color: "text-slate-300", dot: "bg-slate-400" },
  offline: { label: "Offline", color: "text-rose-300", dot: "bg-rose-400" },
};

export function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-300";
  if (score >= 50) return "text-amber-300";
  return "text-rose-300";
}
