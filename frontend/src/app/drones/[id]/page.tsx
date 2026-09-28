import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { DroneDetailLive } from "@/components/domain/DroneDetailLive";
import { drones } from "@/data";
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
  // Static dataset is used ONLY for SEO metadata and as an offline render
  // fallback — the live view below treats the backend as the source of truth.
  const fallback = drones.find((d) => d.id === id);
  if (!fallback) notFound();

  return (
    <DashboardShell title="Drone Detail" subtitle={fallback.name}>
      <DroneDetailLive droneId={id} fallback={fallback} />
    </DashboardShell>
  );
}
