"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, Cpu, Radio, Database, ArrowLeft, Loader2,
  AlertTriangle, FileText, ChevronDown, RefreshCw,
} from "lucide-react";

interface IntelligenceSnapshot {
  generatedAt: string;
  services: {
    api: { status: string; uptimeSeconds: number };
    database: { status: string; latencyMs: number };
    mlWorker: { status: string; ready: boolean };
    eventBus: {
      status: string; published: number; delivered: number; failed: number;
      retried: number; deadLettered: number; queueSize: number;
    };
    sse: { status: string; clients: number; eventsBroadcast: number };
  };
  operations: {
    sensors: { total: number; online: number; offline: number };
    drones: { total: number; active: number; idle: number; offline: number; charging: number; returning: number };
    inspections: { active: number; completedToday: number; total: number };
    alerts: { today: number; critical: number; unresolved: number };
    evidence: { today: number; total: number };
  };
  pipeline: {
    ingestion: { active: boolean };
    mlInference: { currentMs: number | null; averageMs: number | null; minMs: number | null; maxMs: number | null; sampleCount: number };
    sensorToAlert: { currentMs: number | null; averageMs: number | null; minMs: number | null; maxMs: number | null; sampleCount: number };
    dispatcher: { missionActive: boolean };
  };
  performance: {
    intelligenceEndpointMs: number;
    database: { queryLatencyMs: number };
  };
  models: {
    anomaly: {
      available: boolean; model?: string | null; evaluationType?: string;
      precision?: number | null; recall?: number | null; f1?: number | null;
      falsePositiveRate?: number | null; falseNegativeRate?: number | null;
      dataset?: { normalClass?: string; anomalyClass?: string } | null;
      disclaimer?: string | null;
    };
    species: {
      available: boolean; model?: string | null; evaluationType?: string;
      validationSamples?: number | null; validationAccuracy?: number | null;
      macroF1?: number | null; weightedF1?: number | null;
      classCount?: number | null; dataset?: string | null;
    };
  };
  lastIncident: {
    inspectionId: string; severity: string | null; sensorName: string | null;
    droneName: string | null; evidenceCount: number; durationSeconds: number | null;
    completedAt: string | null;
  } | null;
  vision: {
    sourceType: string | null; state: string; cameraId: string | null;
    connected: boolean; framesCaptured: number; framesProcessed: number;
    framesDropped: number; queueDepth: number; avgInferenceMs: number | null;
    lastFrameAt: string | null; lastFrameId: string | null;
    lastQualityStatus: string | null;
    measuredFps: number | null; cameraConnected: boolean;
    rovTelemetryAvailable: boolean;
    errorCode?: string | null; errorDetail?: string | null;
    capabilities?: string[];
    deviceInfo?: { deviceId: string; deviceName: string; width: number | null; height: number | null; fps: number | null } | null;
    captureStats?: { framesCaptured: number; avgCaptureMs: number | null; measuredFps: number | null } | null;
    avgCaptureLatencyMs?: number | null;
  } | null;
  hardware: {
    registered: boolean;
    deviceId?: string;
    name?: string;
    online?: boolean;
    lastSeen?: string | null;
    ageSeconds?: number | null;
    offlineAfterSeconds?: number;
    lastReading?: {
      temperature: number | null; ph: number | null; salinity: number | null;
      oxygen: number | null; turbidity: number | null; recordedAt: string | null;
      source: string | null; deviceId: string | null;
    } | null;
    mlReady?: boolean;
    missingFeatures?: string[];
    diagnostics?: {
      firmwareVersion: string | null; validationSessionId: string | null;
      uptimeSeconds: number | null;
      wifiRssi: number | null; pressureSource: string | null;
      sensors: Record<string, string>;
      calibration: Record<string, string>;
      reportedAt: string;
    } | null;
  } | null;
}

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (["healthy", "ready", "live", "running", "streaming"].includes(s)) return "text-emerald-300";
  if (["degraded", "starting", "engaged", "active response"].includes(s)) return "text-orange-300";
  return "text-red-300";
}

function statusDot(status: string): string {
  const s = status.toLowerCase();
  if (["healthy", "ready", "live", "running", "streaming"].includes(s)) return "bg-emerald-400";
  if (["degraded", "starting", "engaged", "active response"].includes(s)) return "bg-orange-400";
  return "bg-red-400";
}

