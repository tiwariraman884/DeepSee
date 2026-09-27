"use client";

import { memo, useState, useEffect } from "react";
import Image from "next/image";
import { ArrowDownRight, ArrowUpRight, Minus, MapPin, Fish, Activity, ShieldAlert } from "lucide-react";
import { Sparkline } from "@/components/visuals/Sparkline";
import { getSpeciesMetrics, trendColor, aiRiskColorToken } from "@/lib/species-metrics";
import type { Species, SpeciesStatus } from "@/types";

const SPECIES_IMAGE_FALLBACK = "/species/fallback.webp";

type CardStatus = "stable" | "vulnerable" | "endangered" | "critical";

const statusMap: Record<SpeciesStatus, CardStatus> = {
  least_concern: "stable",
  near_threatened: "stable",
  vulnerable: "vulnerable",
  endangered: "endangered",
  critically_endangered: "critical",
};

const statusMeta: Record<CardStatus, { label: string; color: string; bg: string }> = {
  stable: { label: "Stable", color: "#34d399", bg: "bg-emerald-500/15 border-emerald-500/30" },
  vulnerable: { label: "Vulnerable", color: "#F59E0B", bg: "bg-amber-500/15 border-amber-500/30" },
  endangered: { label: "Endangered", color: "#fb923c", bg: "bg-orange-500/15 border-orange-500/30" },
  critical: { label: "Critical", color: "#fb7185", bg: "bg-rose-500/15 border-rose-500/30" },
};

const trendFromStatus = (status: SpeciesStatus, trend: Species["populationTrend"]): number[] =>
  Array.from({ length: 6 }, (_, i) =>
    trend === "decreasing" || status === "critically_endangered"
      ? 40 - i * 5
      : trend === "increasing"
      ? 30 + i * 4
      : 35 + Math.round(Math.sin(i) * 4)
  );

function altText(species: Species): string {
  return `${species.name} (${species.scientificName}) — ${species.region}`;
}

function TrendGlyph({ trend }: { trend: "up" | "down" | "flat" }) {
  if (trend === "up") return <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />;
  if (trend === "down") return <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Minus className="h-3.5 w-3.5" aria-hidden="true" />;
}

export const SpeciesCard = memo(function SpeciesCard({
  species,
  image,
  trend,
  index = 99,
  onOpen,
  onClick,
}: {
  species: Species;
  image?: string;
  trend?: number[];
  /** Card position in the list — first 4 are treated as above-the-fold and loaded eagerly */
  index?: number;
  onOpen?: () => void;
  onClick?: () => void;
}) {
  const [src, setSrc] = useState(image || species.image || SPECIES_IMAGE_FALLBACK);

  useEffect(() => {
    setSrc(image || species.image || SPECIES_IMAGE_FALLBACK);
  }, [image, species.image]);
  const status = statusMap[species.status];
  const meta = statusMeta[status];
  const metrics = getSpeciesMetrics(species);
  const series = trend ?? trendFromStatus(species.status, species.populationTrend);
  const sparkColor = trendColor(metrics.trend);

  return (
    <button
      type="button"
      onClick={onOpen ?? onClick}
      aria-label={`${species.name}, ${meta.label}. ${metrics.insight}`}
      className="glass group relative flex h-full w-full flex-col overflow-hidden rounded-card text-left transition-all duration-300 ease-out-expo hover:-translate-y-1 hover:border-accent/50 hover:shadow-glow-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
    >
      {/* 16:9 hero image */}
      <div className="relative aspect-video w-full overflow-hidden bg-black/40">
        <Image
          src={src}
          alt={altText(species)}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 25vw, 20vw"
          loading={index < 4 ? "eager" : "lazy"}
          decoding={index < 4 ? "sync" : "async"}
          priority={index < 4}
          quality={72}
          placeholder="empty"
          className="object-cover transition-transform duration-500 ease-out-expo group-hover:scale-105"
          onError={() => {
            if (src !== SPECIES_IMAGE_FALLBACK) setSrc(SPECIES_IMAGE_FALLBACK);
          }}
        />
        {/* gradient legibility scrim */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        {/* status badge */}
        <span
          className={`absolute right-3 top-3 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold backdrop-blur-sm ${meta.bg}`}
          style={{ color: meta.color }}
        >
          {meta.label}
        </span>
      </div>

      {/* body */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <h3 className="truncate text-base font-bold leading-tight text-text-primary">
            {species.name}
          </h3>
          <p className="truncate text-xs italic text-text-muted">{species.scientificName}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {species.region}
          </span>
          <span className="inline-flex items-center gap-1">
            <Fish className="h-3 w-3" aria-hidden="true" />
            {species.habitat}
          </span>
        </div>

        {/* stats */}
        <div className="grid grid-cols-3 gap-2 rounded-control border border-white/5 bg-white/[0.03] p-2.5">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Population</p>
            <p className="text-sm font-bold tabular-nums text-text-primary">
              {((species.population && species.population.length > 0) ? species.population[species.population.length - 1] : 0).toLocaleString()}
            </p>
            <p
              className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums"
              style={{ color: sparkColor }}
            >
              <TrendGlyph trend={metrics.trend} />
              {metrics.trend === "flat" ? "0%" : `${Math.abs(metrics.trendPct)}%`}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">Health</p>
            <p className="text-sm font-bold tabular-nums text-text-primary">{metrics.healthScore}%</p>
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-biolum-500"
                style={{ width: `${metrics.healthScore}%` }}
              />
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-text-muted">AI Risk</p>
            <p
              className="mt-0.5 inline-flex items-center gap-1 text-sm font-bold"
              style={{ color: aiRiskColorToken(metrics.aiRisk) }}
            >
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
              {metrics.aiRisk}
            </p>
          </div>
        </div>

        {/* sparkline */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] uppercase tracking-wide text-text-muted">5-yr trend</span>
          <Sparkline data={series} color={sparkColor} width={120} height={32} />
        </div>

        {/* AI insight */}
        <p className="mt-auto flex items-start gap-1.5 text-[11px] leading-snug text-text-muted">
          <Activity className="mt-0.5 h-3 w-3 shrink-0 text-accent" aria-hidden="true" />
          <span>{metrics.insight}</span>
        </p>
      </div>
    </button>
  );
});
