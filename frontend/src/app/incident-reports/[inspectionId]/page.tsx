"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Download, Printer, ArrowLeft, Loader2,
  Radio, Cpu, FileText, Clock, ShieldAlert,
} from "lucide-react";

interface IncidentReportData {
  reportId: string;
  inspectionId: string;
  generatedAt: string;
  incident: {
    title: string; status: string; severity: string | null; alertId: string | null;
    detectedAt: string | null; location: string | null;
    latitude: number | null; longitude: number | null;
    sensorId: string | null; sensorName: string | null;
    dataSource: string | null; deviceId: string | null;
  };
  detection: {
    alertType: string | null; category: string | null; message: string | null;
    anomalyScore: number | null; detectionLatencyMs: number | null;
    triggerReading: {
      temperature: number | null; ph: number | null; salinity: number | null;
      oxygen: number | null; turbidity: number | null; recordedAt: string | null;
    } | null;
  };
  sensorReadings: IncidentReportData["detection"]["triggerReading"];
  response: {
    droneId: string | null; droneName: string | null; selectionReason: string | null;
    distanceKm: number | null; etaSeconds: number | null;
    origin: { lat: number | null; lng: number | null };
    target: { lat: number | null; lng: number | null };
    dispatchedAt: string | null; arrivalAt: null; arrivalNote: string;
    completedAt: string | null;
  };
  inspection: {
    inspectionId: string; phase: string; startedAt: string | null;
    completedAt: string | null; durationSeconds: number | null;
    summary: string | null;
    findings: { kind: string; label: string; confidence: number | null; detail: string | null }[];
  };
  vision: {
    sourceType: string | null; cameraId: string | null;
    framesCaptured: number; framesProcessed: number; framesDropped: number;
    representativeFrameId: string | null;
  } | null;
  evidence: {
    id: string; kind: string; label: string; confidence: number | null;
    confidenceDisplay: string; detail: string | null; capturedAt: string;
    frameId: string | null; sourceType: string | null;
  }[];
  timeline: { timestamp: string; event: string; description: string }[];
  finalAssessment: { severity: string | null; threatCount: number; summary: string | null; assessment: string };
  disclosure: string;
}

function severityStyle(sev: string | null): string {
  switch ((sev ?? "").toLowerCase()) {
    case "critical": return "bg-red-500/20 text-red-300 border-red-500/40";
    case "high": return "bg-orange-500/20 text-orange-300 border-orange-500/40";
    case "medium": return "bg-yellow-500/20 text-yellow-300 border-yellow-500/40";
    case "low": return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
    default: return "bg-ocean-500/20 text-ocean-200 border-ocean-500/40";
  }
}

function fmtTs(ts: string | null): string {
  if (!ts) return "unavailable";
  try {
    return new Date(ts).toUTCString().replace("GMT", "UTC");
  } catch {
    return ts;
  }
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-ocean-500/20 bg-abyss-950/80 p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-cyan-300">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Meta({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-ocean-200/50">{label}</p>
      <p className={`text-sm font-semibold ${accent ?? "text-white"}`}>{value}</p>
    </div>
  );
}

