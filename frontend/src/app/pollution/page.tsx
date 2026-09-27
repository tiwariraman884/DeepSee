"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Drawer } from "@/components/ui/Drawer";
import { FilterBar, FilterSelect, type FilterChip } from "@/components/layout/FilterBar";
import { OceanMap } from "@/components/map/OceanMapLazy";
import { LoadingState, EmptyState } from "@/components/ui/States";
import { pollutionLabels, severityBand, severityMarkerColor, severityRadius } from "@/lib/constants";
import { formatNumber, cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useRegion } from "@/lib/settings/region-context";
import type { PollutionType, PollutionEvent } from "@/types";


type SeverityBand = "all" | "low" | "medium" | "high" | "critical";
type SortKey = "name" | "severity" | "concentration" | "affectedArea" | "detectedAt";
type DateRange = "all" | "7d" | "30d" | "90d";

const typeFilters: FilterChip[] = [
  { value: "all", label: "All Types" },
  { value: "plastic", label: pollutionLabels.plastic },
  { value: "oil_spill", label: pollutionLabels.oil_spill },
  { value: "chemical", label: pollutionLabels.chemical },
  { value: "ghost_net", label: pollutionLabels.ghost_net },
  { value: "illegal_dumping", label: pollutionLabels.illegal_dumping },
];
const severityFilters: FilterChip[] = [
  { value: "all", label: "All Levels" },
  { value: "critical", label: "Critical (9–10)" },
  { value: "high", label: "High (7–8)" },
  { value: "medium", label: "Medium (4–6)" },
  { value: "low", label: "Low (1–3)" },
];

function matchesSeverity(score: number, band: SeverityBand): boolean {
  if (band === "all") return true;
  if (band === "critical") return score >= 9;
  if (band === "high") return score >= 7 && score <= 8;
  if (band === "medium") return score >= 4 && score <= 6;
  return score <= 3;
}

const REGIONS = ["all", "Pacific", "Atlantic", "Indian", "Arctic", "Southern"] as const;
type RegionFilter = (typeof REGIONS)[number];

const regionChips: FilterChip[] = REGIONS.map((r) => ({
  value: r,
  label: r === "all" ? "All Oceans" : r,
}));
const dateRanges: { value: DateRange; label: string; days: number }[] = [
  { value: "all", label: "All Time", days: Infinity },
  { value: "7d", label: "Last 7 Days", days: 7 },
  { value: "30d", label: "Last 30 Days", days: 30 },
  { value: "90d", label: "Last 90 Days", days: 90 },
];
const dateChips: FilterChip[] = dateRanges.map((d) => ({ value: d.value, label: d.label }));

const FIXED_NOW = 175_296_000_000;

function withinRange(detectedAt: string, days: number): boolean {
  if (!isFinite(days)) return true;
  const diff = FIXED_NOW - new Date(detectedAt).getTime();
  return diff <= days * 86_400_000;
}

