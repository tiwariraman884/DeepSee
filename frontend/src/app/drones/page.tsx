"use client";

import { useEffect, useState } from "react";
import { Radio, Navigation, Camera, MapPin } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DroneCard } from "@/components/domain/DroneCard";
import { LiveCameraFeed } from "@/components/domain/LiveCameraFeed";
import { InspectionConsole } from "@/components/domain/InspectionConsole";
import { DispatchHeader } from "@/components/domain/DispatchHeader";
import { droneStatusMeta } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Drone, Mission } from "@/types";
import { OceanMap } from "@/components/map/OceanMapLazy";
import { useAppStore } from "@/store/useAppStore";
import { useActiveMissionSync } from "@/hooks/useActiveMissionSync";
// Note: useSSEStream is mounted in the layout — no need to mount it here again.
// We read drone state directly from the global Zustand store.

export default function DronesPage() {
  // Late joiners (tab opened mid-mission) hydrate the persisted mission.
  useActiveMissionSync();
  const [drones, setDrones] = useState<Drone[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const droneDispatch = useAppStore((s) => s.droneDispatch);
  const dronePositions = useAppStore((s) => s.dronePositions);

  useEffect(() => {
    Promise.all([
      fetch("/api/drones").then((r) => r.json()),
      fetch("/api/missions").then((r) => r.json()),
    ])
      .then(([d, m]) => {
        setDrones(d.drones ?? []);
        setMissions(m.missions ?? []);
      })
      .catch(() => {});
  }, []);

  // Build map points — SSE live position takes priority over static DB position.
  // Status is resolved from the live stream first: a dispatched drone whose REST
  // row still says "offline"/"idle" must NOT be filtered off the map.
  const mapPoints = drones
    .map((d) => ({ d, livePos: dronePositions[d.id] }))
    .filter(({ d, livePos }) => (livePos?.status ?? d.status) !== "offline")
    .map(({ d, livePos }) => {
      const finalPos = livePos
        ? { lat: livePos.lat, lng: livePos.lng }
        : d.position;
      const status = livePos?.status ?? d.status;
      const isDispatched = !!livePos && livePos.status === "active";

      return {
        id: d.id,
        coordinates: finalPos,
        color: isDispatched ? "#ff6b35" : status === "active" ? "#22e6a3" : status === "charging" ? "#fbbf24" : "#43d1ff",
        radius: isDispatched ? 14 : 8,
        label: isDispatched ? `🚁 ${d.name} — DISPATCHED` : d.name,
        popup: (
          <div>
            <p className="font-semibold">{d.name}</p>
            <p className="text-xs">Battery {livePos?.battery ?? d.battery}%</p>
            {isDispatched && <p className="text-xs text-orange-400 font-bold mt-1">🚁 En Route to Anomaly</p>}
          </div>
        ),
      };
    });

  // Drones present only in the live stream (dispatched before the fleet snapshot
  // loaded) still need a marker, otherwise the dispatched unit vanishes.
  const knownDroneIds = new Set(drones.map((d) => d.id));
  const liveOnlyPoints = Object.values(dronePositions)
    .filter((p) => !knownDroneIds.has(p.id) && p.status !== "offline")
    .map((p) => ({
      id: p.id,
      coordinates: { lat: p.lat, lng: p.lng },
      color: p.status === "active" ? "#ff6b35" : "#43d1ff",
      radius: p.status === "active" ? 14 : 8,
      label: p.status === "active" ? `🚁 ${p.name ?? p.id} — DISPATCHED` : p.name ?? p.id,
    }));

  // Anomaly target marker (red pulsing point)
  const anomalyMarker =
    droneDispatch?.targetLat && droneDispatch?.targetLng
      ? [
          {
            id: "anomaly-target",
            coordinates: { lat: droneDispatch.targetLat, lng: droneDispatch.targetLng },
            color: "#ef4444",
            radius: 16,
            label: `🚨 Anomaly: ${droneDispatch.location}`,
            popup: (
              <div>
                <p className="font-bold text-red-400">🚨 Active Anomaly</p>
                <p className="text-xs">{droneDispatch.location}</p>
                <p className="text-xs">Drone inbound • ETA ~60s</p>
              </div>
            ),
          },
        ]
      : [];

  const allMapPoints = [...mapPoints, ...liveOnlyPoints, ...anomalyMarker];

  // Mission path: from drone origin → live position → anomaly target
  const missionRoutes = (() => {
    const routes: { id: string; path: { lat: number; lng: number }[]; color?: string }[] = [];

    if (
      droneDispatch?.targetLat &&
      droneDispatch?.targetLng &&
      droneDispatch?.originLat &&
      droneDispatch?.originLng
    ) {
      // Live drone position if available
      const liveDrone = dronePositions[droneDispatch.droneId];
      const currentLat = liveDrone?.lat ?? droneDispatch.originLat;
      const currentLng = liveDrone?.lng ?? droneDispatch.originLng;

      // Prefer the backend-computed maritime searoute (full curve) when the
      // dispatch carried it; otherwise fall back to the straight 3-point
      // origin → current → target segment.
      const seaPath = droneDispatch.path;
      routes.push({
        id: "mission-path",
        path:
          seaPath && seaPath.length >= 2
            ? seaPath
            : [
                { lat: droneDispatch.originLat, lng: droneDispatch.originLng },
                { lat: currentLat, lng: currentLng },
                { lat: droneDispatch.targetLat, lng: droneDispatch.targetLng },
              ],
        color: "#ff6b35",
      });
    }

    // Static active mission routes
    missions
      .filter((m) => m.status === "active")
      .forEach((m) => {
        if (!droneDispatch || !dronePositions[droneDispatch.droneId]) {
          routes.push({ id: m.id, path: m.route, color: "#43d1ff" });
        }
      });

    return routes;
  })();

  return (
    <DashboardShell title="Drone Command Center" subtitle="Autonomous marine operations · live fleet & mission control">

      {/* ── AUTONOMOUS RESPONSE HEADER (or FLEET READY standby) ── */}
      <DispatchHeader />

      {/* ── MAIN: map + camera (mobile: camera first, then map) ── */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="order-2 lg:order-1 lg:col-span-2">
          <Card className="p-3">
            <CardHeader
              title="Live Mission Map"
              icon={<Navigation className="h-4 w-4" />}
              subtitle={
                droneDispatch
                  ? "Active dispatch — orange path = mission route"
                  : "Fleet monitoring mode"
              }
            />
            <OceanMap points={allMapPoints} routes={missionRoutes} height="460px" />
          </Card>
        </div>
        <div className="order-1 space-y-4 lg:order-2">
          <Card>
            <CardHeader
              title="Live Camera Feed"
              icon={<Camera className="h-4 w-4" />}
              subtitle="Simulated ROV feed · tied to active inspection"
            />
            <LiveCameraFeed />
          </Card>
          <Card>
            <CardHeader title="Fleet Status" icon={<Radio className="h-4 w-4" />} />
            <div className="space-y-2">
              {(["active", "returning", "charging", "idle", "offline"] as const).map((st) => {
                const count = drones.filter((d) => d.status === st).length;
                if (!count) return null;
                return (
                  <div key={st} className="flex items-center justify-between text-sm">
                    <span className={cn("flex items-center gap-2", droneStatusMeta[st].color)}>
                      <span className={cn("h-2 w-2 rounded-full", droneStatusMeta[st].dot)} />
                      {droneStatusMeta[st].label}
                    </span>
                    <span className="text-ocean-200/70">{count}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      {/* ── BOTTOM: mission strip + AI / evidence / timeline ── */}
      <div className="mt-4">
        <InspectionConsole />
      </div>

      <div className="mt-4 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {drones.map((d) => (
          <DroneCard key={d.id} drone={d} />
        ))}
      </div>

      <Card className="mt-4">
        <CardHeader title="Mission History" icon={<MapPin className="h-4 w-4" />} />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-ocean-200/50">
                <th className="pb-2 pr-2 font-medium">Mission</th>
                <th className="pb-2 pr-2 font-medium">Drone</th>
                <th className="pb-2 pr-2 font-medium">Objective</th>
                <th className="pb-2 pr-2 font-medium">Progress</th>
                <th className="pb-2 pr-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {missions.map((m) => (
                <tr key={m.id} className="border-t border-ocean-500/10">
                  <td className="py-2 pr-2 font-medium text-white">{m.name}</td>
                  <td className="py-2 pr-2 text-ocean-200/70">{m.droneName}</td>
                  <td className="py-2 pr-2 text-ocean-200/70">{m.objective}</td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-abyss-800">
                        <div className="h-full rounded-full bg-ocean-500" style={{ width: `${m.progress}%` }} />
                      </div>
                      <span className="text-ocean-200/60">{m.progress}%</span>
                    </div>
                  </td>
                  <td className="py-2 pr-2">
                    <Badge
                      label={m.status}
                      variant={m.status === "active" ? "success" : m.status === "completed" ? "info" : "warning"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </DashboardShell>
  );
}