export default function IncidentReportPage({ params }: { params: Promise<{ inspectionId: string }> }) {
  const { inspectionId } = use(params);
  const [report, setReport] = useState<IncidentReportData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "pending" | "missing" | "error">("loading");
  const [detail, setDetail] = useState<string>("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/reports/incidents/${encodeURIComponent(inspectionId)}`);
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (res.status === 200 && body?.report) {
          setReport(body.report);
          setStatus("ready");
        } else if (res.status === 409) {
          setStatus("pending");
          setDetail(body?.error ?? "Inspection has not completed yet.");
        } else if (res.status === 404) {
          setStatus("missing");
          setDetail(body?.error ?? "Inspection not found.");
        } else {
          setStatus("error");
          setDetail(body?.error ?? `Failed to load report (${res.status}).`);
        }
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setDetail(e instanceof Error ? e.message : "Network failure.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [inspectionId]);

  const downloadPdf = useCallback(async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/reports/incidents/${encodeURIComponent(inspectionId)}/pdf`);
      if (!res.ok) throw new Error(`PDF export failed (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `incident-${inspectionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setDetail(e instanceof Error ? e.message : "PDF download failed.");
    } finally {
      setDownloading(false);
    }
  }, [inspectionId]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-ocean-200/60">
        <Loader2 className="h-5 w-5 animate-spin" /> Assembling incident report…
      </div>
    );
  }

  if (status !== "ready" || !report) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Link href="/ai-center" className="mb-4 inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200">
          <ArrowLeft className="h-4 w-4" /> Back to AI Center
        </Link>
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-center">
          <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-amber-300" />
          <p className="font-semibold text-amber-200">
            {status === "pending" ? "Report not ready yet" : status === "missing" ? "Report not found" : "Could not load report"}
          </p>
          <p className="mt-1 text-sm text-ocean-200/70">{detail}</p>
        </div>
      </div>
    );
  }

  const r = report;
  const reading = r.sensorReadings;

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/ai-center" className="mb-2 inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200">
            <ArrowLeft className="h-4 w-4" /> Back to AI Center
          </Link>
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <FileText className="h-5 w-5 text-cyan-300" />
            INCIDENT REPORT
          </h1>
          <p className="mt-1 font-mono text-xs text-ocean-200/60">
            {r.reportId} · GENERATED {fmtTs(r.generatedAt)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${severityStyle(r.incident.severity)}`}>
            {(r.incident.severity ?? "UNKNOWN").toUpperCase()}
          </span>
          {r.incident.dataSource && (
            <span
              title={r.incident.deviceId ? `Device: ${r.incident.deviceId}` : undefined}
              className={`rounded-full border px-3 py-1 text-[11px] font-bold ${
                r.incident.dataSource === "hardware"
                  ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                  : r.incident.dataSource === "hardware_test"
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                    : "border-ocean-500/40 bg-ocean-500/10 text-ocean-200"
              }`}
            >
              {r.incident.dataSource === "hardware"
                ? "REAL HARDWARE"
                : r.incident.dataSource === "hardware_test"
                  ? "HARDWARE TEST"
                  : r.incident.dataSource === "simulated"
                    ? "SIMULATED INPUT"
                    : r.incident.dataSource.toUpperCase()}
            </span>
          )}
          <div className="flex gap-2">
            <button
              onClick={downloadPdf}
              disabled={downloading}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-50"
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              DOWNLOAD PDF
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-lg border border-ocean-500/30 px-3 py-2 text-xs font-semibold text-ocean-200 transition hover:bg-ocean-500/10"
            >
              <Printer className="h-3.5 w-3.5" /> PRINT
            </button>
          </div>
        </div>
      </div>

      {/* Incident summary */}
      <Section icon={<AlertTriangle className="h-4 w-4" />} title="Incident Summary">
        <p className="mb-3 text-sm text-white">{r.incident.title}</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Meta label="Sensor" value={`${r.incident.sensorName ?? "?"} (${r.incident.sensorId ?? "?"})`} />
          <Meta
            label="Coordinates"
            value={r.incident.latitude !== null && r.incident.longitude !== null
              ? `${r.incident.latitude}, ${r.incident.longitude}` : "unavailable"}
          />
          <Meta label="Detected" value={fmtTs(r.incident.detectedAt)} />
          <Meta label="Alert" value={r.incident.alertId ?? "unavailable"} />
        </div>
      </Section>

      {/* Detection + Response */}
      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={<Radio className="h-4 w-4" />} title="Detection">
          <div className="grid grid-cols-2 gap-3">
            <Meta label="pH" value={reading?.ph !== null && reading?.ph !== undefined ? String(reading.ph) : "unavailable"} accent="text-red-300" />
            <Meta label="Oxygen" value={reading?.oxygen !== null && reading?.oxygen !== undefined ? `${reading.oxygen} mg/L` : "unavailable"} />
            <Meta label="Turbidity" value={reading?.turbidity !== null && reading?.turbidity !== undefined ? `${reading.turbidity} NTU` : "unavailable"} />
            <Meta label="Temperature" value={reading?.temperature !== null && reading?.temperature !== undefined ? `${reading.temperature} °C` : "unavailable"} />
            <Meta label="Salinity" value={reading?.salinity !== null && reading?.salinity !== undefined ? `${reading.salinity} PSU` : "unavailable"} />
            <Meta label="Anomaly score" value={r.detection.anomalyScore !== null ? String(r.detection.anomalyScore) : "unavailable"} />
          </div>
          {r.detection.message && (
            <p className="mt-3 rounded-lg bg-ocean-500/10 p-2 text-xs text-ocean-200/80">{r.detection.message}</p>
          )}
        </Section>
        <Section icon={<Cpu className="h-4 w-4" />} title="Autonomous Response">
          <div className="grid grid-cols-2 gap-3">
            <Meta label="Drone" value={`${r.response.droneName ?? "?"} (${r.response.droneId ?? "?"})`} />
            <Meta label="Distance" value={r.response.distanceKm !== null ? `${r.response.distanceKm} km` : "unavailable"} />
            <Meta label="ETA" value={r.response.etaSeconds !== null ? `${r.response.etaSeconds}s` : "unavailable"} />
            <Meta label="Dispatched" value={fmtTs(r.response.dispatchedAt)} />
          </div>
          <p className="mt-3 text-xs text-ocean-200/70">
            <span className="text-ocean-200/50">Selection: </span>{r.response.selectionReason ?? "unavailable"}
          </p>
          <p className="mt-1 text-xs text-ocean-200/70">
            <span className="text-ocean-200/50">Arrival: </span>{r.response.arrivalNote}
          </p>
        </Section>
      </div>

      {/* AI inspection */}
      <Section icon={<Cpu className="h-4 w-4" />} title={`AI Inspection — ${r.inspection.durationSeconds !== null ? `${r.inspection.durationSeconds}s` : "duration unavailable"}`}>
        <div className="flex flex-wrap gap-2">
          {r.inspection.findings.length === 0 && (
            <span className="text-xs text-ocean-200/60">No threats recorded.</span>
          )}
          {r.inspection.findings.map((f) => (
            <span key={f.kind} className="rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs text-purple-200">
              {f.label}
              <span className="ml-1 font-bold text-white">
                {f.confidence !== null ? `${Math.round(f.confidence > 1 ? f.confidence : f.confidence * 100)}%` : "n/a"}
              </span>
            </span>
          ))}
        </div>
        {r.inspection.summary && (
          <p className="mt-3 text-xs leading-relaxed text-ocean-200/80">{r.inspection.summary}</p>
        )}
      </Section>

      {/* Evidence */}
      <Section icon={<ShieldAlert className="h-4 w-4" />} title={`Evidence — ${r.evidence.length} item(s)`}>
        {r.evidence.length === 0 ? (
          <p className="text-xs text-ocean-200/60">No evidence persisted for this inspection.</p>
        ) : (
          <div className="space-y-2">
            {r.evidence.map((e, i) => (
              <div key={e.id} className="flex flex-wrap items-baseline gap-x-3 rounded-lg bg-ocean-500/5 px-3 py-2">
                <span className="font-mono text-xs text-ocean-200/50">#{String(i + 1).padStart(2, "0")}</span>
                <span className="text-sm font-semibold text-white">{e.label}</span>
                <span className="text-sm font-bold text-emerald-300">{e.confidenceDisplay}</span>
                <span className="w-full text-xs text-ocean-200/70">{e.detail ?? ""} · {fmtTs(e.capturedAt)}</span>
                {(e.frameId || e.sourceType) && (
                  <span className="w-full font-mono text-[11px] text-ocean-200/50">
                    frame {e.frameId ?? "—"} · {e.sourceType ?? "source not recorded"}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Timeline */}
      <Section icon={<Clock className="h-4 w-4" />} title="Incident Timeline">
        <ol className="space-y-2">
          {r.timeline.map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cyan-400" />
              <div>
                <p className="text-sm font-semibold text-white">{t.event}</p>
                <p className="font-mono text-[11px] text-ocean-200/50">{fmtTs(t.timestamp)}</p>
                <p className="text-xs text-ocean-200/70">{t.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* Final assessment */}
      <Section icon={<AlertTriangle className="h-4 w-4" />} title="Final Assessment">
        <div className="mb-2 flex items-center gap-2">
          <span className={`rounded-full border px-3 py-1 text-xs font-bold ${severityStyle(r.finalAssessment.severity)}`}>
            {(r.finalAssessment.severity ?? "UNKNOWN").toUpperCase()}
          </span>
          <span className="text-xs text-ocean-200/60">{r.finalAssessment.threatCount} threat(s) recorded</span>
        </div>
        <p className="text-sm leading-relaxed text-ocean-200/90">{r.finalAssessment.assessment}</p>
      </Section>

      {/* Disclosure */}
      <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <h2 className="mb-1 text-xs font-bold uppercase tracking-wide text-amber-300">Demo / Simulation Disclosure</h2>
        <p className="text-xs leading-relaxed text-amber-200/80">{r.disclosure}</p>
      </section>
    </div>
  );
}