export default function PollutionPage() {
  const { region: globalRegion, setRegion: setGlobalRegion } = useRegion();
  const [type, setType] = useState<PollutionType | "all">("all");
  const [severity, setSeverity] = useState<SeverityBand>("all");
  const [region, setRegion] = useState<RegionFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [sort, setSort] = useState<SortKey>("concentration");
  const [asc, setAsc] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [pollution, setPollution] = useState<PollutionEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/pollution")
      .then((r) => r.json())
      .then((d) => setPollution(d.pollution ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (globalRegion && REGIONS.includes(globalRegion as RegionFilter)) {
      setRegion(globalRegion as RegionFilter);
    }
  }, [globalRegion]);

  const handleRegionChange = useCallback((r: RegionFilter) => {
    setRegion(r);
    if (r !== "all") setGlobalRegion(r);
  }, [setGlobalRegion]);

  const filtered = useMemo(() => {

    const days = dateRanges.find((d) => d.value === dateRange)?.days ?? Infinity;
    let list = pollution.filter(
      (p) =>
        (type === "all" || p.type === type) &&
        matchesSeverity(p.severity, severity) &&
        (region === "all" || p.region === region) &&
        withinRange(p.detectedAt, days)
    );
    list = [...list].sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      const cmp = typeof av === "number" && typeof bv === "number"
        ? av - bv
        : String(av).localeCompare(String(bv));
      return asc ? cmp : -cmp;
    });
    return list;
  }, [type, severity, region, dateRange, sort, asc, pollution]);


  const mapPoints = useMemo(
    () =>
      filtered.map((p) => ({
        id: p.id,
        coordinates: { lat: p.latitude, lng: p.longitude },
        color: severityMarkerColor(p.severity),
        radius: severityRadius(p.severity),
        label: p.name,
        popup: (
          <div>
            <p className="font-semibold">{p.name}</p>
            <p className="text-xs">{pollutionLabels[p.type]}</p>
          </div>
        ),
      })),
    [filtered]
  );

  const detail = selected ? pollution.find((p) => p.id === selected) : null;
  const isMobile = useMediaQuery("(max-width: 639px)");
  const mapHeight = isMobile ? 300 : 460;
  const hasFilters = type !== "all" || severity !== "all" || region !== "all" || dateRange !== "all";

  const resetFilters = () => {
    setType("all");
    setSeverity("all");
    setRegion("all");
    setDateRange("all");
    setSort("concentration");
    setAsc(false);
    setGlobalRegion("Coral Triangle");
  };

  return (
    <DashboardShell title="AI Pollution Detection" subtitle="Identify environmental hazards early">
      <FilterBar onReset={resetFilters} hasActiveFilters={hasFilters} variant="toolbar">
        <FilterSelect variant="type" value={type} onChange={(v: string) => setType(v as PollutionType | "all")} options={typeFilters} />
        <FilterSelect variant="severity" value={severity} onChange={(v: string) => setSeverity(v as SeverityBand)} options={severityFilters} />
        <FilterSelect variant="region" value={region} onChange={(v: string) => handleRegionChange(v as RegionFilter)} options={regionChips} />
        <FilterSelect variant="date" value={dateRange} onChange={(v: string) => setDateRange(v as DateRange)} options={dateChips} />
      </FilterBar>

      <div
        className="sr-only"
        role="status"
        aria-live="polite"
      >
        {filtered.length} pollution {filtered.length === 1 ? "site" : "sites"} shown.
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-3">
          {loading ? (
            <div className="flex h-[460px] items-center justify-center">
              <LoadingState label="Loading pollution map…" />
            </div>
          ) : (
            <OceanMap
              points={mapPoints}
              height={`${mapHeight}px`}
              onMarkerClick={(id: string) => setSelected(id)}
            />
          )}
        </Card>

        <Card>
          <CardHeader title="Data Table" subtitle={`${filtered.length} sites`} />
          {loading ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No pollution incidents match the selected filters."
                description="Try broadening your filters or reset to view all monitored sites."
                actionLabel="Reset Filters"
                onAction={resetFilters}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <caption className="sr-only">Pollution sites matching current filters</caption>
                <thead>
                  <tr className="text-ocean-200/50">
                    {[
                      { k: "name", label: "Location" },
                      { k: "severity", label: "Severity" },
                      { k: "affectedArea", label: "Area" },
                      { k: "detectedAt", label: "Detected" },
                    ].map((col) => (
                      <th key={col.k} className="pb-2 pr-2 font-medium">
                        <button
                          onClick={() => {
                            if (sort === col.k) setAsc(!asc);
                            else { setSort(col.k as SortKey); setAsc(false); }
                          }}
                          className="hover:text-ocean-100"
                          aria-label={`Sort by ${col.label}${sort === col.k ? asc ? " ascending" : " descending" : ""}`}
                        >
                          {col.label} {sort === col.k ? (asc ? "▲" : "▼") : ""}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setSelected(p.id)}
                      className="cursor-pointer border-t border-ocean-500/10 hover:bg-ocean-500/5"
                    >
                      <td className="py-2 pr-2 font-medium text-white">{p.name}</td>
                      <td className="py-2 pr-2">
                        <span className={cn("font-semibold", severityBand(p.severity).color)}>{severityBand(p.severity).label} ({p.severity})</span>
                      </td>
                      <td className="py-2 pr-2 text-ocean-200/70">{formatNumber(p.affectedArea)}</td>
                      <td className="py-2 pr-2 text-ocean-200/60">{new Date(p.detectedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Drawer open={!!detail} onClose={() => setSelected(null)} title={detail?.name}>
        {detail && (
          <>
            <p className="text-sm text-ocean-200/60">{pollutionLabels[detail.type]}</p>
            <div className="mt-4 aspect-video rounded-lg bg-gradient-to-br from-ocean-800 to-abyss-950" />
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-ocean-200/50">Coordinates</p>
                <p className="font-medium text-white">{detail.latitude.toFixed(1)}, {detail.longitude.toFixed(1)}</p>
              </div>
              <div>
                <p className="text-ocean-200/50">Severity</p>
                <p className={cn("font-medium", severityBand(detail.severity).color)}>{severityBand(detail.severity).label} ({detail.severity}/10)</p>
              </div>
              <div>
                <p className="text-ocean-200/50">Region</p>
                <p className="font-medium text-white">{detail.region}</p>
              </div>
              <div>
                <p className="text-ocean-200/50">AI Confidence</p>
                <p className="font-medium text-biolum-400">{Math.round(detail.concentration * 10)}%</p>
              </div>
              <div>
                <p className="text-ocean-200/50">Trend</p>
                <p className={cn("flex items-center gap-1 font-medium", detail.trend === "increasing" ? "text-rose-300" : detail.trend === "decreasing" ? "text-biolum-400" : "text-amber-300")}>
                  {detail.trend === "increasing" ? <TrendingUp className="h-3.5 w-3.5" /> : detail.trend === "decreasing" ? <TrendingDown className="h-3.5 w-3.5" /> : null}
                  {detail.trend}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-ocean-500/15 bg-ocean-500/5 p-3">
              <p className="text-xs font-semibold text-ocean-100">Recommended Action</p>
              <p className="mt-1 text-sm text-ocean-200/70">
                Deploy drone patrol and containment units. Notify coastal authority for {pollutionLabels[detail.type].toLowerCase()} response protocol.
              </p>
            </div>
          </>
        )}
      </Drawer>
    </DashboardShell>
  );
}
