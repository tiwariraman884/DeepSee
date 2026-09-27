"use client";

import { useEffect, useState } from "react";
import { Radio, Navigation, Camera, MapPin, Play } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DroneCard } from "@/components/domain/DroneCard";
import { droneStatusMeta } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Coordinates, Drone, Mission } from "@/types";
import { OceanMap } from "@/components/map/OceanMapLazy";


function interpolate(a: Coordinates, b: Coordinates, t: number): Coordinates {
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

function useSimulatedPositions(routes: { id: string; path: Coordinates[] }[]) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, []);
  return routes.map((r) => {
    const seg = tick % (r.path.length - 1);
    const t = (tick % 1) + ((Math.floor(tick) % 10) / 10);
    const pos = interpolate(r.path[seg], r.path[seg + 1] ?? r.path[0], t % 1);
    return { id: r.id, pos };
  });
}

export default function DronesPage() {
  const [drones, setDrones] = useState<Drone[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);

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

  const activeMissions = missions.filter((m) => m.status === "active");
  const sim = useSimulatedPositions(activeMissions.map((m) => ({ id: m.id, path: m.route })));

  const mapPoints = drones
    .filter((d) => d.status !== "offline")
    .map((d) => {
      const mission = activeMissions.find((m) => m.droneId === d.id);
      const simPos = mission ? sim.find((s) => s.id === mission.id)?.pos : undefined;
      return {
        id: d.id,
        coordinates: simPos ?? d.position,
        color: d.status === "active" ? "#22e6a3" : d.status === "charging" ? "#fbbf24" : "#43d1ff",
        radius: 8,
        label: d.name,
        popup: (
          <div>
            <p className="font-semibold">{d.name}</p>
            <p className="text-xs">Depth {d.depth}m · Battery {d.battery}%</p>
          </div>
        ),
      };
    });

  const routes = activeMissions.map((m) => ({ id: m.id, path: m.route, color: "#43d1ff" }));

  return (
    <DashboardShell title="Underwater Drone Command Center" subtitle="Live fleet tracking & mission control">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="p-3">
            <CardHeader title="Live Fleet Tracking" icon={<Navigation className="h-4 w-4" />} />
            <OceanMap points={mapPoints} routes={routes} height="420px" />
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Camera Feed" icon={<Camera className="h-4 w-4" />} />
            <div className="relative aspect-video overflow-hidden rounded-lg bg-abyss-950">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(34,230,163,0.25),transparent_60%)]">
                <div className="absolute inset-0 animate-pulse-ring" style={{ left: "50%", top: "60%" }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-ocean-200/50">
                <Camera className="h-8 w-8 animate-pulse" />
              </div>
              <div className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/50 px-2 py-0.5 text-[10px] text-rose-300">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> REC
              </div>
              <div className="absolute bottom-2 right-2 text-[10px] text-ocean-200/50">Nautilus-01 · 1240m</div>
            </div>
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
