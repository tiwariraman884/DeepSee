"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { OceanMap } from "@/components/map/OceanMapLazy";
import type { MapPoint } from "@/components/map/OceanMap";
import type { Coordinates } from "@/types";
import { cn } from "@/lib/utils";

export type MapLayer = "heatmap" | "drones" | "sensors" | "species";

const layerMeta: Record<MapLayer, { label: string; color: string }> = {
  heatmap: { label: "Pollution", color: "#EF4444" },
  drones: { label: "Drones", color: "#0EA5E9" },
  sensors: { label: "Sensors", color: "#a78bfa" },
  species: { label: "Species", color: "#10B981" },
};

export function MapCard({
  points,
  routes,
  legend = true,
  layers,
  center = [15, 0],
  zoom = 2,
  onMarkerClick,
  onViewportChange,
  className,
  height = "420px",
}: {
  points: MapPoint[];
  routes?: { id: string; path: Coordinates[]; color?: string }[];
  legend?: boolean;
  layers?: MapLayer[];
  center?: [number, number];
  zoom?: number;
  onMarkerClick?: (id: string) => void;
  onViewportChange?: (center: [number, number], zoom: number) => void;
  className?: string;
  height?: string;
}) {
  const [showList, setShowList] = useState(false);
  const activeLayers = layers ?? ["heatmap"];
  const clusterThreshold = 8;

  const [zoomState, setZoomState] = useState(zoom);
  useEffect(() => setZoomState(zoom), [zoom]);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleViewport = (c: [number, number], z: number) => {
    setZoomState(z);
    if (!onViewportChange) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onViewportChange(c, z), 250);
  };

  const displayed = useMemo(() => {
    if (zoomState >= clusterThreshold || points.length === 0) return points;
    const clusters = new Map<string, MapPoint & { count: number }>();
    for (const p of points) {
      const key = `${Math.floor(p.coordinates.lat / 10)}:${Math.floor(p.coordinates.lng / 10)}`;
      const existing = clusters.get(key);
      if (existing) {
        existing.count += 1;
        existing.radius = Math.min(24, 8 + existing.count);
      } else {
        clusters.set(key, { ...p, count: 1, radius: 8 });
      }
    }
    return Array.from(clusters.values()).map((c) => ({
      ...c,
      label: c.count > 1 ? `${c.label} ×${c.count}` : c.label,
    }));
  }, [points, zoomState]);

  return (
    <div className={cn("overflow-hidden rounded-card border border-white/10", className)}>
      <OceanMap
        points={displayed.map((p) => ({
          ...p,
          popup: onMarkerClick ? undefined : p.popup,
        }))}
        routes={routes}
        height={height}
        center={center}
        zoom={zoomState}
        onMarkerClick={onMarkerClick}
        onViewportChange={handleViewport}
      />
      {legend && (
        <div className="flex flex-wrap items-center gap-3 border-t border-white/10 bg-secondary/40 px-3 py-2 text-xs text-text-muted">
          {activeLayers.map((l) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: layerMeta[l].color }} />
              {layerMeta[l].label}
            </span>
          ))}
          <button
            type="button"
            onClick={() => setShowList((v) => !v)}
            aria-expanded={showList}
            className="ml-auto rounded-control border border-white/10 px-2 py-1 text-text-muted hover:text-text-primary"
          >
            {showList ? "Hide list" : "List view"}
          </button>
        </div>
      )}
      {showList && (
        <ul className="max-h-48 space-y-1 overflow-y-auto border-t border-white/10 bg-secondary/40 p-2 text-xs">
          {points.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onMarkerClick?.(p.id)}
                className="w-full rounded px-2 py-1 text-left hover:bg-white/5"
              >
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      <ul className="sr-only">
        {points.map((p) => (
          <li key={`sr-${p.id}`}>{p.label}</li>
        ))}
      </ul>
    </div>
  );
}
