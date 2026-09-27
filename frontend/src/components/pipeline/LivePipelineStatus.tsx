"use client";

/**
 * LivePipelineStatus — Real-time pipeline health indicator
 * Dashboard pe dikhta hai: SSE connected, ML ready, anomaly count, last event
 */

import { motion, AnimatePresence } from "framer-motion";
import { useSSEStream } from "@/hooks/useSSEStream";
import { Activity, Cpu, Radio, AlertTriangle, CheckCircle2, Wifi, WifiOff } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useState, useEffect } from "react";

export function LivePipelineStatus() {
  const { status, liveReadings, latestAnomaly, droneDispatch } = useSSEStream();
  const [mlStats, setMlStats] = useState<{ ready: boolean; latency?: number } | null>(null);

  // Fetch pipeline stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/sensors/pipeline-stats");
        const data = await res.json();
        setMlStats({ ready: data.mlWorker?.ready });
      } catch { /* ignore */ }
    };
    fetchStats();
    const id = setInterval(fetchStats, 10000);
    return () => clearInterval(id);
  }, []);

  const latestReading = liveReadings[0];
  const avgLatency = liveReadings.length > 0
    ? (liveReadings.slice(0, 10).reduce((s, r) => s + r.latency_ms, 0) / Math.min(liveReadings.length, 10)).toFixed(1)
    : null;

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
          <div className={`text-lg font-black font-mono ${status.connected ? "text-cyan-400" : "text-red-400"}`}>
            {status.connected ? "LIVE" : "OFF"}
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
            {status.anomalyCount}
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
                <p className="mt-0.5 text-[11px] text-rose-200/70">{latestAnomaly.detail}</p>
                <div className="mt-1.5 flex items-center gap-3 text-[10px] text-rose-200/50">
                  <span>Score: {latestAnomaly.score.toFixed(3)}</span>
                  <span>ML: {latestAnomaly.latency_ms.toFixed(1)}ms</span>
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
              {liveReadings.slice(0, 6).map((r, i) => (
                <div
                  key={r.ts + i}
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
                        {r.reading.ph?.toFixed(2)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-black/40 p-2 text-center">
                      <div className="text-[10px] uppercase tracking-wider text-ocean-200/50 mb-1">Oxygen</div>
                      <div className={`font-mono text-base font-bold ${r.isAnomaly ? "text-rose-300" : "text-cyan-300"}`}>
                        {r.reading.oxygen?.toFixed(1)}
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
        <span className={`h-1.5 w-1.5 rounded-full ${status.connected ? "bg-cyan-400 animate-pulse" : "bg-red-400"}`} />
        {status.connected
          ? `Connected · Reconnects: ${status.reconnectCount} · Client: ${status.clientId?.slice(0, 12)}…`
          : `Disconnected · Reconnecting… (attempt ${status.reconnectCount + 1})`}
      </div>
    </Card>
  );
}
