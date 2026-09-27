import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Battery, Navigation, Camera, MapPin } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { OceanMap } from "@/components/map/OceanMapLazy";
import { drones, missions } from "@/data";
import { droneStatusMeta } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { routeMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return drones.map((d) => ({ id: d.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = drones.find((d) => d.id === id);
  if (!item) return routeMetadata({ title: "Drone", description: "Drone detail.", path: `/drones/${id}` });
  return routeMetadata({
    title: item.name,
    description: `${item.name} — autonomous ocean-surveillance drone. Status: ${item.status}. Depth ${item.depth}m, battery ${item.battery}%.`,
    path: `/drones/${id}`,
  });
}

export default async function DroneDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = drones.find((d) => d.id === id);
  if (!item) notFound();

  const droneMissions = missions.filter((m) => m.droneId === item.id);

  return (
    <DashboardShell title="Drone Detail" subtitle={item.name}>
      <Link
        href="/drones"
        className="mb-4 inline-flex items-center gap-1 text-sm text-ocean-200/60 hover:text-ocean-100"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Drone Center
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Live Position" icon={<Navigation className="h-4 w-4" />} />
          <OceanMap
            points={[
              {
                id: item.id,
                coordinates: item.position,
                color: item.status === "active" ? "#22e6a3" : item.status === "charging" ? "#fbbf24" : "#43d1ff",
                radius: 10,
                label: item.name,
              },
            ]}
            height="360px"
          />
        </Card>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Status" icon={<Battery className="h-4 w-4" />} />
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ocean-200/60">State</span>
                <span className={cn("font-semibold", droneStatusMeta[item.status].color)}>
                  {droneStatusMeta[item.status].label}
                </span>
              </div>
              <div>
                <div className="flex justify-between text-xs text-ocean-200/60">
                  <span>Battery</span>
                  <span>{item.battery}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-abyss-800">
                  <div
                    className={cn("h-full rounded-full", item.battery < 30 ? "bg-rose-500" : "bg-biolum-500")}
                    style={{ width: `${item.battery}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ocean-200/60">Depth</span>
                <span className="font-semibold text-white">{item.depth} m</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ocean-200/60">Speed</span>
                <span className="font-semibold text-white">{item.speed} kn</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ocean-200/60">Last Update</span>
                <span className="font-semibold text-white">{new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(item.lastUpdate))}</span>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Camera Feed" icon={<Camera className="h-4 w-4" />} />
            <div className="relative aspect-video overflow-hidden rounded-lg bg-abyss-950">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(34,230,163,0.25),transparent_60%)]" />
              <div className="absolute inset-0 flex items-center justify-center text-ocean-200/50">
                <Camera className="h-8 w-8 animate-pulse" />
              </div>
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/50 px-2 py-0.5 text-[10px] text-rose-300">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> REC
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader title="Mission History" icon={<MapPin className="h-4 w-4" />} />
        {droneMissions.length === 0 ? (
          <p className="py-6 text-center text-sm text-ocean-200/50">No missions recorded for this drone.</p>
        ) : (
          <div className="space-y-2">
            {droneMissions.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-lg bg-abyss-950/60 p-3">
                <div>
                  <p className="text-sm font-medium text-white">{m.name}</p>
                  <p className="text-xs text-ocean-200/60">{m.objective}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-ocean-200/60">{m.status}</p>
                  <p className="text-xs font-semibold text-white">{m.progress}%</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </DashboardShell>
  );
}
