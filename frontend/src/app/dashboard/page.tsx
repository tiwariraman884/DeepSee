"use client";

import { Suspense, useState, useMemo } from "react";

import dynamic from "next/dynamic";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton, EmptyState } from "@/components/ui/States";
import { MapCard, type MapLayer } from "@/components/map/MapCard";
import { TimeMachine } from "@/components/innovation/TimeMachine";
import {
  pollution,
  species,
  drones,
  alerts,
  sensors,
} from "@/data";
import { oceanHealth } from "@/data/metrics";
import { pollutionLabels, alertMeta } from "@/lib/constants";
import { relativeTime, formatDate } from "@/lib/utils";
import { useAppStore, type DronePositionInfo } from "@/store/useAppStore";
import { useLiveKpis } from "@/hooks/useLiveKpis";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useEffect } from "react";
import {
  Waves,
  Radio,
  AlertTriangle,
  Fish,
  Gauge as GaugeIcon,
  Shield,
  RefreshCw,
  Maximize2,
  Minimize2,
  Clock,
} from "lucide-react";
import type { MapPoint } from "@/components/map/OceanMap";

const MAP_LAYERS: MapLayer[] = ["heatmap", "drones", "sensors"];

const DashboardCharts = dynamic(() => import("@/app/dashboard/DashboardCharts").then((m) => m.DashboardCharts), {
  ssr: false,
  loading: () => (
    <section className="grid gap-4 lg:grid-cols-2" style={{ minHeight: 300 }}>
      <Skeleton className="h-full w-full rounded-xl" />
      <Skeleton className="h-full w-full rounded-xl" />
    </section>
  ),
});

function severityColor(sev: number) {
  return sev >= 9
    ? "#fb7185"
    : sev >= 7
    ? "#fb923c"
    : sev >= 4
    ? "#fbbf24"
    : "#34d399";
}

function buildMapPoints(
  activeLayers: MapLayer[],
  intensity = 1,
  dronePositions: Record<string, DronePositionInfo> = {}
): MapPoint[] {
  const points: MapPoint[] = [];
  if (activeLayers.includes("heatmap")) {
    for (const p of pollution) {
      const sevBoost = p.severity >= 9 ? 13 : p.severity >= 7 ? 10 : 7;
      points.push({
        id: p.id,
        coordinates: { lat: p.latitude, lng: p.longitude },
        color: severityColor(p.severity),
        radius: Math.round(sevBoost * (0.7 + intensity * 0.5)),
        label: p.name,
        popup: (
          <div>
            <p className="font-semibold">{p.name}</p>
            <p className="text-xs">{pollutionLabels[p.type]}</p>
          </div>
        ),
      });
    }
  }
  if (activeLayers.includes("drones")) {
    for (const d of drones) {
      // Prefer the live SSE-fed position over the static dataset position so the
      // marker actually moves during a dispatch instead of sitting on the seed
      // coordinates from drones.json.
      const live = dronePositions[d.id];
      const coordinates = live ? { lat: live.lat, lng: live.lng } : d.position;
      const dispatched = !!live && live.status === "active";
      points.push({
        id: d.id,
        coordinates,
        color: dispatched ? "#ff6b35" : d.status === "active" ? "#22e6a3" : "#0EA5E9",
        radius: dispatched ? 14 : 6,
        label: dispatched
          ? `🚁 ${d.name} — DISPATCHED · ${live?.progress ?? 0}%`
          : `${d.name} · ${live?.status ?? d.status}`,
      });
    }
    // Surface drones that exist only in the live stream (e.g. dispatched before
    // the REST fleet snapshot loaded) so they are not silently dropped.
    const known = new Set(drones.map((d) => d.id));
    for (const live of Object.values(dronePositions)) {
      if (known.has(live.id)) continue;
      points.push({
        id: live.id,
        coordinates: { lat: live.lat, lng: live.lng },
        color: live.status === "active" ? "#ff6b35" : "#0EA5E9",
        radius: live.status === "active" ? 14 : 6,
        label: `🚁 ${live.name ?? live.id} · ${live.status}`,
      });
    }
  }
  if (activeLayers.includes("sensors")) {
    for (const s of sensors) {
      const reading = s.lastReading.temp ?? s.lastReading.salinity ?? s.lastReading.ph ?? s.lastReading.oxygen ?? s.lastReading.turbidity;
      points.push({
        id: s.id,
        coordinates: s.coordinates,
        color: "#a78bfa",
        radius: 5,
        label: `${s.name} · ${reading ?? "—"}`,
      });
    }
  }
  return points;
}

