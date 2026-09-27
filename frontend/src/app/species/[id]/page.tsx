import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Fish, TrendingUp, TrendingDown, MapPin } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { OceanMap } from "@/components/map/OceanMapLazy";
import { species } from "@/data";
import { statusLabels } from "@/lib/constants";
import { formatNumber, cn } from "@/lib/utils";
import { routeMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return species.map((s) => ({ id: s.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = species.find((s) => s.id === id);
  if (!item) return routeMetadata({ title: "Species", description: "Marine species detail.", path: `/species/${id}` });
  return routeMetadata({
    title: item.name,
    description: `${item.name} — ${item.scientificName}. Conservation status: ${statusLabels[item.status]}. Population trend: ${item.populationTrend}.`,
    path: `/species/${id}`,
  });
}

const statusColors: Record<string, string> = {
  least_concern: "#34d399",
  near_threatened: "#a3e635",
  vulnerable: "#fbbf24",
  endangered: "#fb923c",
  critically_endangered: "#fb7185",
};

function years(pop: number[], trend: string) {
  if (pop.length >= 5) return pop.slice(-5);
  const last = pop[pop.length - 1] ?? 50;
  return Array.from({ length: 5 }, (_, i) => {
    const drift = trend === "decreasing" ? -i * 4 : trend === "increasing" ? i * 3 : Math.sin(i) * 3;
    return Math.max(10, Math.round(last + drift + (i % 2) * 2));
  });
}

export default async function SpeciesDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = species.find((s) => s.id === id);
  if (!item) notFound();

  const series = years(item.population, item.populationTrend);
  const max = Math.max(...series);
  const threats = [
    "Habitat degradation",
    "Climate-driven temperature rise",
    "Illegal fishing pressure",
    "Pollution accumulation",
  ];

  return (
    <DashboardShell title="Species Detail" subtitle={item.name}>
      <Link
        href="/species"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ocean-200/60 hover:text-ocean-100"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Species
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Population Trend (6-year)" icon={<Fish className="h-4 w-4" />} />
          <div className="flex h-48 items-end gap-2">
            {series.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-ocean-500/60"
                  style={{ height: `${(d / max) * 100}%` }}
                  title={`Y${i + 1}: ${d}`}
                />
                <span className="text-[10px] text-ocean-200/50">Y{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-ocean-200/60">Habitat Map</p>
            <div className="mt-2">
              <OceanMap
                points={[
                  {
                    id: item.id,
                    coordinates: item.coordinates,
                    color: statusColors[item.status],
                    radius: 9,
                    label: item.name,
                  },
                ]}
                height="260px"
              />
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Profile" icon={<Fish className="h-4 w-4" />} />
          <div className="space-y-3 text-sm">
            <div>
              <p className="text-ocean-200/50">Scientific Name</p>
              <p className="italic text-white">{item.scientificName}</p>
            </div>
            <div>
              <p className="text-ocean-200/50">Status</p>
              <p className="font-semibold" style={{ color: statusColors[item.status] }}>
                {statusLabels[item.status]}
              </p>
            </div>
            <div>
              <p className="text-ocean-200/50">Population</p>
              <p className="font-semibold text-white">{formatNumber(item.population[item.population.length - 1])}</p>
            </div>
            <div>
              <p className="text-ocean-200/50">Trend</p>
              <p className={cn("flex items-center gap-1 font-semibold", item.populationTrend === "decreasing" ? "text-rose-300" : item.populationTrend === "increasing" ? "text-biolum-400" : "text-amber-300")}>
                {item.populationTrend === "decreasing" ? <TrendingDown className="h-3.5 w-3.5" /> : item.populationTrend === "increasing" ? <TrendingUp className="h-3.5 w-3.5" /> : null}
                {item.populationTrend}
              </p>
            </div>
            <div>
              <p className="text-ocean-200/50">Habitat</p>
              <p className="font-semibold text-white">{item.habitat}</p>
            </div>
            <div>
              <p className="text-ocean-200/50">Region</p>
              <p className="font-semibold text-white">{item.region}</p>
            </div>
            <div>
              <p className="text-ocean-200/50">Conservation Progress</p>
              <p className="font-semibold text-white">{item.conservationProgress}%</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-xs font-semibold text-ocean-200/60">Threats</p>
            <ul className="mt-2 space-y-1">
              {threats.map((t) => (
                <li key={t} className="flex items-center gap-2 text-sm text-ocean-200/70">
                  <MapPin className="h-3.5 w-3.5 text-coral-400" /> {t}
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
