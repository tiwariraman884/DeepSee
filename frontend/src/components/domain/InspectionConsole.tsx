"use client";

/**
 * InspectionConsole — AI analysis, evidence and mission-timeline panels.
 * ======================================================================
 * Reads the live inspection state (fed by the canonical SSE events:
 * ai_detection, evidence_captured, inspection_progress, inspection_*).
 *
 * The mission timeline is appended by the SSE layer, so it reads as an
 * operations log: dispatch → arrival → progress steps → detections →
 * evidence → completion. Findings emitted by the heuristic threat library and
 * the species-AI are labelled SIMULATION — this is a software demo pipeline,
 * not production perception.
 */

import { useAppStore } from "@/store/useAppStore";
import { Card, CardHeader } from "@/components/ui/Card";
import { Brain, ClipboardList, History, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour12: false });
}

export function InspectionConsole() {
  const inspection = useAppStore((s) => s.inspection);

  if (!inspection) {
    return (
      <Card className="p-4">
        <CardHeader title="Inspection Console" icon={<Brain className="h-4 w-4" />} subtitle="No active inspection" />
        <p className="py-4 text-center text-xs text-ocean-200/40">
          Panels activate automatically when the fleet is dispatched to an anomaly.
        </p>
      </Card>
    );
  }

  const ai = inspection.aiDetection;
  const evidence = inspection.findings;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* ── AI Analysis ── */}
      <Card className="p-4">
        <CardHeader
          title="AI Analysis"
          icon={<Brain className="h-4 w-4" />}
          subtitle={inspection.phase === "inspecting" ? "Analyzing inspection frames" : inspection.phase}
        />
        {ai ? (
          <div className="mt-2 space-y-2">
            <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 p-3">
              <p className="text-sm font-semibold text-violet-200">{ai.label}</p>
              <p className="mt-0.5 text-xs text-violet-300/80">
                Confidence: {ai.confidence}%
                {ai.conservation && (
                  <> · Conservation concern: <span className="font-semibold capitalize">{ai.conservation}</span></>
                )}
              </p>
              <p className="mt-1 inline-block rounded bg-violet-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-300">
                Simulation · Species classifier on sample frame
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-xs text-ocean-200/40">
            {inspection.phase === "inspecting"
              ? "Running frame analysis…"
              : "No AI detections yet."}
          </p>
        )}
        {inspection.summary && inspection.phase === "complete" && (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200/90">
            <p className="mb-1 flex items-center gap-1.5 font-semibold text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" /> Incident report — severity {inspection.severity}
            </p>
            {inspection.summary}
          </div>
        )}
      </Card>

      {/* ── Evidence ── */}
      <Card className="p-4">
        <CardHeader
          title="Evidence Captured"
          icon={<ClipboardList className="h-4 w-4" />}
          subtitle={`${evidence.length} item${evidence.length === 1 ? "" : "s"}`}
        />
        {evidence.length === 0 ? (
          <p className="mt-2 text-xs text-ocean-200/40">No evidence captured yet.</p>
        ) : (
          <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
            {evidence.map((f, i) => (
              <div key={`${f.label}-${i}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white">
                    #{String(i + 1).padStart(2, "0")} {f.label}
                  </p>
                  <span className="text-[10px] font-bold text-ocean-200/70">{Math.round(f.confidence * 100)}%</span>
                </div>
                <p className="mt-0.5 text-[10px] text-ocean-200/50">
                  Type: {f.kind} · Simulation
                </p>
                <p className="mt-0.5 text-[10px] leading-relaxed text-ocean-200/70">{f.detail}</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── Mission timeline ── */}
      <Card className="p-4">
        <CardHeader
          title="Mission Timeline"
          icon={<History className="h-4 w-4" />}
          subtitle={`${inspection.timeline.length} events`}
        />
        {inspection.timeline.length === 0 ? (
          <p className="mt-2 text-xs text-ocean-200/40">Awaiting mission events…</p>
        ) : (
          <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {inspection.timeline.map((t, i) => (
              <div key={`${t.time}-${i}`} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 font-mono text-[10px] text-ocean-200/50">{fmtTime(t.time)}</span>
                <span className={cn("h-1.5 w-1.5 shrink-0 translate-y-1.5 rounded-full", i === inspection.timeline.length - 1 ? "bg-emerald-400" : "bg-ocean-400/40")} />
                <span className="text-[11px] leading-snug text-ocean-100/90">{t.message}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default InspectionConsole;
