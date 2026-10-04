"use client";

/**
 * LivePipelineStatus — Real-time pipeline health indicator
 * Dashboard pe dikhta hai: SSE connected, ML ready, anomaly count, last event
 */

import { motion, AnimatePresence } from "framer-motion";
import { useSSEStream } from "@/hooks/useSSEStream";
import { useAppStore } from "@/store/useAppStore";
import { Activity, Radio, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useEffect, useState } from "react";

/** One row of the live sensor feed, assembled from the SSE stream. */
type LiveReading = {
  /** Stable key: sensorId + reading timestamp. Not Date.now() — the pipeline
   *  emits a reading more than once (once per subscriber stage), and a
   *  per-emission timestamp made every duplicate look like a new reading. */
  key: string;
  sensorName: string;
  ts: string;
  /** Processing latency, only known when the reading was anomaly-scored by the ML worker. */
  latency_ms?: number;
  isAnomaly: boolean;
  ph?: number;
  oxygen?: number;
};

/** Shape of the most recent ML anomaly, as published on the `anomaly_alert` SSE event. */
type AnomalyEvent = {
  id?: string;
  message?: string;
  detail?: string;
  score?: number;
  latency_ms?: number;
  sensorName?: string;
};

const numberOrUndefined = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;

export function LivePipelineStatus() {
  useSSEStream();
  const sseConnected = useAppStore((s) => s.sseConnected);
  const sensors = useAppStore((s) => s._sensors);
  const alerts = useAppStore((s) => s._alerts);
  const droneDispatch = useAppStore((s) => s.droneDispatch);

  const [mlStats, setMlStats] = useState<{ ready: boolean } | null>(null);
  const [feed, setFeed] = useState<LiveReading[]>([]);
  const [latestAnomaly, setLatestAnomaly] = useState<AnomalyEvent | null>(null);
  const [anomalyCount, setAnomalyCount] = useState(0);

  // Pipeline stats — ML worker readiness. The SSE client count comes from the
  // already-open stream's `connected` event, so there is no reason to poll it.
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/sensors/pipeline-stats");
        if (!res.ok) return;
        const data = await res.json();
        setMlStats({ ready: Boolean(data.mlWorker?.ready) });
      } catch { /* keep the previous value on failure */ }
    };
    fetchStats();
    const id = setInterval(fetchStats, 10000);
    return () => clearInterval(id);
  }, []);

  // Live readings + anomaly funnel. The pipeline pushes `sensor_update` on every
  // reading and `anomaly_alert` when the ML worker flags one, so this card
  // subscribes to the same events the store does and keeps its own short tail.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const sse = new EventSource("/api/sensors/stream");

    // The same reading reaches us more than once (the pipeline has two consumer
    // stages), each emission carrying its own latency sample and its own
    // generated alert id. Dedupe against a stable set declared OUTSIDE the
    // setState updaters: React may replay an updater, and Math.random()/Date.now()
    // inside one would return a different value on replay and corrupt the counts.
    const seenReadings = new Set<string>();
    const seenAlerts = new Set<string>();

    const onSensorUpdate = (event: Event) => {
      try {
        const d = JSON.parse((event as MessageEvent).data);
        const reading = d.reading ?? {};
        const sensorName = d.sensorName ?? d.sensorId ?? "Unknown sensor";
        const ts = d.ts ?? reading.timestamp ?? new Date().toISOString();

        // Stable per-reading identity — replays of one reading collapse here.
        const key = `${d.sensorId ?? sensorName}@${ts}`;
        if (seenReadings.has(key)) return;
        seenReadings.add(key);

        const isAnomaly = d.isAnomaly === true;
        const entry: LiveReading = {
          key,
          sensorName,
          ts,
          latency_ms: numberOrUndefined(d.latency_ms),
          isAnomaly,
          ph: numberOrUndefined(reading.ph),
          oxygen: numberOrUndefined(reading.oxygen),
        };
        setFeed((prev) => [entry, ...prev].slice(0, 20));

        if (isAnomaly) {
          setAnomalyCount((c) => c + 1);
          setLatestAnomaly({
            id: key,
            message: `${sensorName} — anomaly detected`,
            detail: `pH ${entry.ph ?? "—"} · O₂ ${entry.oxygen ?? "—"} mg/L · Turbidity ${reading.turbidity ?? "—"} NTU`,
            score: numberOrUndefined(d.mlScore) ?? 0,
            latency_ms: entry.latency_ms ?? 0,
            sensorName,
          });
        }
      } catch (e) {
        console.error("[SSE] Failed to parse sensor_update", e);
      }
    };

    const onAnomalyAlert = (event: Event) => {
      try {
        const d = JSON.parse((event as MessageEvent).data);
        if (typeof d.id === "string") {
          if (seenAlerts.has(d.id)) return;
          seenAlerts.add(d.id);
        }
        setAnomalyCount((c) => c + 1);
        setLatestAnomaly({
          id: d.id,
          message: d.message,
          detail: d.detail ?? d.location,
          score: numberOrUndefined(d.score) ?? 0,
          latency_ms: numberOrUndefined(d.latency_ms) ?? 0,
          sensorName: d.sensorName,
        });
      } catch (e) {
        console.error("[SSE] Failed to parse anomaly_alert", e);
      }
    };

    sse.addEventListener("sensor_update", onSensorUpdate);
    sse.addEventListener("anomaly_alert", onAnomalyAlert);
    return () => sse.close();
  }, []);

  // Seed from REST data so the feed has content before the next sensor tick.
  // Only sensors that actually carry a reading — an empty card is honest, and it
  // avoids rendering a row of dashes before the first SSE event lands.
  const seeded: LiveReading[] = sensors
    .filter((s: any) => s.lastReading && Object.keys(s.lastReading).length > 0)
    .slice(0, 6)
    .map((s: any) => {
      const lr = s.lastReading as { ph?: number; oxygen?: number };
      return {
        key: `rest-${s.id}`,
        sensorName: s.name,
        ts: s.updatedAt ?? new Date().toISOString(),
        isAnomaly: false,
        ph: numberOrUndefined(lr.ph),
        oxygen: numberOrUndefined(lr.oxygen),
      };
    });
  const liveReadings: LiveReading[] = feed.length > 0 ? feed : seeded;

  // Mean latency over the distinct scored readings on screen. Divided by the
  // number of samples actually summed — dividing by a clamped sample count
  // under-reported the average whenever fewer than 10 readings had arrived.
  const scored = liveReadings.filter((r: LiveReading) => r.latency_ms !== undefined).slice(0, 10);
  const avgLatency = scored.length > 0
    ? (scored.reduce((s: number, r: LiveReading) => s + (r.latency_ms as number), 0) / scored.length).toFixed(1)
    : null;

  // The alert list is the source of truth for the headline count; it is also fed
  // by REST, so it survives a reload that clears the in-memory tail above.
  const anomalyTotal = Math.max(anomalyCount, alerts.filter((a) => !a.resolved).length);

  return (
    <Card className="border border-cyan-500/20 bg-abyss-950/80">
      <CardHeader
        icon={<Activity className="h-5 w-5 text-cyan-400" />}
        title="Live Data Pipeline"
        subtitle="Real-time sensor → ML → Dashboard latency monitor"
      />

      {/* Status Metrics Row */}
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5 text-center">
          <div className={`text-lg font-black font-mono ${sseConnected ? "text-cyan-400" : "text-red-400"}`}>
            {sseConnected ? "LIVE" : "OFF"}
          </div>
          <div className="text-[10px] text-ocean-200/50 mt-0.5">SSE Stream</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5 text-center">
          <div className={`text-lg font-black font-mono ${mlStats?.ready ? "text-violet-400" : "text-amber-400"}`}>
            {mlStats?.ready ? "RAM" : "..."}
          </div>
          <div className="text-[10px] text-ocean-200/50 mt-0.5">ML Model</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5 text-center">
          <div className="text-lg font-black font-mono text-emerald-400">
            {avgLatency ? `${avgLatency}ms` : "—"}
          </div>
          <div className="text-[10px] text-ocean-200/50 mt-0.5">Avg Latency</div>
        </div>
        <div className="rounded-lg border border-white/5 bg-white/[0.03] p-2.5 text-center">
          <div className="text-lg font-black font-mono text-rose-400">
            {anomalyTotal}
          </div>
          <div className="text-[10px] text-ocean-200/50 mt-0.5">Anomalies</div>
        </div>
      </div>

      {/* Latest Anomaly Alert */}
      <AnimatePresence>
        {latestAnomaly && (
          <motion.div
            key={latestAnomaly.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-xl border border-rose-500/50 bg-rose-950/40 p-3"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 animate-bounce mt-0.5" />
              <div className="flex-1">
                <p className="text-xs font-bold text-rose-300">{latestAnomaly.message}</p>
                {latestAnomaly.detail && (
                  <p className="mt-0.5 text-[11px] text-rose-200/70">{latestAnomaly.detail}</p>
                )}
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-rose-200/50">
                  <span>Score: {(latestAnomaly.score ?? 0).toFixed(3)}</span>
                  <span>ML: {(latestAnomaly.latency_ms ?? 0).toFixed(1)}ms</span>
                  <span>via SSE push</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Drone Dispatch Event */}
      <AnimatePresence>
        {droneDispatch && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 rounded-xl border border-cyan-500/40 bg-cyan-950/30 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="h-4 w-4 text-cyan-400 animate-pulse" />
                <span className="text-xs font-semibold text-cyan-300">
                  🚁 Auto-Dispatch: {droneDispatch.droneId}
                </span>
              </div>
              <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                ETA: {droneDispatch.eta_seconds}s
              </span>
            </div>
            <p className="mt-1 text-[11px] text-cyan-200/60">
              Target: {droneDispatch.location} — triggered by anomaly detection
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Readings Ticker (Premium Cards) */}
      {liveReadings.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-400/80">
              Live Sensor Feed
            </p>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
          </div>
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
              {liveReadings.slice(0, 6).map((r) => (
                <div
                  key={r.key}
                  className={`snap-center shrink-0 w-60 rounded-xl border p-4 backdrop-blur-md shadow-xl ${
                    r.isAnomaly
                      ? "border-rose-500/50 bg-gradient-to-br from-rose-950/60 to-black/80 shadow-rose-900/20"
                      : "border-cyan-500/20 bg-gradient-to-br from-cyan-950/20 to-abyss-950/80 shadow-cyan-900/10"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs font-bold text-white/90 truncate max-w-[140px]" title={r.sensorName}>
                      {r.sensorName}
                    </span>
                    {r.isAnomaly ? (
                      <AlertTriangle className="h-4 w-4 text-rose-400" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-2.5">
                    <div className="rounded-lg border border-white/5 bg-black/40 p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-ocean-200/50 mb-1">pH Level</div>
                      <div className={`font-mono text-base font-bold ${r.isAnomaly ? "text-rose-300" : "text-white"}`}>
                        {r.ph !== undefined ? r.ph.toFixed(2) : "—"}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-black/40 p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-ocean-200/50 mb-1">Oxygen</div>
                      <div className={`font-mono text-base font-bold ${r.isAnomaly ? "text-rose-300" : "text-cyan-300"}`}>
                        {r.oxygen !== undefined ? r.oxygen.toFixed(1) : "—"}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                    <span className="text-[10px] text-white/40 font-mono">
                      {new Date(r.ts).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' })}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                      r.isAnomaly ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400"
                    }`}>
                      {r.isAnomaly ? "Anomaly Detected" : "Stable"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
        </div>
      )}

      {/* Connection status footer */}
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-ocean-200/40">
        <span className={`h-1.5 w-1.5 rounded-full ${sseConnected ? "bg-cyan-400 animate-pulse" : "bg-red-400"}`} />
        {sseConnected
          ? "Connected · receiving live sensor + anomaly events"
          : "Disconnected · reconnecting to the real-time stream…"}
      </div>
    </Card>
  );
}
