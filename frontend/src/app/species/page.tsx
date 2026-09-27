"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Fish } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { FilterBar, FilterChips, FilterSearch, type FilterChip } from "@/components/layout/FilterBar";
import { SpeciesCard } from "@/components/domain/SpeciesCard";
import { SpeciesClassifier } from "@/components/ai/SpeciesClassifier";
import { TrainingSamples } from "@/components/ai/TrainingSamples";
import { statusLabels } from "@/lib/constants";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { species as defaultSpecies } from "@/data/species.json";
import type { Species, SpeciesStatus } from "@/types";


const statusColors: Record<string, string> = {
  least_concern: "#34d399",
  near_threatened: "#a3e635",
  vulnerable: "#fbbf24",
  endangered: "#fb923c",
  critically_endangered: "#fb7185",
};

const statusFilters: FilterChip[] = [
  { value: "all", label: "All" },
  { value: "least_concern", label: statusLabels.least_concern },
  { value: "near_threatened", label: statusLabels.near_threatened },
  { value: "vulnerable", label: statusLabels.vulnerable },
  { value: "endangered", label: statusLabels.endangered },
  { value: "critically_endangered", label: statusLabels.critically_endangered },
];

function years(pop: number[], trend: string) {
  if (pop.length >= 5) return pop.slice(-5);
  const last = pop[pop.length - 1] ?? 50;
  return Array.from({ length: 5 }, (_, i) => {
    const drift = trend === "decreasing" ? -i * 4 : trend === "increasing" ? i * 3 : Math.sin(i) * 3;
    return Math.max(10, Math.round(last + drift + (i % 2) * 2));
  });
}

export default function SpeciesPage() {
  const [statusFilter, setStatusFilter] = useState<SpeciesStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Species | null>(null);
  const [species, setSpecies] = useState<Species[]>(defaultSpecies);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/species")
      .then((r) => r.json())
      .then((d) => {
        if (d.species && d.species.length > 0) {
          setSpecies(d.species);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const [deferredQuery, setDeferredQuery] = useState("");
  const debouncedSetQuery = useDebouncedCallback(setDeferredQuery, 200);

  const filtered = useMemo(
    () =>
      species.filter(
        (s) =>
          (statusFilter === "all" || s.status === statusFilter) &&
          (deferredQuery.trim() === "" ||
            s.name.toLowerCase().includes(deferredQuery.toLowerCase()) ||
            s.scientificName.toLowerCase().includes(deferredQuery.toLowerCase()) ||
            s.region.toLowerCase().includes(deferredQuery.toLowerCase()))
      ),
    [statusFilter, deferredQuery, species]
  );

  const detailSeries = selected ? years(selected.population, selected.populationTrend) : [];
  const detailSeriesNorm = (() => {
    if (!detailSeries.length) return [];
    const max = Math.max(...detailSeries);
    return detailSeries.map((v) => (max > 0 ? Math.round((v / max) * 100) : 50));
  })();
  const detailThreats = selected
    ? [
        "Habitat degradation",
        "Climate-driven temperature rise",
        "Illegal fishing pressure",
        "Pollution accumulation",
      ]
    : [];


  const hasFilters = statusFilter !== "all" || deferredQuery.trim() !== "";
  const resetFilters = () => {
    setStatusFilter("all");
    setSearch("");
    setDeferredQuery("");
  };

  return (
    <DashboardShell title="Biodiversity Monitoring" subtitle="Species tracking & ecosystem health">
      <div className="mb-6 max-w-2xl">
        <SpeciesClassifier />
      </div>

      <FilterBar onReset={resetFilters} hasActiveFilters={hasFilters}>
        <FilterChips
          label="Conservation status"
          options={statusFilters}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as SpeciesStatus | "all")}
        />
        <FilterSearch
          value={search}
          onChange={(v) => {
            setSearch(v);
            debouncedSetQuery(v);
          }}
          placeholder="Search species, region…"
          label="Search species by name, scientific name or region"
        />
      </FilterBar>

      <div className="sr-only" role="status" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? "species" : "species"} match your filters.
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-card bg-secondary/60" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No species match your filters."
          description="Try a different conservation status or clear your search."
          actionLabel="Reset Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((s, i) => (
            <SpeciesCard key={s.id} species={s} image={s.image} index={i} onClick={() => setSelected(s)} />
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name}>
        {selected && (
          <div>
            <p className="text-sm italic text-text-muted">{selected.scientificName}</p>
            <div className="mt-4 aspect-video overflow-hidden rounded-lg">
              <Image
                src={selected.image || "/species/fallback.webp"}
                alt={`${selected.name} (${selected.scientificName}) — ${selected.region}`}
                width={1200}
                height={630}
                sizes="(max-width: 1024px) 100vw, 66vw"
                loading="lazy"
                decoding="async"
                priority={false}
                quality={78}
                className="h-full w-full object-cover"
              />
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-text-muted">Population (6-year)</p>
              <Card className="mt-2 overflow-hidden">
                <div className="flex h-32 items-end gap-1 px-1 pb-1">
                  {detailSeriesNorm.map((pct, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-t bg-emerald-500/70"
                      style={{ height: `${pct}%` }}
                      title={`Year ${i + 1}: ${detailSeries[i]?.toLocaleString()}`}
                    />
                  ))}
                </div>
              </Card>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-text-muted">Habitat</p><p className="font-medium text-text-primary">{selected.habitat}</p></div>
              <div><p className="text-text-muted">Region</p><p className="font-medium text-text-primary">{selected.region}</p></div>
              <div><p className="text-text-muted">Conservation</p><p className="font-medium text-text-primary">{selected.conservationProgress}%</p></div>
              <div><p className="text-text-muted">Status</p><p className="font-medium" style={{ color: statusColors[selected.status] }}>{statusLabels[selected.status]}</p></div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-semibold text-text-muted">Threats</p>
              <ul className="mt-2 space-y-1">
                {detailThreats.map((t) => (
                  <li key={t} className="flex items-center gap-2 text-sm text-text-muted">
                    <Fish className="h-3.5 w-3.5 text-coral-400" /> {t}
                  </li>
                ))}
              </ul>
            </div>

            <TrainingSamples speciesId={selected.id} speciesName={selected.name} />
          </div>
        )}
      </Modal>
    </DashboardShell>
  );
}
