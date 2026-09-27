"use client";

import React, { useRef, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polyline, Tooltip, useMapEvents } from "react-leaflet";
import type { Coordinates } from "@/types";
import { cn } from "@/lib/utils";

// CARTO now requires an API key on its raster basemap tiles (policy effective
// 23 Sep 2026): without one every tile is swapped for an "API key required"
// placeholder, so the map renders a grid of watermarks instead of the ocean.
// Put your key in frontend/.env.local as NEXT_PUBLIC_CARTO_BASMAPS_KEY (request
// a free one at https://carto.com/basemaps/apikey/). When the key is unset we
// fall back to OpenStreetMap's key-free tiles, darkened in CSS so the map keeps
// its dark theme instead of turning into a light basemap.
const CARTO_BASMAPS_KEY = process.env.NEXT_PUBLIC_CARTO_BASMAPS_KEY?.trim();

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Providers require visible attribution on every basemap, keyed and free alike.
const basemap = CARTO_BASMAPS_KEY
  ? {
      url: `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png?key=${CARTO_BASMAPS_KEY}`,
      attribution: `${OSM_ATTRIBUTION} &copy; <a href="https://carto.com/attribution/">CARTO</a>`,
    }
  : {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: OSM_ATTRIBUTION,
    };

export interface MapPoint {
  id: string;
  coordinates: Coordinates;
  color: string;
  radius?: number;
  label: string;
  popup?: React.ReactNode;
}

export const OceanMap = React.memo(function OceanMap({
  points,
  routes,
  center = [15, 0],
  zoom = 2,
  height = "420px",
  onMarkerClick,
  onViewportChange,
}: {
  points: MapPoint[];
  routes?: { id: string; path: Coordinates[]; color?: string }[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onMarkerClick?: (id: string) => void;
  onViewportChange?: (center: [number, number], zoom: number) => void;
}) {
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const viewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function ViewportTracker() {
    useMapEvents({
      moveend: (e) => {
        const map = e.target;
        const c = map.getCenter();
        const center: [number, number] = [c.lat, c.lng];
        const zoom = map.getZoom();
        if (viewportTimer.current) clearTimeout(viewportTimer.current);
        viewportTimer.current = setTimeout(() => {
          onViewportChangeRef.current?.(center, zoom);
        }, 200);
      },
    });
    return null;
  }
  const memoizedRoutes = useMemo(() => {
    return routes?.map((r) => (
      <Polyline
        key={r.id}
        positions={r.path.map((p) => [p.lat, p.lng])}
        pathOptions={{ color: r.color ?? "#43d1ff", weight: 2, dashArray: "4 6" }}
      />
    ));
  }, [routes]);

  const handleMarkerClick = useCallback((id: string) => {
    onMarkerClick?.(id);
  }, [onMarkerClick]);

  const memoizedPoints = useMemo(() => {
    return points.map((p) => (
      <CircleMarker
        key={p.id}
        center={[p.coordinates.lat, p.coordinates.lng]}
        radius={p.radius ?? 8}
        pathOptions={{
          color: p.color,
          fillColor: p.color,
          fillOpacity: 0.6,
          weight: 1.5,
          className: "marker-drop",
        }}
        eventHandlers={{ click: () => handleMarkerClick(p.id) }}
      >
        <Tooltip>{p.label}</Tooltip>
        {onMarkerClick && <Popup>Click to inspect</Popup>}
        {p.popup && <Popup>{p.popup}</Popup>}
      </CircleMarker>
    ));
  }, [points, handleMarkerClick, onMarkerClick]);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-ocean-500/15",
        !CARTO_BASMAPS_KEY && "deepsea-basemap-fallback"
      )}
      style={{ height }}
    >
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          url={basemap.url}
          attribution={basemap.attribution}
          detectRetina={true}
          updateWhenIdle={true}
          updateWhenZooming={false}
          keepBuffer={2}
          crossOrigin
          {...{ fetchPriority: "low" } as Record<string, unknown>}
        />
        {onViewportChange && <ViewportTracker />}
        {memoizedRoutes}
        {memoizedPoints}
      </MapContainer>
    </div>
  );
});
