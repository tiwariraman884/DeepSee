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
import { Brain, ClipboardList, History, ShieldCheck, Activity, Cpu, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString([], { hour12: false });
}

/** Canonical mission phases — drives the status strip. */
const PHASES = ["en_route", "arrived", "inspecting", "complete"] as const;
const PHASE_LABEL: Record<string, string> = {
  en_route: "EN ROUTE",
  arrived: "ARRIVED",
  inspecting: "INSPECTING",
  complete: "COMPLETE",
  aborted: "ABORTED",
};

/**
 * Current operational step. The SSE layer streams a free-form progressLabel;
 * when it is missing we fall back to the canonical phase step so the strip is
 * never blank. No invented values — only what the pipeline emitted.
 */
function currentStep(phase: string | undefined, label: string | undefined): string {
  if (label) return label;
  switch (phase) {
    case "en_route": return "En route to target";
    case "arrived": return "Initializing";
    case "inspecting": return "Camera scan";
    case "complete": return "Complete";
    default: return "Awaiting dispatch";
  }
}

/** Compact mission-state strip shown above AI / evidence / timeline. */
function MissionStatusStrip({
  phase,
  progress,
  step,
}: {
  phase: string;
  progress: number;
  step: string;
}) {
  const phaseIndex = Math.max(0, PHASES.indexOf(phase as (typeof PHASES)[number]));
  const complete = phase === "complete";
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        complete ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-cyan-500/30 bg-cyan-500/[0.05]"
      )}
      aria-label="Mission status"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-ocean-200/60">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          Mission Status
        </span>
        {PHASES.map((p, i) => (
          <span
            key={p}
            className={cn(
              "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
              i < phaseIndex && "bg-emerald-500/10 text-emerald-300/80",
              i === phaseIndex && !complete && "bg-cyan-500/15 text-cyan-300",
              i === phaseIndex && complete && "bg-emerald-500/15 text-emerald-300",
              i > phaseIndex && "bg-white/[0.04] text-ocean-200/40"
            )}
            aria-current={i === phaseIndex ? "step" : undefined}
          >
            {PHASE_LABEL[p]}
          </span>
        ))}
        <span className="ml-auto font-mono text-sm font-bold tabular-nums text-white" aria-live="polite">
          {progress}%
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Inspection progress"
      >
        <div
          className={cn("h-full rounded-full transition-all duration-700", complete ? "bg-emerald-400" : "bg-cyan-400")}
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-1.5 text-[10px] uppercase tracking-wider text-ocean-200/50">
        Current step: <span className="font-semibold text-ocean-100/80">{step}</span>
      </p>
    </div>
  );
}

