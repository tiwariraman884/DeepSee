"use client";

/**
 * DroneDetailLive — backend-backed drone detail view.
 * ====================================================
 * The page used to render static mock data directly. The server component
 * above still provides SEO/metadata from the demo dataset, but the live view
 * below treats the backend as the source of truth:
 *
 *   - GET /api/drones/:id      → current state (status/battery/coords/mission)
 *   - GET /api/missions        → mission history for this drone
 *   - SSE drone_update events  → live position overlay while dispatched
 *
 * The static dataset is used only as a render fallback if the API is
 * unreachable (demo dataset semantics, not a second source of truth).
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Battery, Navigation, MapPin } from "lucide-react";
import { LiveCameraFeed } from "@/components/domain/LiveCameraFeed";
import { Card, CardHeader } from "@/components/ui/Card";
import { OceanMap } from "@/components/map/OceanMapLazy";
import { droneStatusMeta } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/useAppStore";
import type { Drone, Mission } from "@/types";

interface DroneApiShape {
  id: string; name: string; status: string; battery: number;
  position: { lat: number; lng: number };
  depth: number; speed: number; region: string;
  lastUpdate: string; currentMission: string | null;
}

export function DroneDetailLive({
  droneId,
  fallback,
}: {
  droneId: string;
  fallback: Drone | undefined;
}) {
  const [drone, setDrone] = useState<DroneApiShape | null>(
    fallback
      ? {
        id: fallback.id, name: fallback.name, status: fallback.status,
        battery: fallback.battery, position: fallback.position,
        depth: fallback.depth, speed: fallback.speed, region: fallback.region,
        lastUpdate: fallback.lastUpdate, currentMission: null,
      }
      : null
  );
  const [missions, setMissions] = useState<Mission[]>([]);
  const [isLive, setIsLive] = useState(false);
  const livePos = useAppStore((s) => s.dronePositions[droneId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [d, m] = await Promise.all([
          fetch(`/api/drones/${droneId}`).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
          fetch("/api/missions").then((r) => (r.ok ? r.json() : { missions: [] })),
        ]);
        if (cancelled) return;
        setDrone(d.drone ?? null);
        setMissions((m.missions ?? []).filter((x: Mission) => x.droneId === droneId));
        setIsLive(true);
      } catch {
        if (!cancelled) setIsLive(false); // keep fallback rendering
      }
    })();
    return () => { cancelled = true; };
  }, [droneId]);

  if (!drone) {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
        Drone <code>{droneId}</code> was not found in the fleet registry.
        <Link href="/drones" className="ml-2 underline">Back to Drone Center</Link>
      </div>
    );
  }

  const position = livePos ? { lat: livePos.lat, lng: livePos.lng } : drone.position;
  const status = livePos?.status ?? drone.status;
  const battery = livePos?.battery ?? drone.battery;
  const dispatching = !!livePos && livePos.status === "active";

  const droneMissions = missions.filter((m) => m.droneId === drone.id);

  return (
    <>
      <Link href="/drones" className="mb-4 inline-flex items-center gap-1 text-sm text-ocean-200/60 hover:text-ocean-100">
        <ArrowLeft className="h-4 w-4" /> Back to Drone Center
      </Link>

      {!isLive && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/80">
          Backend unreachable — showing demo dataset fallback.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Live Position"
            icon={<Navigation className="h-4 w-4" />}
            subtitle={dispatching ? "🚁 Dispatched — live SSE telemetry" : undefined}
          />
          <OceanMap
            points={[
              {
                id: drone.id,
                coordinates: position,
                color: dispatching ? "#ff6b35" : status === "active" ? "#22e6a3" : status === "charging" ? "#fbbf24" : "#43d1ff",
                radius: dispatching ? 14 : 10,
                label: dispatching ? `🚁 ${drone.name} — DISPATCHED` : drone.name,
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
                <span className={cn("font-semibold", droneStatusMeta[status as keyof typeof droneStatusMeta]?.color)}>
                  {droneStatusMeta[status as keyof typeof droneStatusMeta]?.label ?? status}
                </span>
              </div>
              <div>
                <div className="flex justify-between text-xs text-ocean-200/60">
                  <span>Battery</span><span>{battery}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-abyss-800">
                  <div
                    className={cn("h-full rounded-full", battery < 30 ? "bg-rose-500" : "bg-biolum-500")}
                    style={{ width: `${battery}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ocean-200/60">Depth</span>
                <span className="font-semibold text-white">{drone.depth} m</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ocean-200/60">Speed</span>
                <span className="font-semibold text-white">{drone.speed} kn</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ocean-200/60">Region</span>
                <span className="font-semibold text-white">{drone.region}</span>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Camera Feed" icon={<Battery className="h-4 w-4" />} subtitle="Software simulation · tied to active inspection" />
            <LiveCameraFeed />
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
    </>
  );
}

export default DroneDetailLive;
