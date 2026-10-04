"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { AlertTriangle, Play, CheckCircle2, XCircle, Loader2, Radio, FileText } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

type ScenarioState = "idle" | "running" | "complete" | "busy" | "error";

interface ScenarioStep {
  label: string;
  done: boolean;
}

const INITIAL_STEPS: ScenarioStep[] = [
  { label: "Sensor anomaly injected", done: false },
  { label: "AI anomaly detected", done: false },
  { label: "Critical alert generated", done: false },
  { label: "Drone dispatched", done: false },
  { label: "Inspection in progress", done: false },
  { label: "Evidence capture", done: false },
  { label: "Completion", done: false },
];

export function EmergencyScenario() {
  const [state, setState] = useState<ScenarioState>("idle");
  const [steps, setSteps] = useState<ScenarioStep[]>(INITIAL_STEPS);
  const [error, setError] = useState<string | null>(null);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [result, setResult] = useState<{
    drone: string;
    sensor: string;
    severity: string;
    evidence: number;
    aiDetection: string;
  } | null>(null);

  const store = useAppStore();
  const sseRef = useRef<EventSource | null>(null);
  // scenarioId as a ref: the stream effect must NOT depend on it. Re-running
  // the effect when scenarioId arrives (right after POST) tears down and
  // recreates the EventSource exactly inside the 1–5s window where the
  // backend fires anomaly_alert/drone_dispatch — those events are then missed
  // and the progress UI freezes on step 0 while the mission runs fine.
  const scenarioIdRef = useRef<string | null>(null);
  scenarioIdRef.current = scenarioId;

  // Reset steps when idle
  const resetSteps = useCallback(() => {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, done: false })));
  }, []);

  // Update a specific step
  const completeStep = useCallback((index: number) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, done: true } : s)));
  }, []);

  // Listen for SSE events to track scenario progress.
  // Resilient: a dropped stream reconnects with backoff while running instead
  // of silently freezing the progress UI (the previous empty onerror handler
  // left SCENARIO RUNNING stuck forever on any SSE failure).
  useEffect(() => {
    if (state !== "running") return;

    let closed = false;
    let retries = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const MAX_RETRIES = 20; // ~60s at 3s intervals — covers the ~50s mission

    const fetchResult = (completedInspectionId: string | null) => {
      // Deterministic first: the completion event carries the inspectionId.
      // Fall back to the scenario lookup only for older backends.
      const currentScenarioId = scenarioIdRef.current;
      const url = completedInspectionId
        ? `/api/demo/inspection/${encodeURIComponent(completedInspectionId)}`
        : currentScenarioId
          ? `/api/demo/scenario/${encodeURIComponent(currentScenarioId)}`
          : null;
      if (!url) return;
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data?.inspection) return;
          setResult({
            drone: data.inspection?.drone_name || "Unknown",
            sensor: data.inspection?.sensor_name || "Unknown",
            severity: data.inspection?.severity || "Unknown",
            evidence: data.evidenceCount || 0,
            aiDetection: data.inspection?.summary?.includes("AI") ? "Detected" : "None",
          });
        })
        .catch(() => {
          // Result fetch is best-effort — completion state itself is authoritative.
        });
    };

    const connect = () => {
      if (closed) return;
      const sse = new EventSource("/api/sensors/stream");
      sseRef.current = sse;

      sse.addEventListener("anomaly_alert", () => {
        completeStep(1); // AI anomaly detected
        completeStep(2); // Critical alert generated
      });

      sse.addEventListener("drone_dispatch", () => {
        completeStep(3); // Drone dispatched
      });

      sse.addEventListener("inspection_started", () => {
        completeStep(4); // Inspection in progress
      });

      sse.addEventListener("evidence_captured", () => {
        completeStep(5); // Evidence capture
      });

      sse.addEventListener("inspection_completed", (event) => {
        completeStep(6); // Completion
        // Capture the real inspection ID for the incident report link.
        let completedId: string | null = null;
        try {
          const data = JSON.parse((event as MessageEvent).data);
          if (data?.inspectionId) {
            completedId = String(data.inspectionId);
            setInspectionId(completedId);
          }
        } catch { /* scenarioId-based fallback below */ }
        setState("complete");

        // Fetch final result (deterministic inspection lookup first).
        fetchResult(completedId);
      });

      sse.onerror = () => {
        sse.close();
        if (sseRef.current === sse) sseRef.current = null;
        if (closed || retries >= MAX_RETRIES) return;
        retries += 1;
        retryTimer = setTimeout(connect, 3000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) clearTimeout(retryTimer);
      sseRef.current?.close();
      sseRef.current = null;
    };
    // NOTE: scenarioId is intentionally NOT a dependency (see ref above).
  }, [state, completeStep]);

  // Start the emergency scenario
  const startScenario = async () => {
    setState("running");
    setError(null);
    setResult(null);
    setInspectionId(null);
    resetSteps();
    completeStep(0); // Sensor anomaly injected (immediately)

    // Bounded request: if the start call cannot get a connection (e.g. the
    // browser's per-host connection pool is exhausted by duplicate tabs each
    // holding SSE streams), fail visibly instead of hanging on RUNNING forever.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const res = await fetch("/api/demo/emergency-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Parse defensively: error responses may be non-JSON (proxy 404/502 pages).
      const data = await res.json().catch(() => null);

      if (res.status === 202 && data?.status === "started") {
        setScenarioId(data.scenarioId);
        // Steps 1-6 will be completed by SSE events
      } else if (res.status === 409 && data?.status === "busy") {
        setState("busy");
        setError(data.message || "Another inspection is currently active.");
      } else if (res.status === 409 && data?.status === "unavailable") {
        setState("error");
        setError(data.message || "No eligible drone available.");
      } else if (res.status === 401) {
        setState("error");
        setError("Please log in to run the emergency scenario.");
      } else if (res.status === 429) {
        setState("error");
        setError(
          `Server is busy (rate limited${data?.retryAfter ? ` — retry in ${data.retryAfter}s` : ""}). Please wait and try again.`
        );
      } else if (res.status === 503) {
        setState("error");
        setError(data?.message || "ML worker not ready.");
      } else {
        setState("error");
        // Surface the backend's actual reason instead of hiding it.
        setError(
          data?.message ||
            data?.error ||
            `Scenario start failed (${res.status}).`
        );
      }
    } catch (err) {
      clearTimeout(timeout);
      setState("error");
      // Fetch itself threw: transport failure, backend unreachable, or the
      // 20s start timeout fired (aborted). The timeout case usually means the
      // browser could not open a connection at all — classically duplicate
      // tabs each holding SSE streams exhausting the per-host pool.
      const isAbort = err instanceof Error && err.name === "AbortError";
      setError(
        isAbort
          ? "Start request timed out — close duplicate DeepSea tabs (each holds live streams) and try again."
          : err instanceof Error && err.message
            ? `Unable to start scenario — ${err.message}`
            : "Unable to start scenario — backend unavailable."
      );
    }
  };

  // Reset to idle
  const resetScenario = () => {
    setState("idle");
    setSteps(INITIAL_STEPS);
    setError(null);
    setScenarioId(null);
    setInspectionId(null);
    setResult(null);
  };

  return (
    <div className="rounded-xl border border-ocean-500/20 bg-abyss-950/80 p-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/20">
          <AlertTriangle className="h-5 w-5 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Emergency Ocean Scenario</h3>
          <p className="text-xs text-ocean-200/60">
            Controlled software demonstration · Uses simulated sensor input
          </p>
        </div>
      </div>

      {/* Transparency Notice */}
      <div className="mb-4 rounded-lg border border-ocean-500/10 bg-ocean-500/5 p-3">
        <p className="text-xs text-ocean-200/70">
          <span className="font-semibold text-cyan-400">SIMULATED INPUT</span>
          {" + "}
          <span className="font-semibold text-emerald-400">REAL AI INFERENCE</span>
          {" + "}
          <span className="font-semibold text-orange-400">REAL EVENT PIPELINE</span>
          {" + "}
          <span className="font-semibold text-purple-400">SIMULATED DRONE MOVEMENT</span>
        </p>
      </div>

      {/* Button */}
      <div className="mb-4">
        {state === "idle" && (
          <button
            onClick={startScenario}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-red-500"
          >
            <Play className="h-4 w-4" />
            RUN EMERGENCY OCEAN SCENARIO
          </button>
        )}

        {state === "running" && (
          <button
            disabled
            className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-orange-600/50 px-6 py-3 text-sm font-semibold text-orange-200"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            SCENARIO RUNNING
          </button>
        )}

        {state === "complete" && (
          <button
            onClick={resetScenario}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            <CheckCircle2 className="h-4 w-4" />
            SCENARIO COMPLETE — RUN AGAIN
          </button>
        )}

        {state === "busy" && (
          <button
            onClick={resetScenario}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-amber-600/50 px-6 py-3 text-sm font-semibold text-amber-200"
          >
            <Radio className="h-4 w-4" />
            INSPECTION ALREADY ACTIVE
          </button>
        )}

        {state === "error" && (
          <button
            onClick={resetScenario}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-600/50 px-6 py-3 text-sm font-semibold text-red-200"
          >
            <XCircle className="h-4 w-4" />
            SCENARIO UNAVAILABLE
          </button>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Progress Steps */}
      {state === "running" && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-ocean-200/60">
            Scenario Progress
          </p>
          {steps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`h-2 w-2 rounded-full ${
                  step.done ? "bg-emerald-400" : "bg-ocean-500/30"
                }`}
              />
              <span
                className={`text-sm ${
                  step.done ? "text-emerald-300" : "text-ocean-200/40"
                }`}
              >
                {step.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Result Summary */}
      {state === "complete" && result && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <p className="mb-3 text-sm font-semibold text-emerald-300">
            EMERGENCY OCEAN SCENARIO COMPLETE
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-ocean-200/50">Anomaly</p>
              <p className="font-semibold text-red-300">Critical</p>
            </div>
            <div>
              <p className="text-ocean-200/50">Sensor</p>
              <p className="font-semibold text-white">{result.sensor}</p>
            </div>
            <div>
              <p className="text-ocean-200/50">Drone</p>
              <p className="font-semibold text-white">{result.drone}</p>
            </div>
            <div>
              <p className="text-ocean-200/50">Inspection</p>
              <p className="font-semibold text-emerald-300">Complete</p>
            </div>
            <div>
              <p className="text-ocean-200/50">AI Detection</p>
              <p className="font-semibold text-white">{result.aiDetection}</p>
            </div>
            <div>
              <p className="text-ocean-200/50">Evidence</p>
              <p className="font-semibold text-white">{result.evidence} items</p>
            </div>
            <div>
              <p className="text-ocean-200/50">Severity</p>
              <p className="font-semibold text-red-300">{result.severity}</p>
            </div>
          </div>
          {/* Operator opens the incident report explicitly — no auto-navigation. */}
          {inspectionId && (
            <a
              href={`/incident-reports/${encodeURIComponent(inspectionId)}`}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500"
            >
              <FileText className="h-4 w-4" />
              VIEW INCIDENT REPORT
            </a>
          )}
        </div>
      )}

      {/* Idle State Info */}
      {state === "idle" && (
        <div className="rounded-lg border border-ocean-500/10 bg-ocean-500/5 p-3">
          <p className="text-xs text-ocean-200/70">
            Click the button to trigger a complete autonomous response scenario.
            The system will inject a known anomalous sensor reading, run AI anomaly
            detection, dispatch a drone, and perform a full inspection — all through
            the real production pipeline.
          </p>
        </div>
      )}
    </div>
  );
}