function makeHealthPie(overall: number) {
  const scale = overall / oceanHealth.overall;
  return [
    { name: "Pollution", value: Math.round(oceanHealth.pollution * scale), color: "#ff7043" },
    { name: "Biodiversity", value: Math.round(oceanHealth.biodiversity * scale), color: "#22e6a3" },
    { name: "Water Quality", value: Math.round(oceanHealth.waterQuality * scale), color: "#43d1ff" },
    { name: "Coral Health", value: Math.round(oceanHealth.coralHealth * scale), color: "#ff8a65" },
  ];
}

function MapSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading map">
      <Skeleton variant="chart" height={400} />
    </div>
  );
}

function KpiSkeleton() {
  return (
    <section role="status" aria-busy="true" aria-label="Loading metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} variant="card" className="h-[140px]" />
      ))}
    </section>
  );
}

function ChartsSkeleton() {
  return (
    <section role="status" aria-busy="true" aria-label="Loading charts" className="grid gap-4 lg:grid-cols-2" style={{ minHeight: 300 }}>
      <Skeleton variant="chart" height={280} />
      <Skeleton variant="chart" height={280} />
    </section>
  );
}

export default function DashboardPage() {
  const selectedRegion = useAppStore((s) => s.selectedRegion);
  // Live drone telemetry (SSE `drone_update`). Subscribing here is what makes
  // the dashboard markers move — without it the map read the static dataset.
  const dronePositions = useAppStore((s) => s.dronePositions);
  const droneDispatch = useAppStore((s) => s.droneDispatch);
  const dateRange = useAppStore((s) => s.dateRange);
  const timeHorizon = useAppStore((s) => s.timeHorizon);
  const getHorizonProjection = useAppStore((s) => s.getHorizonProjection);

  // Real API-driven KPIs (no Math.random)
  const { kpis: liveKpis, lastSync } = useLiveKpis();
  const liveAlerts = useAppStore((s) => s._alerts);
  const fetchSummary = useAppStore((s) => s.fetchSummary);
  const startLiveUpdates = useAppStore((s) => s.startLiveUpdates);
  const dataLoaded = useAppStore((s) => s._loaded);
  const pollutionCount = useAppStore((s) => s._pollution.length);
  const speciesCount = useAppStore((s) => s._species.length);

  useEffect(() => {
    fetchSummary();
    startLiveUpdates();
  }, [fetchSummary, startLiveUpdates]);

  const openAlerts = liveAlerts.filter((a) => !a.resolved);
  const ALERT_RENDER_CAP = 25;
  const visibleAlerts = openAlerts.slice(0, ALERT_RENDER_CAP);

  const projection = useMemo(
    () => getHorizonProjection(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getHorizonProjection, timeHorizon, dataLoaded, pollutionCount, speciesCount]
  );
  const intensity = 0.7 + (["today", "1m", "6m", "1y", "5y"].indexOf(timeHorizon) * 0.18);

  const trendData = useMemo(() => {
    const map: Record<string, { points: number; base: number }> = {
      Today: { points: 12, base: 56 },
      "Last 7 days": { points: 7, base: 57 },
      "Last 30 days": { points: 30, base: 58 },
      "Last 90 days": { points: 18, base: 60 },
      "Year to date": { points: 12, base: 62 },
    };
    const cfg = map[dateRange] ?? map["Last 30 days"];
    return Array.from({ length: cfg.points }, (_, i) => ({
      label: `P${i + 1}`,
      pollution: Math.max(40, Math.round(cfg.base + projection.changePct + Math.sin(i / 3) * 6 - i * 0.15 + Math.sin(i * 2.1) * 2)),
      biodiversity: Math.max(50, Math.round(64 + Math.cos(i / 4) * 4 + Math.cos(i * 2.3) * 1.5)),
      waterQuality: Math.max(70, Math.round(81 + Math.sin(i / 5) * 3)),
    }));
  }, [dateRange, projection.changePct]);

  const healthPie = useMemo(() => makeHealthPie(projection.oceanHealth), [projection.oceanHealth]);
  // Rebuild whenever live positions or the dispatch change — the previous deps
  // ([intensity]) meant the map never re-rendered on drone movement.
  const mapPoints = useMemo(
    () => buildMapPoints(MAP_LAYERS, intensity, dronePositions),
    [intensity, dronePositions]
  );

  // Anomaly target beacon, matching the Drone Center map.
  const anomalyMarker = useMemo<MapPoint[]>(() => {
    if (!droneDispatch?.targetLat || !droneDispatch?.targetLng) return [];
    return [
      {
        id: "anomaly-target",
        coordinates: { lat: droneDispatch.targetLat, lng: droneDispatch.targetLng },
        color: "#ef4444",
        radius: 16,
        label: `🚨 Anomaly: ${droneDispatch.location}`,
      },
    ];
  }, [droneDispatch]);

  const allMapPoints = useMemo(
    () => [...mapPoints, ...anomalyMarker],
    [mapPoints, anomalyMarker]
  );

  // Mission route (origin → live position → target) while a dispatch is active.
  const missionRoutes = useMemo(() => {
    if (
      !droneDispatch?.originLat ||
      !droneDispatch?.originLng ||
      !droneDispatch?.targetLat ||
      !droneDispatch?.targetLng
    ) {
      return undefined;
    }
    const live = dronePositions[droneDispatch.droneId];
    const path = droneDispatch.path?.length
      ? droneDispatch.path
      : [
          { lat: droneDispatch.originLat, lng: droneDispatch.originLng },
          { lat: live?.lat ?? droneDispatch.originLat, lng: live?.lng ?? droneDispatch.originLng },
          { lat: droneDispatch.targetLat, lng: droneDispatch.targetLng },
        ];
    return [{ id: "mission-path", path, color: "#ff6b35" }];
  }, [droneDispatch, dronePositions]);
  const isMobile = useMediaQuery("(max-width: 639px)");
  const mapHeight = isMobile ? 280 : 400;
  const [mapFade, setMapFade] = useState(false);
  const [layers] = useState<MapLayer[]>(MAP_LAYERS);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);

  const onRegionChange = () => {
    setMapFade(true);
    setTimeout(() => setMapFade(false), 300);
  };

  return (
    <DashboardShell title="Mission Control" subtitle="Real-time ocean intelligence overview">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-ocean-500/20 bg-ocean-500/10 px-3 py-1 text-xs font-medium text-ocean-200">
            <Clock className="h-3.5 w-3.5" />
            Time Machine: {projection.label} · {timeHorizon === "today" ? "Today" : timeHorizon.toUpperCase()}
          </span>
        </div>

        {/* KPI ROW — real data from /api/dashboard/overview */}
        <Suspense fallback={<KpiSkeleton />}>
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            <StatCard index={0} title="Ocean Health" value={liveKpis.oceanHealth} icon={GaugeIcon} color="success" goodWhenUp trend={{ direction: projection.changePct >= 0 ? "up" : "down", percent: Math.abs(projection.changePct) }} status={projection.changePct >= 0 ? "Improving" : "Declining"} />
            <StatCard index={1} title="Active Drones" value={liveKpis.activeDrones} icon={Radio} color="default" goodWhenUp status="Mission Ready" />
            <StatCard index={2} title="Pollution Hotspots" value={liveKpis.pollutionHotspots} icon={AlertTriangle} color="danger" goodWhenUp={false} trend={{ direction: "up", percent: 3 }} status="Reduced Today" />
            <StatCard index={3} title="Species Tracked" value={liveKpis.speciesTracked} icon={Fish} color="success" goodWhenUp status="Tracking" />
            <StatCard index={4} title="Sensors Online" value={`${liveKpis.sensorsOnline}/${sensors.length}`} icon={GaugeIcon} color="default" status="Operating" />
          </section>
        </Suspense>

        <Card>
          <CardHeader title="Time Machine" subtitle="Adjust the horizon to update the map, charts and KPIs" icon={<Clock className="h-4 w-4" />} />
          <TimeMachine />
        </Card>

        <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Card className="overflow-hidden">
            <CardHeader title="Ocean Monitoring Map" subtitle={selectedRegion ? selectedRegion : "Global · all regions"} icon={<Waves className="h-4 w-4" />} />
            <div className="mb-3 flex flex-wrap gap-3 text-xs text-ocean-200/60">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /> Critical</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> High</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Medium</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Low</span>
            </div>
            <div className="relative">
              <button onClick={() => setMapFullscreen(true)} aria-label="Expand map to fullscreen" className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-abyss-950/80 text-ocean-200/80 backdrop-blur hover:text-ocean-100 sm:hidden">
                <Maximize2 className="h-4 w-4" />
              </button>
              <div className="transition-opacity duration-300" style={{ opacity: mapFade ? 0 : 1 }}>
                <Suspense fallback={<MapSkeleton />}>
                  <MapCard points={allMapPoints} routes={missionRoutes} layers={layers} height={`${mapHeight}px`} center={selectedRegion ? [20, 0] : [15, 0]} zoom={selectedRegion ? 3 : 2} onViewportChange={onRegionChange} />
                </Suspense>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col">
            <CardHeader
              title="Recent Alerts"
              subtitle={openAlerts.length > visibleAlerts.length ? `${openAlerts.length} open · showing latest ${visibleAlerts.length}` : `${openAlerts.length} open`}
              icon={<Shield className="h-4 w-4" />}
            />
            <div className="max-h-[420px] flex-1 space-y-2 overflow-y-auto pr-1">
              {openAlerts.length === 0 ? (
                <EmptyState title="No open alerts" description="All clear across monitored regions." />
              ) : (
                visibleAlerts.map((a) => (
                  <div key={a.id} className={`rounded-lg border p-3 ${alertMeta[a.type].bg}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${alertMeta[a.type].color}`}>{a.message.split(" — ")[0]}</p>
                      <span className="text-xs text-ocean-200/50">{relativeTime(a.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-xs text-ocean-200/60">{a.location}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>

        <Suspense fallback={<ChartsSkeleton />}>
          <DashboardCharts trendData={trendData} dateRange={dateRange} timeHorizon={timeHorizon} projection={projection} />
        </Suspense>
      </div>

      {/* MOBILE ALERTS BOTTOM SHEET (<640px) */}
      <div className="fixed inset-x-0 bottom-14 z-30 sm:hidden">
        {sheetOpen && (
          <div className="max-h-[55vh] overflow-y-auto border-t border-ocean-500/10 bg-abyss-950/95 p-3 backdrop-blur">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ocean-200/60">
              Recent Alerts · {openAlerts.length} open
            </p>
            {openAlerts.length === 0 ? (
              <EmptyState title="No open alerts" description="All clear across monitored regions." />
            ) : (
              <div className="space-y-2">
                {visibleAlerts.map((a) => (
                  <div key={a.id} className={`rounded-lg border p-3 ${alertMeta[a.type].bg}`}>
                    <div className="flex items-center justify-between">
                      <p className={`text-sm font-medium ${alertMeta[a.type].color}`}>{a.message.split(" — ")[0]}</p>
                      <span className="text-xs text-ocean-200/50">{relativeTime(a.timestamp)}</span>
                    </div>
                    <p className="mt-1 text-xs text-ocean-200/60">{a.location}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={() => setSheetOpen((o) => !o)} className="flex w-full items-center justify-between border-t border-ocean-500/10 bg-abyss-950/95 px-4 py-3 text-sm backdrop-blur">
          <span className="flex items-center gap-2 font-medium text-ocean-100">
            <Shield className="h-4 w-4" />
            Alerts
            <span className="rounded-full bg-rose-500/80 px-2 py-0.5 text-[10px] font-bold text-white">{openAlerts.length}</span>
          </span>
          <span className="text-xs text-ocean-200/50">{sheetOpen ? "Swipe down ▾" : "Swipe up ▴"}</span>
        </button>
      </div>

      {/* MOBILE MAP FULLSCREEN OVERLAY */}
      {mapFullscreen && (
        <div className="fixed inset-0 z-[55] flex flex-col bg-abyss-950 sm:hidden">
          <div className="flex items-center justify-between border-b border-ocean-500/10 px-4 py-3">
            <p className="text-sm font-semibold text-white">Ocean Monitoring Map</p>
            <button onClick={() => setMapFullscreen(false)} aria-label="Close fullscreen map" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-ocean-200/80 hover:text-ocean-100">
              <Minimize2 className="h-4 w-4" />
            </button>
          </div>
          <div className="flex-1">
            <MapCard points={allMapPoints} routes={missionRoutes} layers={layers} height="100%" center={selectedRegion ? [20, 0] : [15, 0]} zoom={selectedRegion ? 3 : 2} />
          </div>
        </div>
      )}

      <footer className="mt-4 flex items-center justify-between border-t border-ocean-500/10 px-1 py-2 text-[11px] text-ocean-200/40">
        <span className="flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3" />
          Last synced {lastSync ? formatDate(lastSync.toISOString()) : "—"}
        </span>
        <span>Live API + SSE · Real backend data</span>
        <span className="hidden sm:inline">DeepSea Guardian v2.0</span>
      </footer>
    </DashboardShell>
  );
}
