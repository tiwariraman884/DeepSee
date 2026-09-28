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
// Note: useSSEStream is mounted in the layout — no need to mount it here again.
// We read drone state directly from the global Zustand store.

export default function DronesPage() {
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

  // Build map points — SSE live position takes priority over static DB position
  const mapPoints = drones
    .filter((d) => d.status !== "offline")
    .map((d) => {
      const livePos = dronePositions[d.id];
      const finalPos = livePos
        ? { lat: livePos.lat, lng: livePos.lng }
        : d.position;
      const isDispatched = !!livePos && livePos.status === "active";

      return {
        id: d.id,
        coordinates: finalPos,
        color: isDispatched ? "#ff6b35" : d.status === "active" ? "#22e6a3" : d.status === "charging" ? "#fbbf24" : "#43d1ff",
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

  const allMapPoints = [...mapPoints, ...anomalyMarker];

  // Mission path: from drone origin → anomaly target
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

      routes.push({
        id: "mission-path",
        path: droneDispatch.path
          ? droneDispatch.path
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

