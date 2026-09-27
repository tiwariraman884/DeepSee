"use client";

import { useState, useMemo } from "react";
import { Leaf, ArrowUpDown, Fish, Waves } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { FilterBar, FilterChips, FilterSearch, type FilterChip } from "@/components/layout/FilterBar";
import { EmptyState } from "@/components/ui/States";
import { SpeciesCard } from "@/components/domain/SpeciesCard";
import { SpeciesClassifier } from "@/components/ai/SpeciesClassifier";
import { SpeciesCardSkeleton } from "@/components/domain/SpeciesCardSkeleton";
import { species } from "@/data";
import { statusLabels } from "@/lib/constants";
import { aiRiskFromSort } from "@/lib/species-metrics";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";
import { useSimulatedLoad } from "@/hooks/useSimulatedLoad";
import type { SpeciesStatus } from "@/types";

const statusFilters: FilterChip[] = [
  { value: "all", label: "All" },
  { value: "least_concern", label: statusLabels.least_concern },
  { value: "near_threatened", label: statusLabels.near_threatened },
  { value: "vulnerable", label: statusLabels.vulnerable },
  { value: "endangered", label: statusLabels.endangered },
  { value: "critically_endangered", label: statusLabels.critically_endangered },
];

const REGIONS = ["all", ...Array.from(new Set(species.map((s) => s.region)))] as const;
type RegionFilter = (typeof REGIONS)[number];
const regionChips: FilterChip[] = REGIONS.map((r) => ({
  value: r,
  label: r === "all" ? "All Regions" : r,
}));

const HABITATS = ["all", ...Array.from(new Set(species.map((s) => s.habitat)))] as const;
type HabitatFilter = (typeof HABITATS)[number];
const habitatChips: FilterChip[] = HABITATS.map((h) => ({
  value: h,
  label: h === "all" ? "All Habitats" : h,
}));

type SortKey = "population" | "risk" | "alphabetical" | "newest";
const sortOptions: { value: SortKey; label: string }[] = [
  { value: "population", label: "Population" },
  { value: "risk", label: "Risk" },
  { value: "alphabetical", label: "A–Z" },
  { value: "newest", label: "Newest" },
];

function sortSpecies(list: typeof species, key: SortKey): typeof species {
  const copy = [...list];
  switch (key) {
    case "population":
      return copy.sort(
        (a, b) =>
          (b.population[b.population.length - 1] ?? 0) -
          (a.population[a.population.length - 1] ?? 0)
      );
    case "risk":
      return copy.sort(
        (a, b) => aiRiskFromSort(b.status) - aiRiskFromSort(a.status)
      );
    case "alphabetical":
      return copy.sort((a, b) => a.name.localeCompare(b.name));
    case "newest":
      return copy.sort((a, b) => b.id.localeCompare(a.id));
  }
}

export default function BiodiversityPage() {
  const [status, setStatus] = useState<SpeciesStatus | "all">("all");
  const [region, setRegion] = useState<RegionFilter>("all");
  const [habitat, setHabitat] = useState<HabitatFilter>("all");
  const [sort, setSort] = useState<SortKey>("population");
  const [query, setQuery] = useState("");
  const [deferredQuery, setDeferredQuery] = useState("");
  const { status: loadStatus } = useSimulatedLoad();

  const debouncedSetQuery = useDebouncedCallback(setDeferredQuery, 200);

  const filtered = useMemo(() => {
    const result = species.filter(
      (s) =>
        (status === "all" || s.status === status) &&
        (region === "all" || s.region === region) &&
        (habitat === "all" || s.habitat === habitat) &&
        (deferredQuery.trim() === "" ||
          s.name.toLowerCase().includes(deferredQuery.toLowerCase()) ||
          s.scientificName.toLowerCase().includes(deferredQuery.toLowerCase()) ||
          s.region.toLowerCase().includes(deferredQuery.toLowerCase()))
    );
    return sortSpecies(result, sort);
  }, [status, region, habitat, sort, deferredQuery]);

  const hasFilters =
    status !== "all" || region !== "all" || habitat !== "all" || deferredQuery.trim() !== "";
  const resetFilters = () => {
    setStatus("all");
    setRegion("all");
    setHabitat("all");
    setQuery("");
    setDeferredQuery("");
  };

  const endangeredCount = filtered.filter(
    (s) => s.status === "endangered" || s.status === "critically_endangered"
  ).length;

  return (
    <DashboardShell title="Biodiversity Monitoring" subtitle="Track species populations & ecosystem health">
      <div className="mb-6 max-w-2xl">
        <SpeciesClassifier />
      </div>

      <FilterBar onReset={resetFilters} hasActiveFilters={hasFilters}>
        <FilterChips
          label="Conservation status"
          options={statusFilters}
          value={status}
          onChange={(v) => setStatus(v as SpeciesStatus | "all")}
        />
        <FilterChips
          label="Region"
          options={regionChips}
          value={region}
          onChange={(v) => setRegion(v as RegionFilter)}
        />
        <FilterChips
          label="Habitat"
          options={habitatChips}
          value={habitat}
          onChange={(v) => setHabitat(v as HabitatFilter)}
        />
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-xs text-ocean-200/60">
            <ArrowUpDown className="h-3 w-3" aria-hidden="true" /> Sort
          </span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort species"
            className="rounded-full border border-ocean-500/15 bg-abyss-900 px-3 py-1 text-xs text-ocean-100 outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <FilterSearch
          value={query}
          onChange={(v) => {
            setQuery(v);
            debouncedSetQuery(v);
          }}
          placeholder="Search species, region…"
          label="Search species by name, scientific name or region"
        />
      </FilterBar>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-biolum-500/15 bg-biolum-500/5 px-4 py-3 text-sm text-biolum-100">
        <Leaf className="h-4 w-4" aria-hidden="true" />
        <span>
          Showing <span className="font-bold">{filtered.length}</span> of{" "}
          <span className="font-bold">{species.length}</span> monitored species
          {region !== "all" && (
            <>
              {" "}
              in <span className="font-semibold">{region}</span>
            </>
          )}{" "}
          — <span className="font-bold text-coral-400">{endangeredCount}</span> currently endangered.
        </span>
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {filtered.length} species match your filters.
      </div>

      {loadStatus === "loading" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <SpeciesCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No species found"
          description="No species match the current filters. Try a different conservation status, region, or habitat."
          actionLabel="Reset Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
          {filtered.map((s) => (
            <SpeciesCard key={s.id} species={s} image={s.image} />
          ))}
        </div>
      )}

      <p className="mt-6 flex items-center gap-1.5 text-[11px] text-text-muted">
        <Waves className="h-3 w-3" aria-hidden="true" />
        <Fish className="h-3 w-3" aria-hidden="true" />
        AI insights are generated from the latest sensor mesh &amp; drone telemetry · simulated mode.
      </p>
    </DashboardShell>
  );
}
