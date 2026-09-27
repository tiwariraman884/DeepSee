"use client";

import { useState } from "react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { OceanMap } from "@/components/map/OceanMapLazy";
import { pollution, species, drones, sensors } from "@/data";
import { pollutionLabels, severityMarkerColor, severityRadius, severityBand } from "@/lib/constants";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Layer = "pollution" | "species" | "drones" | "sensors";

const legend: Record<Layer, { color: string; label: string }[]> = {
  pollution: [
    { color: "#fb7185", label: "Critical" },
    { color: "#fb923c", label: "High" },
    { color: "#fbbf24", label: "Medium" },
    { color: "#34d399", label: "Low" },
  ],
  species: [{ color: "#22e6a3", label: "Tracked species" }],
  drones: [{ color: "#43d1ff", label: "Drone position" }],
  sensors: [{ color: "#a78bfa", label: "IoT sensor" }],
};

export default function MapPage() {
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    pollution: true,
    species: true,
    drones: true,
    sensors: true,
  });

  const points = [
    ...(layers.pollution
      ? pollution.map((p) => ({
          id: `p-${p.id}`,
          coordinates: { lat: p.latitude, lng: p.longitude },
          color: severityMarkerColor(p.severity),
          radius: severityRadius(p.severity),
          label: p.name,
          popup: (
            <div>
              <p className="font-semibold">{p.name}</p>
              <p className="text-xs">{pollutionLabels[p.type]}</p>
            </div>
          ),
        }))
      : []),
    ...(layers.species
      ? species.map((s) => ({
          id: `s-${s.id}`,
          coordinates: s.coordinates,
          color: "#22e6a3",
          radius: 7,
          label: s.name,
          popup: (
            <div>
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs">{s.region}</p>
            </div>
          ),
        }))
      : []),
    ...(layers.drones
      ? drones
          .filter((d) => d.status !== "offline")
          .map((d) => ({
            id: `d-${d.id}`,
            coordinates: d.position,
            color: "#43d1ff",
            radius: 6,
            label: d.name,
            popup: (
              <div>
                <p className="font-semibold">{d.name}</p>
                <p className="text-xs">Depth {d.depth}m · Battery {d.battery}%</p>
              </div>
            ),
          }))
      : []),
    ...(layers.sensors
      ? sensors.map((s) => ({
          id: `se-${s.id}`,
          coordinates: s.coordinates,
          color: "#a78bfa",
          radius: 5,
          label: s.name,
          popup: (
            <div>
              <p className="font-semibold">{s.name}</p>
              <p className="text-xs">
                {s.lastReading.temp ?? s.lastReading.salinity ?? s.lastReading.ph ?? s.lastReading.oxygen ?? s.lastReading.turbidity ?? "—"} · {s.status}
              </p>
            </div>
          ),
        }))
      : []),
  ];

  return (
    <DashboardShell title="Interactive Ocean Map" subtitle="Pollution, species, drones & sensors">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-3">
          <Card className="p-3">
            <OceanMap points={points} height="560px" />
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Map Layers" />
            <div className="space-y-2">
              {(Object.keys(layers) as Layer[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayers((s) => ({ ...s, [l]: !s[l] }))}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm capitalize transition-colors",
                    layers[l]
                      ? "border-ocean-400/40 bg-ocean-500/10 text-ocean-100"
                      : "border-ocean-500/10 text-ocean-200/70"
                  )}
                >
                  <span>{l}</span>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      layers[l] ? "bg-biolum-400" : "bg-abyss-700"
                    )}
                  />
                </button>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Legend" />
            {(
              Object.keys(legend) as Layer[]
            ).map((l) =>
              layers[l] ? (
                <div key={l} className="mb-3">
                  <p className="mb-1 text-xs uppercase tracking-wide text-ocean-200/70">
                    {l}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {legend[l].map((item) => (
                      <span
                        key={item.label}
                        className="flex items-center gap-1.5 text-xs text-ocean-200/70"
                      >
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.label}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </Card>
          <Card>
            <CardHeader title="Top Hotspots" />
            <div className="space-y-2">
              {pollution
                .slice()
                .sort((a, b) => b.concentration - a.concentration)
                .slice(0, 4)
                .map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-ocean-200/70">{p.name}</span>
                    <span className={cn(severityBand(p.severity).color, "font-semibold")}>
                      {p.concentration}
                    </span>
                  </div>
                ))}
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
