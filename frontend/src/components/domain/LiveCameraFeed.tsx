"use client";

/**
 * LiveCameraFeed — simulated drone camera for the anomaly-response workflow.
 *
 * The feed is driven entirely by the live inspection state in the global store,
 * which is fed by real SSE events from the backend pipeline:
 *
 *   drone_dispatch (SSE)  → feed switches to TRANSIT view (en_route)
 *   drone_update (SSE)    → progress bar + depth/battery HUD tick
 *   inspection_phase      → ARRIVED → camera switches to INSPECTION view
 *   inspection_finding    → threat detections appear as bounding-box overlays
 *   inspection_phase      → COMPLETE → mission summary banner
 *
 * This replaces the old static placeholder which looked like a live feed but
 * was pure CSS with a hardcoded "Nautilus-01 · 1240m" label.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Radar, Droplets, Waves, Fish, FlaskConical, Trash2, Leaf, CircleDot } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const THREAT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  oil_film: Droplets,
  chemical_plume: FlaskConical,
  debris_field: Trash2,
  algae_bloom: Leaf,
  microplastic: CircleDot,
  marine_life: Fish,
};

const CAMERA_STATE: Record<string, { label: string; rec: boolean }> = {
  en_route: { label: "EN ROUTE", rec: true },
  arrived: { label: "INITIALIZING INSPECTION", rec: true },
  inspecting: { label: "LIVE UNDERWATER FEED", rec: true },
  complete: { label: "INSPECTION COMPLETE", rec: false },
  aborted: { label: "MISSION ABORTED", rec: false },
};

export function LiveCameraFeed() {
  const inspection = useAppStore((s) => s.inspection);
  const droneDispatch = useAppStore((s) => s.droneDispatch);
  const dronePositions = useAppStore((s) => s.dronePositions);
  const [frame, setFrame] = useState(0);

  // ~12fps frame counter drives the ambient scanline/particle animation.
  useEffect(() => {
    if (!inspection) return;
    const id = setInterval(() => setFrame((f) => f + 1), 80);
    return () => clearInterval(id);
  }, [inspection]);

  const phase = inspection?.phase ?? null;
  const liveDrone = droneDispatch ? dronePositions[droneDispatch.droneId] : null;
  const camState = phase ? CAMERA_STATE[phase] ?? { label: phase.toUpperCase(), rec: false } : null;

  // Elapsed mission clock, ticking while a mission is active.
  const [, tickClock] = useState(0);
  useEffect(() => {
    if (!inspection || phase === "complete") return;
    const id = setInterval(() => tickClock((c) => c + 1), 1000);
    return () => clearInterval(id);
  }, [inspection, phase]);
  const elapsed = useMemo(() => {
    const startMs = inspection?.startedAt ? Date.parse(inspection.startedAt) : NaN;
    if (Number.isNaN(startMs)) return "—";
    const secs = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
    const m = Math.floor(secs / 60), s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }, [inspection?.startedAt, inspection?.phase, frame]);

  const hud = useMemo(() => {
    if (!droneDispatch && !inspection) return null;
    return {
      droneName: inspection?.droneName || droneDispatch?.droneName || "Drone",
      depth: liveDrone ? `${(0.9 + (liveDrone.progress ?? 0) * 0.012).toFixed(1)}km` : "1.24km",
      battery: liveDrone?.battery ?? 100,
      progress: inspection?.progress ?? liveDrone?.progress ?? 0,
      speed: phase === "en_route" ? "4.2 kn" : phase === "inspecting" ? "0.1 kn (holding)" : "—",
      location: inspection?.location || droneDispatch?.location || "",
    };
  }, [droneDispatch, inspection, liveDrone, phase]);

  // ── Idle state: no mission, show standby ───────────────────────────────────
  if (!hud || !phase) {
    return (
      <div className="relative aspect-video overflow-hidden rounded-lg border border-ocean-500/20 bg-abyss-950">
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ocean-200/40">
          <Camera className="h-8 w-8" />
          <p className="text-[11px] font-medium uppercase tracking-wider">Camera Standby</p>
          <p className="max-w-[220px] text-center text-[10px] leading-relaxed text-ocean-200/30">
            Live feed activates automatically when the fleet is dispatched to an anomaly.
          </p>
        </div>
        <div className="absolute bottom-2 right-2 text-[10px] text-ocean-200/40">NO SIGNAL</div>
      </div>
    );
  }

  const scanning = phase === "inspecting" || phase === "arrived";
  const findings = inspection?.findings ?? [];

  return (
    <div className="relative aspect-video overflow-hidden rounded-lg border border-ocean-500/30 bg-abyss-950">
      {/* ── Ambient water visual (transit: drifting particles / inspecting: plume) ── */}
      <div
        className={cn(
          "absolute inset-0 transition-colors duration-1000",
          scanning ? "bg-[radial-gradient(circle_at_50%_60%,rgba(239,68,68,0.18),transparent_65%)]"
            : "bg-[radial-gradient(circle_at_50%_120%,rgba(34,230,163,0.22),transparent_60%)]"
        )}
      />
      {/* Particle drift — cheap deterministic transform, no extra state */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          transform: `translateY(${(frame * 0.6) % 26 - 13}px)`,
        }}
      />
      {/* Sonar sweep ring while holding on-site */}
      {scanning && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-24 w-24 animate-pulse-ring rounded-full border-2 border-rose-400/60" />
        </div>
      )}

      {/* ── Threat detection overlays (inspection findings) ── */}
      <AnimatePresence>
        {findings.map((f, i) => {
          const Icon = THREAT_ICONS[f.kind] ?? Waves;
          // Deterministic box placement per finding index
          const pos = [
            { left: "12%", top: "22%" },
            { left: "52%", top: "44%" },
            { left: "22%", top: "58%" },
            { left: "58%", top: "14%" },
          ][i % 4];
          return (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, scale: 1.6 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute"
              style={pos}
            >
              <div className="rounded border border-rose-400/80 bg-rose-950/40 px-2 py-1 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                  <Icon className="h-3 w-3 text-rose-300" />
                  <span className="text-[9px] font-bold uppercase tracking-wide text-rose-200">{f.label}</span>
                </div>
                <div className="mt-0.5 text-[8px] text-rose-300/80">{Math.round(f.confidence * 100)}% conf</div>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

        <div className="absolute left-2 top-2 flex items-center gap-2">
          <span className="flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-rose-300">
            <span className={cn("h-1.5 w-1.5 rounded-full bg-rose-400", camState?.rec && "animate-pulse")} />
            REC
          </span>
          <span className="rounded bg-black/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-ocean-100">
            {camState?.label}
          </span>
        </div>

      {/* ── HUD top-right: battery ── */}
      <div className="absolute right-2 top-2 flex items-center gap-1.5 rounded bg-black/60 px-2 py-0.5 text-[10px] text-ocean-100">
        <Radar className="h-3 w-3 text-ocean-300" />
        {hud.battery}%
      </div>

      {/* ── HUD bottom bar: telemetry ── */}
      <div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-black/60 px-2 py-1.5 backdrop-blur-sm">
        <div className="mb-1 flex items-center justify-between text-[9px] text-ocean-200/80">
          <span className="font-semibold text-white">Drone: {hud.droneName}</span>
          <span>Depth: {hud.depth}</span>
        </div>
        <div className="mb-1 flex items-center justify-between text-[9px] text-ocean-200/60">
          <span>Mission: Marine Threat Inspection</span>
          <span>Status: {camState?.label} · Elapsed: {elapsed}</span>
        </div>
        <div className="h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className={cn("h-full rounded-full transition-all duration-700", scanning ? "bg-rose-400" : "bg-emerald-400")}
            style={{ width: `${hud.progress}%` }}
          />
        </div>
        {inspection?.progressLabel && (
          <div className="mt-0.5 text-center text-[8px] uppercase tracking-wide text-ocean-200/50">
            {inspection.progressLabel} · {hud.progress}%
          </div>
        )}
      </div>

      {/* ── Mission complete banner ── */}
      {phase === "complete" && inspection?.severity && (
        <div className="absolute inset-x-2 bottom-8 rounded border border-emerald-500/40 bg-emerald-950/80 px-2 py-1 text-center backdrop-blur-sm">
          <p className="text-[10px] font-bold text-emerald-200">
            Severity: {inspection.severity.toUpperCase()} · {findings.length} threats recorded
          </p>
        </div>
      )}
    </div>
  );
}

export default LiveCameraFeed;
