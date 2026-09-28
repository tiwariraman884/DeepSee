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
import { ArrowLeft, Battery, Navigation, MapPin, Waves, Gauge, Globe2, Wifi } from "lucide-react";
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

  const position = livePos ? { lat: livePos.lat, lng: livePos.lng } : drone?.position ?? { lat: 0, lng: 0 };
  const status = livePos?.status ?? drone?.status ?? "idle";
  const battery = livePos?.battery ?? drone?.battery ?? 0;
  const dispatching = !!livePos && livePos.status === "active";
  // Inspection context comes from the shared live state (SSE-fed) when this
  // drone is the dispatched unit — otherwise the detail page shows fleet-only data.
  const inspection = useAppStore((s) => s.inspection);
  const sseConnected = useAppStore((s) => s.sseConnected);
  const activeInspection = inspection && inspection.droneId === droneId ? inspection : null;

  const droneMissions = missions.filter((m) => m.droneId === drone?.id);

  if (!drone) {
    return (
      <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
        Drone <code>{droneId}</code> was not found in the fleet registry.
        <Link href="/drones" className="ml-2 underline">Back to Drone Center</Link>
      </div>
    );
  }

  return (
    <>
      <Link href="/drones" className="mb-4 inline-flex items-center gap-1 text-sm text-ocean-200/60 hover:text-ocean-100">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to Drone Center
      </Link>

      {!isLive && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200/80">
          Backend unreachable — showing demo dataset fallback.
        </p>
      )}

      {/* ── Live telemetry strip (backend + SSE source of truth) ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2" aria-label="Live telemetry">
        <span
          className={cn(
            "rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
            dispatching ? "bg-orange-500/15 text-orange-300" : "bg-cyan-500/15 text-cyan-300"
          )}
        >
          {droneStatusMeta[status as keyof typeof droneStatusMeta]?.label ?? status}
        </span>
        <span
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
            sseConnected ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"
          )}
        >
          <Wifi className="h-3 w-3" aria-hidden="true" />
          {sseConnected ? "SSE Live" : "SSE Offline"}
        </span>
        <span className="rounded bg-white/[0.04] px-2 py-1 font-mono text-[10px] text-ocean-200/70">
          {position.lat.toFixed(4)}°, {position.lng.toFixed(4)}°
        </span>
      </div>

      {activeInspection && (
        <div className="mb-4 rounded-lg border border-orange-500/40 bg-orange-500/[0.07] px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-orange-300">
            Active Inspection · {activeInspection.phase.toUpperCase()} · {activeInspection.progress}%
          </p>
          <p className="mt-0.5 text-[11px] text-orange-200/80">
            Target: <span className="font-semibold text-white">{activeInspection.location}</span>
            {activeInspection.selection && <> · ETA: {activeInspection.selection.etaDisplay}</>}
          </p>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="order-2 lg:order-1 lg:col-span-2">
          <CardHeader
            title="Live Position"
            icon={<Navigation className="h-4 w-4" />}
            subtitle={dispatching ? "Dispatched — live SSE telemetry" : undefined}
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
        <div className="order-1 space-y-4 lg:order-2">
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
                  <span>Battery</span><span className="font-mono tabular-nums">{battery}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-abyss-800" role="progressbar" aria-valuenow={battery} aria-valuemin={0} aria-valuemax={100} aria-label="Battery level">
                  <div
                    className={cn("h-full rounded-full", battery < 30 ? "bg-rose-500" : "bg-biolum-500")}
                    style={{ width: `${battery}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-ocean-200/60"><Waves className="h-3.5 w-3.5" aria-hidden="true" /> Depth</span>
                <span className="font-mono font-semibold tabular-nums text-white">{drone.depth} m</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-ocean-200/60"><Gauge className="h-3.5 w-3.5" aria-hidden="true" /> Speed</span>
                <span className="font-mono font-semibold tabular-nums text-white">{drone.speed} kn</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-ocean-200/60"><Globe2 className="h-3.5 w-3.5" aria-hidden="true" /> Region</span>
                <span className="font-semibold text-white">{drone.region}</span>
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Live Camera Feed" icon={<Battery className="h-4 w-4" />} subtitle="Simulated ROV feed · tied to active inspection" />
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