export function InspectionConsole() {
  const inspection = useAppStore((s) => s.inspection);

  if (!inspection) {
    return (
      <Card className="p-4" role="status" aria-label="Inspection console standby">
        <CardHeader
          title="Inspection Console"
          icon={<Brain className="h-4 w-4" />}
          subtitle="No active inspection"
        />
        <p className="py-4 text-center text-xs text-ocean-200/40">
          Panels activate automatically when the fleet is dispatched to an anomaly.
        </p>
      </Card>
    );
  }

  const ai = inspection.aiDetection;
  const evidence = inspection.findings;
  const complete = inspection.phase === "complete";

  return (
    <div className="space-y-3">
      {/* ── Mission-state strip ── */}
      <MissionStatusStrip
        phase={inspection.phase}
        progress={inspection.progress}
        step={currentStep(inspection.phase, inspection.progressLabel)}
      />

      {/* ── Completed summary banner ── */}
      {complete && inspection.severity && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-emerald-500/40 bg-emerald-500/[0.07] px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Inspection Complete
          </p>
          <span className="text-[11px] text-emerald-200/80">
            Severity: <span className="font-bold text-emerald-200">{inspection.severity.toUpperCase()}</span>
          </span>
          <span className="text-[11px] text-emerald-200/80">Evidence: {evidence.length}</span>
          <span className="text-[11px] text-emerald-200/80">AI detections: {ai ? 1 : 0}</span>
          <span className="text-[11px] uppercase tracking-wider text-emerald-200/60">Mission: completed</span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ── AI Analysis ── */}
        <Card className="p-4">
          <CardHeader
            title="AI Inspection"
            icon={<Brain className="h-4 w-4" />}
            subtitle={inspection.phase === "inspecting" ? "Analyzing inspection frames" : PHASE_LABEL[inspection.phase] ?? inspection.phase}
          />
          {ai ? (
            <div className="mt-2 space-y-2">
              <div className="rounded-lg border border-violet-500/40 bg-violet-500/10 p-3">
                <p className="text-sm font-semibold text-violet-200">{ai.label}</p>
                <p className="mt-0.5 text-xs text-violet-300/80">
                  Confidence: {ai.confidence}%
                  {ai.conservation && (
                    <> · Conservation: <span className="font-semibold capitalize">{ai.conservation}</span></>
                  )}
                </p>
              </div>
              {/* Inference provenance — real model, simulated frame */}
              <dl className="space-y-1 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[10px]">
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1 text-ocean-200/50"><Cpu className="h-3 w-3" aria-hidden="true" /> Model</dt>
                  <dd className="font-mono text-ocean-100/80">MobileNetV3-Small</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="flex items-center gap-1 text-ocean-200/50"><ImageIcon className="h-3 w-3" aria-hidden="true" /> Input</dt>
                  <dd className="text-ocean-100/80">Simulated inspection frame</dd>
                </div>
              </dl>
              <p className="text-center text-[9px] font-bold uppercase tracking-widest text-violet-300/80" aria-label="Simulation notice">
                Simulation · Real inference on sample frame
              </p>
            </div>
          ) : (
            <p className="mt-2 text-xs text-ocean-200/40">
              {inspection.phase === "inspecting"
                ? "Running frame analysis…"
                : "No AI detections yet."}
            </p>
          )}
          {inspection.summary && complete && (
            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-200/90">
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> Incident report — severity {inspection.severity}
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
            <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1" aria-label="Captured evidence list">
              {evidence.map((f, i) => (
                <div key={`${f.label}-${i}`} className="rounded-lg border border-white/10 bg-white/[0.03] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-semibold text-white">
                      <span className="font-mono text-ocean-200/50">#{String(i + 1).padStart(2, "0")}</span> {f.label}
                    </p>
                    <span className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-cyan-300">
                      {Math.round(f.confidence * 100)}%
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-ocean-200/50">
                    Type: <span className="font-mono">{f.kind}</span> · <span className="uppercase tracking-wider">Simulation</span>
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-ocean-200/70">{f.detail}</p>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* ── Mission timeline (operations log) ── */}
        <Card className="p-4">
          <CardHeader
            title="Mission Log"
            icon={<History className="h-4 w-4" />}
            subtitle={`${inspection.timeline.length} events`}
          />
          {inspection.timeline.length === 0 ? (
            <p className="mt-2 text-xs text-ocean-200/40">Awaiting mission events…</p>
          ) : (
            <ol className="mt-2 max-h-56 space-y-1.5 overflow-y-auto pr-1" aria-label="Mission event log">
              {inspection.timeline.map((t, i) => {
                const last = i === inspection.timeline.length - 1;
                return (
                  <li key={`${t.time}-${i}`} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 font-mono text-[10px] tabular-nums text-ocean-200/50">{fmtTime(t.time)}</span>
                    <span
                      className={cn(
                        "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
                        last ? "bg-emerald-400" : "bg-cyan-400/50"
                      )}
                      aria-hidden="true"
                    />
                    <span className={cn("text-[11px] leading-snug", last ? "font-medium text-white" : "text-ocean-100/80")}>
                      {t.message}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

export default InspectionConsole;
