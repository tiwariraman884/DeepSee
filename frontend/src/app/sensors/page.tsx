"use client";

/**
 * /sensors — Live Water Sensor Readings
 * ======================================
 * Dedicated mission-control view for all deployed sensors.
 * Real data sourced from:
 *   - REST  GET /api/sensors           — initial snapshot
 *   - SSE   /api/sensors/stream        — live sensor_update events (via global store)
 *   - REST  GET /api/sensors/readings/:id — historical time series per sensor
 *
 * Layout:
 *   • KPI strip (online / offline / anomalies in last hour)
 *   • Sensor grid with live-updating reading cards
 *   • Expandable detail drawer: 50-point time-series sparkline per parameter
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Activity,
  Wifi,
  WifiOff,
  AlertTriangle,
  Thermometer,
  Droplets,
  Wind,
  Zap,
  Eye,
  Filter,
  RefreshCw,
  ChevronRight,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import type { Sensor, SensorType } from "@/types";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

// ─── Sensor type metadata ─────────────────────────────────────────────────────

const TYPE_META: Record<
  SensorType,
  { icon: React.ElementType; label: string; unit: string; color: string; normalRange: [number, number] }
> = {
  temperature: { icon: Thermometer, label: "Temperature", unit: "°C", color: "#f97316", normalRange: [1, 6] },
  salinity:    { icon: Droplets,    label: "Salinity",    unit: "PSU", color: "#38bdf8", normalRange: [33, 36] },
  oxygen:      { icon: Wind,        label: "Oxygen",      unit: "mg/L", color: "#34d399", normalRange: [4, 8] },
  ph:          { icon: Zap,         label: "pH Level",    unit: "pH", color: "#a78bfa", normalRange: [7.8, 8.3] },
  turbidity:   { icon: Eye,         label: "Turbidity",   unit: "NTU", color: "#fbbf24", normalRange: [0, 3] },
  pollution:   { icon: AlertTriangle, label: "Pollution Index", unit: "idx", color: "#fb7185", normalRange: [0, 2] },
};

function primaryReading(s: Sensor): { value: number | null; type: SensorType } {
  const r = s.lastReading;
  const checks: Array<[SensorType, number | undefined]> = [
    ["ph", r.ph],
    ["temperature", r.temp],
    ["salinity", r.salinity],
    ["oxygen", r.oxygen],
    ["turbidity", r.turbidity],
  ];
  for (const [t, v] of checks) {
    if (v !== undefined) return { value: v, type: t };
  }
  return { value: null, type: s.type };
}

function isOutOfRange(value: number, type: SensorType): boolean {
  const [lo, hi] = TYPE_META[type]?.normalRange ?? [0, 999];
  return value < lo || value > hi;
}

// ─── Sparkline component (lazy, Recharts) ─────────────────────────────────────

type Reading = { ph?: number; temp?: number; salinity?: number; oxygen?: number; turbidity?: number; recorded_at: string };

function SensorSparkline({ readings, type }: { readings: Reading[]; type: SensorType }) {
  const meta = TYPE_META[type] ?? TYPE_META.ph;
  const data = readings.map((r, i) => {
    const v = r.ph ?? r.temp ?? r.salinity ?? r.oxygen ?? r.turbidity;
    return { t: i, v };
  });
  if (data.length < 2) {
    return <div className="flex h-28 items-center justify-center text-xs text-ocean-200/40">Insufficient data</div>;
  }
  return (
    <ResponsiveContainer width="100%" height={112}>
      <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey="t" hide />
        <YAxis domain={["auto", "auto"]} tick={{ fill: "#64748b", fontSize: 9 }} />
        <Tooltip
          contentStyle={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontSize: 11 }}
          labelStyle={{ display: "none" }}
          formatter={(v: number) => [`${v?.toFixed(2)} ${meta.unit}`, meta.label]}
        />
        <ReferenceLine y={meta.normalRange[0]} stroke={meta.color} strokeDasharray="4 2" strokeOpacity={0.4} />
        <ReferenceLine y={meta.normalRange[1]} stroke={meta.color} strokeDasharray="4 2" strokeOpacity={0.4} />
        <Line
          type="monotone"
          dataKey="v"
          stroke={meta.color}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ─── Sensor Card ──────────────────────────────────────────────────────────────

function SensorCard({ sensor, onClick, flash }: { sensor: Sensor; onClick: () => void; flash: boolean }) {
  const { value, type } = primaryReading(sensor);
  const meta = TYPE_META[sensor.type] ?? TYPE_META[type];
  const Icon = meta.icon;
  const alert = value !== null && isOutOfRange(value, type);
  const isOnline = sensor.status === "online";

  return (
    <motion.button
      layout
      onClick={onClick}
      className={cn(
        "relative w-full rounded-xl border p-4 text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ocean-400/50",
        isOnline
          ? alert
            ? "border-rose-500/50 bg-rose-950/20 hover:border-rose-400/70"
            : "border-ocean-500/20 bg-abyss-900/60 hover:border-ocean-400/40"
          : "border-white/[0.06] bg-abyss-950/40 opacity-60",
        flash && "ring-1 ring-cyan-400"
      )}
      aria-label={`${sensor.name} — ${isOnline ? "online" : "offline"}`}
    >
      {/* Flash overlay for new reading */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            className="pointer-events-none absolute inset-0 rounded-xl bg-cyan-400/10"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
        )}
      </AnimatePresence>

      {/* Top row */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ background: `${meta.color}22` }}
        >
          <Icon className="h-4 w-4" style={{ color: meta.color }} />
        </div>
        <div className="flex items-center gap-1.5">
          {alert && <AlertTriangle className="h-3.5 w-3.5 text-rose-400 animate-pulse" />}
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              isOnline ? (alert ? "bg-rose-400 animate-pulse" : "bg-emerald-400") : "bg-slate-600"
            )}
          />
        </div>
      </div>

      {/* Sensor name */}
      <p className="truncate text-xs font-semibold text-ocean-100/90" title={sensor.name}>
        {sensor.name}
      </p>
      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-ocean-200/50">{meta.label}</p>

      {/* Reading */}
      <div className="mt-3">
        {value !== null ? (
          <span
            className={cn(
              "font-mono text-2xl font-bold tabular-nums",
              alert ? "text-rose-300" : "text-white"
            )}
          >
            {value.toFixed(2)}
            <span className="ml-1 text-sm font-normal text-ocean-200/50">{meta.unit}</span>
          </span>
        ) : (
          <span className="font-mono text-2xl font-bold tabular-nums text-ocean-200/30">—</span>
        )}
      </div>

      {alert && (
        <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-wider text-rose-400">
          Out of normal range
        </p>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-ocean-200/40">
          {sensor.updatedAt ? new Date(sensor.updatedAt).toLocaleTimeString([], { hour12: false }) : "—"}
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-ocean-200/30" />
      </div>
    </motion.button>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function SensorDetailDrawer({ sensor, onClose }: { sensor: Sensor; onClose: () => void }) {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/sensors/readings/${encodeURIComponent(sensor.id)}?limit=50`)
      .then((r) => r.json())
      .then((d) => setReadings(d.readings ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sensor.id]);

  const meta = TYPE_META[sensor.type] ?? TYPE_META.ph;
  const { value, type } = primaryReading(sensor);
  const alert = value !== null && isOutOfRange(value, type);

  // Group all readings parameters into separate sparkline-worthy arrays
  const params = ([
    { key: "ph", label: "pH", unit: "pH", color: "#a78bfa" },
    { key: "temp", label: "Temperature", unit: "°C", color: "#f97316" },
    { key: "salinity", label: "Salinity", unit: "PSU", color: "#38bdf8" },
    { key: "oxygen", label: "Dissolved O₂", unit: "mg/L", color: "#34d399" },
    { key: "turbidity", label: "Turbidity", unit: "NTU", color: "#fbbf24" },
  ] as Array<{ key: keyof Reading; label: string; unit: string; color: string }>).filter((p) => readings.some((r) => r[p.key] !== undefined && r[p.key] !== null));

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        {/* Panel */}
        <motion.div
          className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-abyss-900 p-6 shadow-2xl sm:rounded-2xl"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          transition={{ type: "spring", bounce: 0.2 }}
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white">{sensor.name}</h3>
              <p className="text-xs text-ocean-200/50">{meta.label} · {sensor.status}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-ocean-200/60 hover:text-white"
            >
              Close
            </button>
          </div>

          {/* Summary row */}
          <div className="mb-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
              <p className="font-mono text-xl font-bold text-white">
                {value !== null ? value.toFixed(2) : "—"}
              </p>
              <p className="mt-0.5 text-[10px] text-ocean-200/50">{meta.unit} · current</p>
            </div>
            <div className={cn("rounded-lg border p-3", alert ? "border-rose-500/30 bg-rose-500/10" : "border-emerald-500/30 bg-emerald-500/10")}>
              <p className={cn("text-sm font-bold", alert ? "text-rose-300" : "text-emerald-300")}>
                {alert ? "ALERT" : "NORMAL"}
              </p>
              <p className="mt-0.5 text-[10px] text-ocean-200/50">status</p>
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
              <p className="font-mono text-xs text-ocean-200/60">
                {meta.normalRange[0]}–{meta.normalRange[1]}
              </p>
              <p className="mt-0.5 text-[10px] text-ocean-200/50">{meta.unit} · normal</p>
            </div>
          </div>

          {/* Coordinates */}
          <div className="mb-4 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs text-ocean-200/60">
            <span className="font-mono">
              {sensor.coordinates.lat.toFixed(4)}°, {sensor.coordinates.lng.toFixed(4)}°
            </span>
            <span className="mx-2 opacity-30">·</span>
            <span>
              Updated {sensor.updatedAt ? new Date(sensor.updatedAt).toLocaleTimeString() : "—"}
            </span>
          </div>

          {/* Time-series charts */}
          {loading ? (
            <div className="flex h-28 items-center justify-center text-xs text-ocean-200/40">
              Loading time-series…
            </div>
          ) : params.length > 0 ? (
            <div className="space-y-5">
              {params.map((p) => {
                const seriesReadings = readings.map((r) => ({ ...r, recorded_at: r.recorded_at }));
                const sType = p.key === "temp" ? "temperature" : (p.key as SensorType);
                return (
                  <div key={p.key}>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ocean-200/60">
                      {p.label}
                      <span className="ml-1.5 font-normal text-ocean-200/40">({p.unit})</span>
                    </p>
                    <SensorSparkline readings={seriesReadings} type={sType} />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-xs text-ocean-200/40">No historical readings available yet.</p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type SensorFilter = "all" | SensorType | "alert";

export default function SensorsPage() {
  const storeSensors = useAppStore((s) => s._sensors);
  const [restSensors, setRestSensors] = useState<Sensor[]>([]);
  const [filter, setFilter] = useState<SensorFilter>("all");
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Sensor | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Initial REST load
  const refresh = useCallback(() => {
    setLoading(true);
    fetch("/api/sensors", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setRestSensors(d.sensors ?? []);
        setLastSync(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Merge SSE-updated sensors on top of REST snapshot
  const sensors: Sensor[] = useMemo(() => {
    if (storeSensors.length === 0) return restSensors;
    // Build lookup from store (SSE live data)
    const liveMap = new Map(storeSensors.map((s) => [s.id, s]));
    return restSensors.map((s) => liveMap.get(s.id) ?? s);
  }, [restSensors, storeSensors]);

  // Flash effect when SSE delivers an update for a sensor already in the grid
  const prevSensorsRef = useState<Map<string, string>>(() => new Map())[0];
  useEffect(() => {
    const flashed = new Set<string>();
    for (const s of storeSensors) {
      const prev = prevSensorsRef.get(s.id);
      const curr = s.updatedAt;
      if (prev && prev !== curr) flashed.add(s.id);
      prevSensorsRef.set(s.id, curr);
    }
    if (flashed.size > 0) {
      setFlashIds(flashed);
      setTimeout(() => setFlashIds(new Set()), 900);
    }
  }, [storeSensors, prevSensorsRef]);

  // KPIs
  const online = sensors.filter((s) => s.status === "online").length;
  const offline = sensors.filter((s) => s.status !== "online").length;
  const alertCount = sensors.filter((s) => {
    const { value, type } = primaryReading(s);
    return value !== null && isOutOfRange(value, type);
  }).length;

  // Filtered grid
  const filtered = useMemo(() => {
    if (filter === "all") return sensors;
    if (filter === "alert") {
      return sensors.filter((s) => {
        const { value, type } = primaryReading(s);
        return value !== null && isOutOfRange(value, type);
      });
    }
    return sensors.filter((s) => s.type === filter);
  }, [sensors, filter]);

  const FILTER_OPTIONS: Array<{ value: SensorFilter; label: string }> = [
    { value: "all", label: "All Sensors" },
    { value: "alert", label: `Alerts (${alertCount})` },
    { value: "ph", label: "pH" },
    { value: "temperature", label: "Temperature" },
    { value: "salinity", label: "Salinity" },
    { value: "oxygen", label: "Oxygen" },
    { value: "turbidity", label: "Turbidity" },
    { value: "pollution", label: "Pollution" },
  ];

  const sseConnected = useAppStore((s) => s.sseConnected);

  return (
    <DashboardShell
      title="Live Sensor Readings"
      subtitle="Water quality monitoring — real-time sensor telemetry"
    >
      {/* ── KPI Strip ── */}
      <section className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: "Total Sensors",
            value: sensors.length,
            icon: Activity,
            color: "text-ocean-300",
            bg: "border-ocean-500/20 bg-ocean-500/[0.07]",
          },
          {
            label: "Online",
            value: online,
            icon: Wifi,
            color: "text-emerald-300",
            bg: "border-emerald-500/20 bg-emerald-500/[0.07]",
          },
          {
            label: "Offline",
            value: offline,
            icon: WifiOff,
            color: "text-slate-400",
            bg: "border-white/[0.06] bg-white/[0.03]",
          },
          {
            label: "Out of Range",
            value: alertCount,
            icon: AlertTriangle,
            color: alertCount > 0 ? "text-rose-300" : "text-ocean-200/50",
            bg: alertCount > 0 ? "border-rose-500/30 bg-rose-500/[0.08]" : "border-white/[0.06] bg-white/[0.03]",
          },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={cn("rounded-xl border px-4 py-3", bg)}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ocean-200/60">{label}</span>
              <Icon className={cn("h-4 w-4", color)} />
            </div>
            <p className={cn("mt-1 font-mono text-2xl font-bold tabular-nums", color)}>{value}</p>
          </div>
        ))}
      </section>

      {/* ── Toolbar ── */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              aria-pressed={filter === f.value}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filter === f.value
                  ? "border-ocean-400/50 bg-ocean-500/15 text-ocean-200"
                  : "border-ocean-500/15 text-ocean-200/50 hover:text-ocean-100"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {/* SSE status pill */}
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
              sseConnected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-rose-500/30 bg-rose-500/10 text-rose-300"
            )}
          >
            {sseConnected ? (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
            ) : (
              <span className="h-2 w-2 rounded-full bg-rose-500" />
            )}
            {sseConnected ? "SSE Live" : "SSE Offline"}
          </span>
          <button
            onClick={refresh}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-ocean-500/20 px-3 py-1.5 text-xs text-ocean-200/60 transition hover:text-ocean-100 disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>

      {/* Last sync footer */}
      {lastSync && (
        <p className="mb-3 flex items-center gap-1.5 text-[10px] text-ocean-200/40">
          <Clock className="h-3 w-3" />
          Last REST sync: {lastSync.toLocaleTimeString()} · {sensors.length} sensors
        </p>
      )}

      {/* ── Sensor Grid ── */}
      {loading && sensors.length === 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-secondary/40" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-6 py-12 text-center">
          <Filter className="mx-auto mb-3 h-8 w-8 text-ocean-200/30" />
          <p className="text-sm font-semibold text-ocean-200/60">No sensors match this filter</p>
          <button
            onClick={() => setFilter("all")}
            className="mt-3 text-xs text-ocean-400 hover:text-ocean-300"
          >
            Show all sensors
          </button>
        </div>
      ) : (
        <motion.div
          layout
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        >
          <AnimatePresence>
            {filtered.map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <SensorCard
                  sensor={s}
                  onClick={() => setSelected(s)}
                  flash={flashIds.has(s.id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* ── Live Feed (compact list) ── */}
      {sensors.length > 0 && (
        <Card className="mt-6">
          <CardHeader
            title="Live Reading Stream"
            subtitle="Most recently updated sensors"
            icon={<Activity className="h-4 w-4" />}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-ocean-200/50">
                  <th className="pb-2 pr-4 font-medium">Sensor</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium">Reading</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {[...sensors]
                  .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                  .slice(0, 15)
                  .map((s) => {
                    const { value, type } = primaryReading(s);
                    const meta = TYPE_META[type] ?? TYPE_META.ph;
                    const alert = value !== null && isOutOfRange(value, type);
                    return (
                      <tr
                        key={s.id}
                        onClick={() => setSelected(s)}
                        className={cn(
                          "cursor-pointer border-t border-white/[0.05] hover:bg-ocean-500/[0.04]",
                          flashIds.has(s.id) && "bg-cyan-500/[0.07]"
                        )}
                      >
                        <td className="py-2 pr-4 font-medium text-white">{s.name}</td>
                        <td className="py-2 pr-4 text-ocean-200/60">{meta.label}</td>
                        <td className="py-2 pr-4">
                          {value !== null ? (
                            <span
                              className={cn("font-mono font-bold tabular-nums", alert ? "text-rose-300" : "text-emerald-300")}
                            >
                              {value.toFixed(2)} {meta.unit}
                            </span>
                          ) : (
                            <span className="text-ocean-200/30">—</span>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge
                            label={alert ? "Alert" : s.status}
                            variant={alert ? "danger" : s.status === "online" ? "success" : "warning"}
                          />
                        </td>
                        <td className="py-2 pr-4 text-ocean-200/40">
                          {s.updatedAt ? new Date(s.updatedAt).toLocaleTimeString([], { hour12: false }) : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Detail Drawer ── */}
      {selected && (
        <SensorDetailDrawer sensor={selected} onClose={() => setSelected(null)} />
      )}
    </DashboardShell>
  );
}
