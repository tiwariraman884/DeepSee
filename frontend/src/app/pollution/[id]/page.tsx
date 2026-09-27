import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin, TrendingUp, TrendingDown, ShieldAlert } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { OceanMap } from "@/components/map/OceanMapLazy";
import { pollution } from "@/data";
import { pollutionLabels, severityBand } from "@/lib/constants";
import { formatNumber, cn } from "@/lib/utils";
import { routeMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return pollution.map((p) => ({ id: p.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = pollution.find((p) => p.id === id);
  if (!item) return routeMetadata({ title: "Pollution Hotspot", description: "Pollution hotspot detail.", path: `/pollution/${id}` });
  return routeMetadata({
    title: item.name,
    description: `${item.name} — ${pollutionLabels[item.type]} pollution event. Severity: ${item.severity}. Concentration ${item.concentration} across ${item.affectedArea} km².`,
    path: `/pollution/${id}`,
  });
}

export default async function PollutionDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = pollution.find((p) => p.id === id);
  if (!item) notFound();

  const others = pollution.filter((p) => p.id !== id);

  return (
    <DashboardShell title="Pollution Hotspot" subtitle={item.name}>
      <Link
        href="/pollution"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ocean-200/60 hover:text-ocean-100"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Pollution
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Location" icon={<MapPin className="h-4 w-4" />} />
          <OceanMap
            points={[
              {
                id: item.id,
                coordinates: { lat: item.latitude, lng: item.longitude },
                color: "#fb7185",
                radius: 12,
                label: item.name,
              },
            ]}
            height="360px"
          />
        </Card>
        <Card>
          <CardHeader title="Details" icon={<ShieldAlert className="h-4 w-4" />} />
          <div className="space-y-3 text-sm">
            <DetailRow label="Type" value={pollutionLabels[item.type]} />
            <DetailRow
              label="Severity"
              value={
                <span className={cn("font-semibold", severityBand(item.severity).color)}>
                  {severityBand(item.severity).label} ({item.severity}/10)
                </span>
              }
            />
            <DetailRow label="Concentration" value={`${item.concentration} idx`} />
            <DetailRow label="Affected Area" value={`${formatNumber(item.affectedArea)} km²`} />
            <DetailRow label="Detected" value={new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.detectedAt))} />
            <DetailRow
              label="Trend"
              value={
                <span className={cn("flex items-center gap-1 font-semibold", item.trend === "increasing" ? "text-rose-300" : item.trend === "decreasing" ? "text-biolum-400" : "text-amber-300")}>
                  {item.trend === "increasing" ? <TrendingUp className="h-3.5 w-3.5" /> : item.trend === "decreasing" ? <TrendingDown className="h-3.5 w-3.5" /> : null}
                  {item.trend}
                </span>
              }
            />
            <DetailRow label="Coordinates" value={`${item.latitude.toFixed(2)}, ${item.longitude.toFixed(2)}`} />
          </div>
          <div className="mt-4 rounded-lg border border-ocean-500/15 bg-ocean-500/5 p-3">
            <p className="text-xs font-semibold text-ocean-100">Recommended Action</p>
            <p className="mt-1 text-sm text-ocean-200/70">
              Deploy drone patrol and containment units. Notify coastal authority for {pollutionLabels[item.type].toLowerCase()} response protocol.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Other Hotspots" />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((o) => (
            <Link
              key={o.id}
              href={`/pollution/${o.id}`}
              className="flex items-center justify-between rounded-lg border border-ocean-500/10 p-3 hover:bg-ocean-500/5"
            >
              <span className="text-sm text-white">{o.name}</span>
              <span className={cn("text-xs font-semibold", severityBand(o.severity).color)}>
                {severityBand(o.severity).label} ({o.severity}/10)
              </span>
            </Link>
          ))}
        </div>
      </Card>
    </DashboardShell>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-ocean-500/10 pb-2">
      <span className="text-ocean-200/60">{label}</span>
      <span className="font-medium text-white">{value}</span>
    </div>
  );
}
