"use client";

/**
 * DispatchHeader — autonomous-response mission header.
 * =====================================================
 * Pure presentation over the live Zustand/SSE state:
 *
 *   Active mission  → AUTONOMOUS RESPONSE banner with drone, mission,
 *                     target and live status pills (phase, distance,
 *                     battery, progress, SSE connection).
 *   No mission      → FLEET READY standby banner (no fake mission data).
 *
 * Every operational value is read from the store — nothing is hardcoded.
 */

import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Bot,
  Crosshair,
  Ship,
  Wifi,
  WifiOff,
} from "lucide-react";

const PHASE_LABEL: Record<string, string> = {
  en_route: "EN ROUTE",
  arrived: "ARRIVED",
  inspecting: "INSPECTING",
  complete: "COMPLETE",
  aborted: "ABORTED",
};

function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "orange" | "red" | "green" | "cyan";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2 py-1 text-[10px] font-bold uppercase tracking-wider",
        tone === "neutral" && "border border-white/10 bg-white/[0.04] text-ocean-200/80",
        tone === "orange" && "bg-orange-500/15 text-orange-300",
        tone === "red" && "bg-rose-500/15 text-rose-300",
        tone === "green" && "bg-emerald-500/15 text-emerald-300",
        tone === "cyan" && "bg-cyan-500/15 text-cyan-300"
      )}
    >
      {children}
    </span>
  );
}

export function DispatchHeader() {
  const inspection = useAppStore((s) => s.inspection);
  const dispatch = useAppStore((s) => s.droneDispatch);
  const dronePositions = useAppStore((s) => s.dronePositions);
  const sseConnected = useAppStore((s) => s.sseConnected);

  // ── Standby: no active mission — no fake operational values ────────────────
  if (!inspection && !dispatch) {
    return (
      <div
        className="rounded-lg border border-ocean-500/20 bg-abyss-950/60 px-4 py-3"
        role="status"
        aria-label="Drone operations fleet ready"
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ocean-200/70">
            <Ship className="h-4 w-4 text-cyan-400" aria-hidden="true" />
            Drone Operations · Fleet Ready
          </span>
          <Pill tone={sseConnected ? "green" : "neutral"}>
            {sseConnected ? <Wifi className="h-3 w-3" aria-hidden="true" /> : <WifiOff className="h-3 w-3" aria-hidden="true" />}
            {sseConnected ? "SSE Live" : "SSE Offline"}
          </Pill>
          <span className="text-[10px] uppercase tracking-wider text-ocean-200/40">
            Fleet monitoring mode · awaiting anomaly
          </span>
        </div>
      </div>
    );
  }

  const droneName = inspection?.droneName || dispatch?.droneName || dispatch?.droneId || "—";
  const target = inspection?.location || dispatch?.location || "—";
  const liveDrone = dispatch ? dronePositions[dispatch.droneId] : null;
  const battery = liveDrone?.battery;
  const distance = inspection?.selection?.distanceKm;
  const phase = inspection?.phase ?? "en_route";
  const progress = inspection?.progress ?? 0;
  const complete = phase === "complete";

  return (
    <section
      aria-label="Autonomous response mission header"
      className="rounded-lg border border-orange-500/40 bg-orange-500/[0.07] px-4 py-3"
    >
      {/* Line 1 — mission classification */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-orange-300">
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          Autonomous Response
        </span>
        {!complete && (
          <Pill tone="red">
            <AlertTriangle className="h-3 w-3" aria-hidden="true" />
            Critical Anomaly Detected
          </Pill>
        )}
        {complete && <Pill tone="green">Mission Completed</Pill>}
      </div>

      {/* Line 2 — drone · mission · target */}
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-base font-bold text-white">{droneName}</span>
        <span className="text-[11px] uppercase tracking-wider text-orange-200/70">Marine Threat Inspection</span>
        <span className="flex items-center gap-1.5 text-[11px] text-ocean-100/80">
          <Crosshair className="h-3 w-3 text-rose-400" aria-hidden="true" />
          Target: <span className="font-semibold text-white">{target}</span>
        </span>
      </div>

      {/* Line 3 — live status pills (all real state) */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5" data-testid="dispatch-status-pills">
        <Pill tone={complete ? "green" : "orange"}>{PHASE_LABEL[phase] ?? phase.toUpperCase()}</Pill>
        {distance != null && <Pill tone="cyan">{distance} km</Pill>}
        {battery != null && (
          <Pill tone={battery < 30 ? "red" : "neutral"}>{battery}% Battery</Pill>
        )}
        <Pill tone={complete ? "green" : "cyan"}>{progress}% Complete</Pill>
        <Pill tone={sseConnected ? "green" : "red"}>
          {sseConnected ? <Wifi className="h-3 w-3" aria-hidden="true" /> : <WifiOff className="h-3 w-3" aria-hidden="true" />}
          {sseConnected ? "SSE Live" : "SSE Offline"}
        </Pill>
      </div>
    </section>
  );
}

export default DispatchHeader;
