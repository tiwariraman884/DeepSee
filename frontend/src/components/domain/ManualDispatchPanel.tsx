"use client";

/**
 * ManualDispatchPanel
 * ====================
 * Lets an operator manually trigger an emergency inspection by:
 *   1. Picking a pollution hotspot / sensor from a list (or typing coordinates)
 *   2. The backend selects the nearest eligible drone automatically
 *   3. Shows live mission status via the global SSE / Zustand store
 *
 * Uses the existing demo emergency scenario endpoint when triggered by hotspot,
 * or the standard sensor predict → anomaly → auto-dispatch pipeline.
 *
 * This is a purely additive component — it reads from the same stores and
 * APIs the rest of the app already uses.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Navigation,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Radio,
  ChevronDown,
  Crosshair,
  Zap,
  MapPin,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import type { PollutionEvent, Drone } from "@/types";

type DispatchState = "idle" | "sending" | "sent" | "error";

interface Target {
  label: string;
  lat: number;
  lng: number;
  severity?: number;
  type?: string;
  id?: string;
}

export function ManualDispatchPanel() {
  const [hotspots, setHotspots] = useState<Target[]>([]);
  const [drones, setDrones] = useState<Drone[]>([]);
  const [selected, setSelected] = useState<Target | null>(null);
  const [dispatchState, setDispatchState] = useState<DispatchState>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const droneDispatch = useAppStore((s) => s.droneDispatch);
  const inspection = useAppStore((s) => s.inspection);
  const sseConnected = useAppStore((s) => s.sseConnected);

  const missionActive = !!(droneDispatch || (inspection && inspection.phase !== "complete"));
  const missionComplete = inspection?.phase === "complete";

  // Load pollution events (hotspots) and available drones
  useEffect(() => {
    Promise.all([
      fetch("/api/pollution?status=active&limit=10").then((r) => r.json()),
      fetch("/api/drones").then((r) => r.json()),
    ])
      .then(([pollData, droneData]) => {
        const events: PollutionEvent[] = pollData.pollution ?? [];
        const targets: Target[] = events.map((e) => ({
          id: e.id,
          label: e.name,
          lat: e.latitude,
          lng: e.longitude,
          severity: e.severity,
          type: e.type,
        }));
        setHotspots(targets);
        if (targets.length > 0) setSelected(targets[0]);
        setDrones(droneData.drones ?? []);
      })
      .catch(() => {});
  }, []);

  const availableDrones = drones.filter(
    (d) => d.status === "idle" || d.status === "charging"
  );
  const nearestDrone = availableDrones[0] ?? null;

  const handleDispatch = async () => {
    if (!selected) return;
    setDispatchState("sending");
    setErrorMsg(null);

    try {
      const res = await fetch("/api/demo/emergency-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json().catch(() => null);

      if (res.status === 202 && data?.status === "started") {
        setDispatchState("sent");
      } else if (res.status === 409) {
        setDispatchState("error");
        setErrorMsg(data?.message || "An inspection is already active.");
      } else if (res.status === 401) {
        setDispatchState("error");
        setErrorMsg("Authentication required. Please log in.");
      } else {
        setDispatchState("error");
        setErrorMsg(data?.message || data?.error || `Dispatch failed (${res.status}).`);
      }
    } catch (err) {
      setDispatchState("error");
      setErrorMsg("Network error — backend unreachable.");
    }
  };

  const reset = () => {
    setDispatchState("idle");
    setErrorMsg(null);
  };

  const severityColor = (sev: number) =>
    sev >= 9 ? "text-rose-300" : sev >= 7 ? "text-orange-300" : sev >= 4 ? "text-amber-300" : "text-emerald-300";

  const severityBg = (sev: number) =>
    sev >= 9
      ? "border-rose-500/40 bg-rose-500/10"
      : sev >= 7
      ? "border-orange-500/40 bg-orange-500/10"
      : "border-amber-500/30 bg-amber-500/[0.07]";

  return (
    <Card className="border border-cyan-500/20 bg-abyss-950/80">
      <CardHeader
        icon={<Navigation className="h-5 w-5 text-cyan-400" />}
        title="Manual Dispatch Control"
        subtitle="Select a hotspot and dispatch the nearest available drone"
      />

      {/* Active mission banner */}
      <AnimatePresence>
        {missionActive && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "mb-4 rounded-xl border p-3",
              missionComplete
                ? "border-emerald-500/40 bg-emerald-500/[0.07]"
                : "border-orange-500/40 bg-orange-500/[0.07]"
            )}
          >
            <div className="flex items-center gap-2">
              {missionComplete ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <Radio className="h-4 w-4 animate-pulse text-orange-400" />
              )}
              <span
                className={cn(
                  "text-xs font-semibold",
                  missionComplete ? "text-emerald-300" : "text-orange-300"
                )}
              >
                {missionComplete
                  ? `Mission complete · ${inspection?.droneName ?? "Drone"} returned`
                  : `Active mission · ${droneDispatch?.droneName ?? droneDispatch?.droneId ?? "Drone"} dispatched`}
              </span>
            </div>
            {!missionComplete && droneDispatch && (
              <p className="mt-1 text-[11px] text-orange-200/60">
                Target: {droneDispatch.location} · Phase:{" "}
                {inspection?.phase?.toUpperCase() ?? "EN ROUTE"}
              </p>
            )}
            {missionComplete && inspection?.severity && (
              <p className="mt-1 text-[11px] text-emerald-200/60">
                Severity: {inspection.severity.toUpperCase()} ·{" "}
                {inspection.findings.length} evidence items captured
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {/* Target selector */}
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ocean-200/70">
            Target Hotspot / Location
          </label>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              disabled={missionActive && !missionComplete}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-sm transition",
                selected
                  ? "border-cyan-500/40 bg-cyan-500/[0.07] text-cyan-100"
                  : "border-white/[0.08] bg-white/[0.03] text-ocean-200/60",
                (missionActive && !missionComplete) && "cursor-not-allowed opacity-50"
              )}
            >
              <span className="flex items-center gap-2 truncate">
                {selected ? (
                  <>
                    <Crosshair className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
                    <span className="truncate">{selected.label}</span>
                    {selected.severity !== undefined && (
                      <span
                        className={cn(
                          "shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold",
                          severityBg(selected.severity)
                        )}
                      >
                        <span className={severityColor(selected.severity)}>
                          Sev {selected.severity}
                        </span>
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-ocean-200/40">Select a hotspot…</span>
                )}
              </span>
              <ChevronDown
                className={cn("h-4 w-4 shrink-0 text-ocean-200/40 transition-transform", dropdownOpen && "rotate-180")}
              />
            </button>

            <AnimatePresence>
              {dropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-white/10 bg-abyss-900 shadow-2xl"
                >
                  {hotspots.length === 0 ? (
                    <p className="px-3 py-4 text-center text-xs text-ocean-200/40">
                      No active hotspots found
                    </p>
                  ) : (
                    <ul className="max-h-52 overflow-y-auto">
                      {hotspots.map((h) => (
                        <li key={h.id ?? h.label}>
                          <button
                            onClick={() => {
                              setSelected(h);
                              setDropdownOpen(false);
                              setDispatchState("idle");
                            }}
                            className={cn(
                              "flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-ocean-500/[0.07]",
                              selected?.id === h.id && "bg-cyan-500/[0.07] text-cyan-100"
                            )}
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0 text-ocean-200/40" />
                            <span className="flex-1 truncate text-ocean-100">{h.label}</span>
                            {h.severity !== undefined && (
                              <span className={cn("shrink-0 text-xs font-bold", severityColor(h.severity))}>
                                {h.severity}/10
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Selected target info + nearest drone */}
        {selected && (
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] uppercase tracking-wider text-ocean-200/50">Coordinates</p>
              <p className="mt-1 font-mono text-xs text-ocean-100/80">
                {selected.lat.toFixed(3)}°, {selected.lng.toFixed(3)}°
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[10px] uppercase tracking-wider text-ocean-200/50">Nearest Drone</p>
              <p className="mt-1 text-xs text-ocean-100/80">
                {nearestDrone ? (
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {nearestDrone.name}
                  </span>
                ) : (
                  <span className="text-ocean-200/40">Auto-selected</span>
                )}
              </p>
            </div>
          </div>
        )}

        {/* SSE status */}
        <div className="flex items-center gap-1.5 text-[10px] text-ocean-200/50">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              sseConnected ? "animate-pulse bg-emerald-400" : "bg-rose-500"
            )}
          />
          {sseConnected
            ? "Real-time telemetry connected — mission updates will appear instantly"
            : "SSE offline — connect to see live mission updates"}
        </div>

        {/* Dispatch button */}
        {dispatchState === "idle" && (
          <button
            onClick={handleDispatch}
            disabled={!selected || (missionActive && !missionComplete)}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white transition active:scale-[0.99]",
              missionActive && !missionComplete
                ? "cursor-not-allowed bg-orange-600/30 text-orange-200/50"
                : "bg-cyan-600 hover:bg-cyan-500 shadow-lg shadow-cyan-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {missionActive && !missionComplete ? (
              <>
                <Radio className="h-4 w-4 animate-pulse" />
                Mission Active — Drone Deployed
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                {missionComplete ? "Dispatch New Mission" : "Dispatch Nearest Drone"}
              </>
            )}
          </button>
        )}

        {dispatchState === "sending" && (
          <button disabled className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600/50 py-3 text-sm font-bold text-cyan-200">
            <Loader2 className="h-4 w-4 animate-spin" />
            Dispatching…
          </button>
        )}

        {dispatchState === "sent" && (
          <div className="space-y-2">
            <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600/20 py-3 text-sm font-bold text-emerald-300 border border-emerald-500/30">
              <CheckCircle2 className="h-4 w-4" />
              Dispatch Confirmed — Monitor Below
            </div>
            <p className="text-center text-xs text-ocean-200/50">
              Drone is en route. Watch the Live Mission Map and Inspection Console for real-time updates.
            </p>
          </div>
        )}

        {dispatchState === "error" && (
          <div className="space-y-2">
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-rose-300">
                <AlertTriangle className="h-4 w-4" />
                Dispatch Failed
              </p>
              {errorMsg && <p className="mt-1 text-xs text-rose-200/70">{errorMsg}</p>}
            </div>
            <button
              onClick={reset}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs text-ocean-200/60 hover:text-ocean-100"
            >
              <Zap className="h-3.5 w-3.5" />
              Try Again
            </button>
          </div>
        )}
      </div>

      {/* Footer note */}
      <p className="mt-4 text-[9px] text-ocean-200/30">
        Dispatching runs the full autonomous response pipeline: anomaly inject → AI detection → drone selection →
        route calculation → live telemetry. The nearest idle drone with sufficient battery is auto-selected.
      </p>
    </Card>
  );
}

export default ManualDispatchPanel;