function pct(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? `${(v * 100).toFixed(1)}%` : "unavailable";
}

function ms(v: number | null | undefined): string {
  return typeof v === "number" && Number.isFinite(v) ? `${v} ms` : "no samples yet";
}

function fmtTs(ts: string | null): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toUTCString().replace("GMT", "UTC");
  } catch {
    return ts;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="rounded-xl border border-ocean-500/20 bg-abyss-950/80 p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-300">{title}</h2>
      {children}
    </section>
  );
}

function ServiceCard({ name, status, lines }: { name: string; status: string; lines: [string, string][] }) {
  return (
    <div className="rounded-lg border border-ocean-500/15 bg-ocean-500/5 p-4">
      <p className="text-xs uppercase tracking-wide text-ocean-200/60">{name}</p>
      <p className={`mt-1 flex items-center gap-1.5 text-sm font-bold ${statusTone(status)}`} role="status">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${statusDot(status)}`} />
        {status.toUpperCase()}
      </p>
      <dl className="mt-2 space-y-1">
        {lines.map(([k, v]) => (
          <div key={k} className="flex justify-between text-xs">
            <dt className="text-ocean-200/50">{k}</dt>
            <dd className="font-mono text-white">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Counter({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-ocean-500/15 bg-ocean-500/5 p-4 text-center">
      <p className="font-mono text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wide text-ocean-200/60">{label}</p>
      {sub && <p className="mt-0.5 font-mono text-[11px] text-ocean-200/50">{sub}</p>}
    </div>
  );
}

export default function SystemIntelligencePage() {
  const [snap, setSnap] = useState<IntelligenceSnapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [detail, setDetail] = useState("");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");

  const fetchSnapshot = useCallback(async () => {
    try {
      const res = await fetch("/api/system/intelligence");
      const body = await res.json().catch(() => null);
      if (res.ok && body?.services) {
        setSnap(body as IntelligenceSnapshot);
        setState("ready");
      } else {
        setState("error");
        setDetail(body?.error ?? `Snapshot failed (${res.status}).`);
      }
    } catch (e) {
      setState("error");
      setDetail(e instanceof Error ? e.message : "Network failure.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchSnapshot();
    // Snapshot polling (~12s) + immediate fetch on mount. No dedicated SSE
    // stream for this page; timer cleaned up on unmount.
    const id = setInterval(() => { if (!cancelled) fetchSnapshot(); }, 12000);
    return () => { cancelled = true; clearInterval(id); };
  }, [fetchSnapshot]);

  if (state === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-ocean-200/60">
        <Loader2 className="h-5 w-5 animate-spin" /> Reading system telemetry…
      </div>
    );
  }

  if (state === "error" || !snap) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-red-300" />
        <p className="font-semibold text-red-200">System Intelligence unavailable</p>
        <p className="mt-1 text-sm text-ocean-200/70">{detail}</p>
        <button
          onClick={fetchSnapshot}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
        >
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const s = snap;
  const worst = [s.services.api.status, s.services.database.status, s.services.eventBus.status]
    .some((x) => x === "degraded")
    ? "DEGRADED"
    : "ALL SYSTEMS OK";
  const dispatcherState = s.pipeline.dispatcher.missionActive ? "ENGAGED" : "IDLE";
  const ml = s.pipeline.mlInference;

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <Activity className="h-5 w-5 text-cyan-300" aria-hidden="true" />
            SYSTEM INTELLIGENCE
          </h1>
          <p className="mt-1 text-xs text-ocean-200/60">
            Runtime health · pipeline telemetry · model validation
          </p>
          <p className="font-mono text-[11px] text-ocean-200/40">
            Snapshot {fmtTs(s.generatedAt)} · auto-refresh 12s · runtime session telemetry
          </p>
        </div>
        <p
          role="status"
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
            worst === "ALL SYSTEMS OK"
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
              : "border-orange-500/40 bg-orange-500/10 text-orange-300"
          }`}
        >
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${worst === "ALL SYSTEMS OK" ? "bg-emerald-400" : "bg-orange-400"}`} />
          {worst}
        </p>
      </div>

      {/* Service health */}
      <Section title="Service Health">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ServiceCard
            name="ML Worker"
            status={s.services.mlWorker.status}
            lines={[["Ready", String(s.services.mlWorker.ready)], ["Model", "Isolation Forest"]]}
          />
          <ServiceCard
            name="Event Bus"
            status={s.services.eventBus.status}
            lines={[
              ["Published", String(s.services.eventBus.published)],
              ["Delivered", String(s.services.eventBus.delivered)],
              ["Queue", String(s.services.eventBus.queueSize)],
            ]}
          />
          <ServiceCard
            name="SSE"
            status={s.services.sse.status}
            lines={[
              ["Clients", String(s.services.sse.clients)],
              ["Broadcasts", String(s.services.sse.eventsBroadcast)],
            ]}
          />
          <ServiceCard
            name="Database"
            status={s.services.database.status}
            lines={[
              ["Probe", `${s.services.database.latencyMs} ms`],
              ["Uptime", `${s.services.api.uptimeSeconds}s`],
            ]}
          />
        </div>
      </Section>

      {/* Live operations */}
      <Section title="Live Operations">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Counter
            label="Sensors"
            value={`${s.operations.sensors.online} / ${s.operations.sensors.total}`}
            sub="online / total"
          />
          <Counter
            label="Drones"
            value={`${s.operations.drones.active} / ${s.operations.drones.total}`}
            sub={`active / total · idle ${s.operations.drones.idle}`}
          />
          <Counter
            label="Inspections"
            value={String(s.operations.inspections.active)}
            sub={`active · ${s.operations.inspections.completedToday} completed today`}
          />
          <Counter
            label="Alerts"
            value={String(s.operations.alerts.unresolved)}
            sub={`unresolved · ${s.operations.alerts.critical} critical`}
          />
          <Counter
            label="Evidence"
            value={String(s.operations.evidence.total)}
            sub={`${s.operations.evidence.today} captured today`}
          />
        </div>
      </Section>

      {/* Pipeline performance */}
      <Section title="Pipeline Performance — Runtime Session Telemetry">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Counter label="ML inference (current)" value={ml.currentMs !== null ? `${ml.currentMs} ms` : "—"} sub={ml.sampleCount > 0 ? `avg ${ml.averageMs} ms · n=${ml.sampleCount}` : "no samples yet"} />
          <Counter label="Sensor → alert (current)" value={ms(s.pipeline.sensorToAlert.currentMs)} sub={s.pipeline.sensorToAlert.sampleCount > 0 ? `avg ${s.pipeline.sensorToAlert.averageMs} ms` : "no samples yet"} />
          <Counter label="DB probe" value={`${s.performance.database.queryLatencyMs} ms`} sub="SELECT 1" />
          <Counter label="Snapshot cost" value={`${s.performance.intelligenceEndpointMs} ms`} sub="this endpoint assembly" />
        </div>
        <p className="mt-2 text-[11px] text-ocean-200/50">
          ML inference = resident-model round-trip only; sensor → alert = inference + persist + broadcast.
          Bounded to the last 200 samples; resets on backend restart.
        </p>
      </Section>

      {/* Pipeline activity + stages */}
      <Section title="Pipeline Activity">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold" aria-label="Pipeline stages">
          {[
            ["Sensor", s.pipeline.ingestion.active ? "HEALTHY" : "DOWN"],
            ["ML", s.services.mlWorker.status.toUpperCase()],
            ["EventBus", s.services.eventBus.status.toUpperCase()],
            ["Dispatcher", dispatcherState],
            ["SSE", s.services.sse.status.toUpperCase()],
          ].map(([stage, st], i, arr) => (
            <span key={stage} className="flex items-center gap-1.5">
              <span className={`rounded border border-ocean-500/20 bg-ocean-500/10 px-2 py-1 ${statusTone(st)}`}>
                {stage} · {st}
              </span>
              {i < arr.length - 1 && <span aria-hidden="true" className="text-ocean-200/40">→</span>}
            </span>
          ))}
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-5">
          {[
            ["Published", s.services.eventBus.published],
            ["Delivered", s.services.eventBus.delivered],
            ["Failed", s.services.eventBus.failed],
            ["Retried", s.services.eventBus.retried],
            ["Dead-letter", s.services.eventBus.deadLettered],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between rounded bg-ocean-500/5 px-2 py-1.5">
              <dt className="text-ocean-200/50">{k}</dt>
              <dd className="font-mono text-white">{v}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* Hardware telemetry (Phase 6A: ESP32 gateway) */}
      <Section title="Hardware Telemetry — Real Device">
        {!s.hardware?.registered ? (
          <p className="text-xs text-ocean-200/60">
            No hardware device registered. Register <span className="font-mono">esp32_001</span> to
            stream real telemetry here.
          </p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-bold text-white">{s.hardware.deviceId}</span>
              <span
                role="status"
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                  s.hardware.online
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-500/40 bg-slate-500/10 text-slate-300"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 rounded-full ${s.hardware.online ? "bg-emerald-400" : "bg-slate-400"}`}
                />
                {s.hardware.online ? "ONLINE" : "OFFLINE"}
              </span>
              <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-bold text-cyan-300">
                REAL HARDWARE
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Temperature</p>
                <p className="font-mono text-sm font-bold text-white">
                  {s.hardware.lastReading?.temperature ?? "—"}{s.hardware.lastReading?.temperature !== null && s.hardware.lastReading?.temperature !== undefined ? " °C" : ""}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">pH</p>
                <p className="font-mono text-sm font-bold text-white">
                  {s.hardware.lastReading?.ph ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Salinity</p>
                <p className="font-mono text-sm font-bold text-white">
                  {s.hardware.lastReading?.salinity ?? "—"}{s.hardware.lastReading?.salinity !== null && s.hardware.lastReading?.salinity !== undefined ? " PSU" : ""}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Dissolved O₂</p>
                <p className="font-mono text-sm font-bold text-white">
                  {s.hardware.lastReading?.oxygen ?? "—"}{s.hardware.lastReading?.oxygen !== null && s.hardware.lastReading?.oxygen !== undefined ? " mg/L" : ""}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Turbidity</p>
                <p className="font-mono text-sm font-bold text-white">
                  {s.hardware.lastReading?.turbidity ?? "—"}{s.hardware.lastReading?.turbidity !== null && s.hardware.lastReading?.turbidity !== undefined ? " NTU" : ""}
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Sensor health</p>
                <p className="font-mono text-sm font-bold text-white">
                  {(() => {
                    const have = ["temperature", "ph", "salinity", "oxygen", "turbidity"].filter((f) => {
                      const v = (s.hardware?.lastReading as Record<string, number | null> | null | undefined)?.[f];
                      return typeof v === "number";
                    }).length;
                    return `${have} / 5 available`;
                  })()}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Last seen</p>
                <p className="font-mono text-sm font-bold text-white">
                  {s.hardware.ageSeconds !== null && s.hardware.ageSeconds !== undefined
                    ? `${s.hardware.ageSeconds} sec ago`
                    : "never"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Source</p>
                <p className="text-sm font-bold text-cyan-300">REAL HARDWARE</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">ML readiness</p>
                <p className={`text-sm font-bold ${s.hardware.mlReady ? "text-emerald-300" : "text-orange-300"}`}>
                  {s.hardware.mlReady ? "● READY" : "● WAITING FOR REQUIRED FEATURES"}
                </p>
              </div>
            </div>
            {!s.hardware.mlReady && (s.hardware.missingFeatures?.length ?? 0) > 0 && (
              <p className="mt-2 text-[11px] text-ocean-200/60">
                Missing: {s.hardware.missingFeatures?.join(", ")}. Partial telemetry is persisted
                and displayed. No values are fabricated.
              </p>
            )}
            {/* Device-reported diagnostics (session-scoped, as reported by firmware) */}
            <div className="mt-3 rounded-lg bg-ocean-500/5 p-3">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ocean-200/60">
                Hardware diagnostics — as reported by device
              </p>
              {!s.hardware.diagnostics ? (
                <p className="text-[11px] text-ocean-200/50">Not reported yet (device posts diagnostics ~1/min).</p>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-[11px] md:grid-cols-4">
                  <p><span className="text-ocean-200/50">Firmware </span><span className="font-mono text-white">{s.hardware.diagnostics.firmwareVersion ?? "?"}</span></p>
                  <p><span className="text-ocean-200/50">Uptime </span><span className="font-mono text-white">{s.hardware.diagnostics.uptimeSeconds ?? "?" }s</span></p>
                  <p><span className="text-ocean-200/50">Wi-Fi RSSI </span><span className="font-mono text-white">{s.hardware.diagnostics.wifiRssi ?? "?"} dBm</span></p>
                  <p><span className="text-ocean-200/50">DO pressure </span><span className="font-mono text-white">{s.hardware.diagnostics.pressureSource ?? "?"}</span></p>
                  <div className="col-span-2 flex flex-wrap gap-1.5 md:col-span-4">
                    {(["temperature", "ph", "oxygen", "salinity", "turbidity"] as const).map((k) => {
                      const st = (s.hardware?.diagnostics?.sensors as Record<string, string> | undefined)?.[k] ?? "UNKNOWN";
                      const cal = (s.hardware?.diagnostics?.calibration as Record<string, string> | undefined)?.[k];
                      const ok = st === "OK";
                      return (
                        <span key={k} title={cal ? `Calibration: ${cal}` : "Calibration state not reported"} className={`rounded border px-2 py-0.5 font-semibold ${ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-500/30 bg-slate-500/10 text-slate-300"}`}>
                          {k}: {st}{cal ? (cal === "CALIBRATED" ? " · CALIBRATED" : ` · ${cal}`) : ""}
                        </span>
                      );
                    })}
                    <span className="rounded border border-ocean-500/20 bg-ocean-500/10 px-2 py-0.5 text-ocean-200/70">
                      I²C scan @ boot · ADC conditioned
                    </span>
                  </div>
                  {s.hardware?.diagnostics?.validationSessionId && (
                    <p className="col-span-2 md:col-span-4">
                      <span className="text-ocean-200/50">Validation session </span>
                      <span className="font-mono text-white">{s.hardware.diagnostics.validationSessionId}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </Section>

      {/* Model validation */}
      <Section title="Model Validation — Evaluation Datasets, Not Live Performance">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-ocean-500/15 bg-ocean-500/5 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white">
              <Cpu className="h-4 w-4 text-cyan-300" aria-hidden="true" /> Anomaly Detector
            </p>
            {s.models.anomaly.available ? (
              <>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div><p className="font-mono text-lg font-bold text-white">{pct(s.models.anomaly.precision)}</p><p className="text-[11px] text-ocean-200/60">Precision</p></div>
                  <div><p className="font-mono text-lg font-bold text-white">{pct(s.models.anomaly.recall)}</p><p className="text-[11px] text-ocean-200/60">Recall</p></div>
                  <div><p className="font-mono text-lg font-bold text-white">{pct(s.models.anomaly.f1)}</p><p className="text-[11px] text-ocean-200/60">F1</p></div>
                </div>
                <p className="mt-2 text-[11px] text-orange-300">SYNTHETIC VALIDATION — NOT FIELD PERFORMANCE</p>
              </>
            ) : (
              <p className="mt-2 text-xs text-ocean-200/60">Validation artifact unavailable.</p>
            )}
          </div>
          <div className="rounded-lg border border-ocean-500/15 bg-ocean-500/5 p-4">
            <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white">
              <Cpu className="h-4 w-4 text-cyan-300" aria-hidden="true" /> Species Classifier
            </p>
            {s.models.species.available ? (
              <>
                <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                  <div><p className="font-mono text-lg font-bold text-white">{pct(s.models.species.validationAccuracy)}</p><p className="text-[11px] text-ocean-200/60">Validation accuracy</p></div>
                  <div><p className="font-mono text-lg font-bold text-white">{pct(s.models.species.macroF1)}</p><p className="text-[11px] text-ocean-200/60">Macro F1</p></div>
                </div>
                <p className="mt-2 text-[11px] text-ocean-200/60">
                  HOLD-OUT VALIDATION · {s.models.species.validationSamples ?? "?"} samples · {s.models.species.classCount ?? "?"} classes
                </p>
              </>
            ) : (
              <p className="mt-2 text-xs text-ocean-200/60">Validation artifact unavailable.</p>
            )}
          </div>
        </div>
        <details className="mt-3 rounded-lg bg-ocean-500/5 p-3 text-xs text-ocean-200/70">
          <summary className="cursor-pointer font-semibold text-cyan-300 focus-visible:outline focus-visible:outline-cyan-400">
            How to interpret these metrics <ChevronDown className="inline h-3 w-3" aria-hidden="true" />
          </summary>
          <p className="mt-2 leading-relaxed">
            Runtime health = whether a model/service is available and responding. Validation metrics =
            performance measured on the model&apos;s evaluation dataset. Neither should be interpreted as
            field deployment accuracy.
          </p>
        </details>
      </Section>

      {/* Vision / camera telemetry (Phase 6D — session runtime only) */}
      <Section title="Camera / Vision">
        {!s.vision ? (
          <p className="text-xs text-ocean-200/60">Vision telemetry unavailable.</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-white">CAMERA / VISION</span>
              <span className="rounded-full border border-ocean-500/40 bg-ocean-500/10 px-2.5 py-0.5 text-[11px] font-bold text-ocean-200">
                {s.vision.sourceType ?? "NO SOURCE"}
              </span>
              <span
                role="status"
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                  s.vision.connected
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-slate-500/40 bg-slate-500/10 text-slate-300"
                }`}
              >
                <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${s.vision.connected ? "bg-emerald-400" : "bg-slate-400"}`} />
                {s.vision.connected ? "CONNECTED" : s.vision.state}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Frames</p>
                <p className="font-mono text-sm font-bold text-white">
                  {s.vision.framesProcessed} processed · {s.vision.framesDropped} dropped
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Queue</p>
                <p className="font-mono text-sm font-bold text-white">{s.vision.queueDepth}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">FPS</p>
                <p className="font-mono text-sm font-bold text-white">
                  {s.vision.measuredFps !== null ? s.vision.measuredFps : "—"}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">AI</p>
                <p className="font-mono text-sm font-bold text-white">
                  MobileNetV3-Small{s.vision.avgInferenceMs !== null ? ` · ${s.vision.avgInferenceMs} ms` : ""}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Last frame</p>
                <p className="font-mono text-sm font-bold text-white">{s.vision.lastFrameAt ? fmtTs(s.vision.lastFrameAt) : "—"}</p>
              </div>
              {s.vision.lastFrameId && (
                <div className="col-span-2 md:col-span-4">
                  <p className="mb-1 text-[11px] uppercase tracking-wide text-ocean-200/50">
                    Current frame preview · {s.vision.lastFrameId}
                  </p>
                  {/* Served by the authenticated frame API from persisted bytes. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/vision/frames/${encodeURIComponent(s.vision.lastFrameId)}/file`}
                    alt={`Latest vision frame ${s.vision.lastFrameId}`}
                    className="max-h-48 rounded-lg border border-ocean-500/20 object-contain"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>
              )}
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Image quality</p>
                <p className="font-mono text-sm font-bold text-white">{s.vision.lastQualityStatus ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Camera</p>
                <p className="font-mono text-sm font-bold text-white">{s.vision.cameraId ?? "—"}</p>
              </div>
              {(s.vision.sourceType === "USB_CAMERA" || s.vision.sourceType === "ROV_CAMERA") && (
                <>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Device</p>
                    <p className="font-mono text-sm font-bold text-white">
                      {s.vision.deviceInfo ? `${s.vision.deviceInfo.deviceName} (#${s.vision.deviceInfo.deviceId})` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Resolution</p>
                    <p className="font-mono text-sm font-bold text-white">
                      {s.vision.deviceInfo?.width && s.vision.deviceInfo?.height
                        ? `${s.vision.deviceInfo.width} × ${s.vision.deviceInfo.height}`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">Capture latency</p>
                    <p className="font-mono text-sm font-bold text-white">
                      {s.vision.avgCaptureLatencyMs !== null && s.vision.avgCaptureLatencyMs !== undefined
                        ? `${s.vision.avgCaptureLatencyMs} ms (measured)`
                        : "—"}
                    </p>
                  </div>
                </>
              )}
              <div>
                <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">ROV telemetry</p>
                <p className="font-mono text-sm font-bold text-white">
                  {s.vision.rovTelemetryAvailable ? "AVAILABLE" : "NOT CONNECTED"}
                </p>
              </div>
            </div>
            <p className="mt-2 text-[11px] text-ocean-200/50">
              Session runtime telemetry (resets on backend restart). FPS is measured from
              capture spacing — shown only while frames flow.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ocean-500/10 pt-3">
              <label htmlFor="vision-source" className="text-[11px] uppercase tracking-wide text-ocean-200/60">
                Camera source
              </label>
              <select
                id="vision-source"
                defaultValue={s.vision.sourceType ?? ""}
                className="rounded-lg border border-ocean-500/20 bg-abyss-900 px-2 py-1.5 font-mono text-xs text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
              >
                {["SIMULATED", "FIXTURE_IMAGE", "FIXTURE_VIDEO", "USB_CAMERA"].map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <button
                disabled={switching}
                onClick={async () => {
                  const sel = document.getElementById("vision-source") as HTMLSelectElement | null;
                  if (!sel?.value) return;
                  // Backend source kinds: simulated | fixture | fixture-video | usb.
                  const kindByLabel: Record<string, string> = {
                    SIMULATED: "simulated",
                    FIXTURE_IMAGE: "fixture",
                    FIXTURE_VIDEO: "fixture-video",
                    USB_CAMERA: "usb",
                  };
                  setSwitching(true);
                  setSwitchError("");
                  try {
                    const res = await fetch("/api/vision/source", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ source: kindByLabel[sel.value] ?? sel.value.toLowerCase() }),
                    });
                    const body = await res.json().catch(() => null);
                    if (!res.ok) {
                      // Rejected switches keep the previous source — surfaced, never silent.
                      setSwitchError(body?.error ?? `Switch rejected (${res.status}).`);
                    } else {
                      await fetchSnapshot();
                    }
                  } catch (e) {
                    setSwitchError(e instanceof Error ? e.message : "Switch failed.");
                  } finally {
                    setSwitching(false);
                  }
                }}
                className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
              >
                {switching ? "Switching…" : "Switch source"}
              </button>
              {switchError && (
                <p role="alert" className="w-full text-xs text-red-300">{switchError}</p>
              )}
            </div>
          </>
        )}
      </Section>

      {/* Last incident */}
      <Section title="Last Completed Incident">
        {s.lastIncident ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs md:grid-cols-3">
              <p><span className="text-ocean-200/50">Inspection </span><span className="font-mono text-white">{s.lastIncident.inspectionId}</span></p>
              <p><span className="text-ocean-200/50">Severity </span><span className={`font-bold ${statusTone(s.lastIncident.severity ?? "")}`}>{(s.lastIncident.severity ?? "?").toUpperCase()}</span></p>
              <p><span className="text-ocean-200/50">Sensor </span><span className="text-white">{s.lastIncident.sensorName ?? "?"}</span></p>
              <p><span className="text-ocean-200/50">Drone </span><span className="text-white">{s.lastIncident.droneName ?? "?"}</span></p>
              <p><span className="text-ocean-200/50">Evidence </span><span className="font-mono text-white">{s.lastIncident.evidenceCount}</span></p>
              <p><span className="text-ocean-200/50">Duration </span><span className="font-mono text-white">{s.lastIncident.durationSeconds !== null ? `${s.lastIncident.durationSeconds}s` : "—"}</span></p>
            </div>
            <Link
              href={`/incident-reports/${encodeURIComponent(s.lastIncident.inspectionId)}`}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-500"
            >
              <FileText className="h-3.5 w-3.5" aria-hidden="true" /> View Incident Report
            </Link>
          </div>
        ) : (
          <p className="text-xs text-ocean-200/60">No completed inspections recorded yet.</p>
        )}
      </Section>

      {/* Disclosure */}
      <section aria-label="Demo and validation disclosure" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-300">Demo / Validation Disclosure</h2>
        <p className="text-xs leading-relaxed text-amber-200/80">
          Sensor input and drone movement are simulated. AI inference uses the project&apos;s resident
          models. Anomaly metrics are synthetic validation (2000 sampled normal rows + 500 synthetic
          pollution profiles, seed 42) — not field performance. Species metrics are hold-out validation
          on the training split. Runtime telemetry reflects this backend session only.
        </p>
      </section>

      <Link href="/ai-center" className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to AI Center
      </Link>
    </div>
  );
}
