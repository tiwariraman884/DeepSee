"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Loader2, AlertTriangle, CheckCircle2, RotateCcw, Radio, Send } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useAppStore } from "@/store/useAppStore";

// Default "normal" water values pre-filled
const NORMAL_PRESET = { temperature: 3.1, ph: 8.05, salinity: 34.5, oxygen: 5.2, turbidity: 0.4 };
// Chemical spill scenario (acidic pH, low oxygen, high turbidity)
const SPILL_PRESET = { temperature: 3.1, ph: 6.5, salinity: 34.5, oxygen: 2.1, turbidity: 12.0 };

type SensorInput = typeof NORMAL_PRESET;
type Result = { isAnomaly: boolean; status: string } | null;

const FIELDS: { key: keyof SensorInput; label: string; unit: string; min: number; max: number; step: number }[] = [
  { key: "temperature", label: "Temperature", unit: "°C", min: 0, max: 30, step: 0.1 },
  { key: "ph",          label: "pH Level",    unit: "pH", min: 0, max: 14, step: 0.01 },
  { key: "salinity",    label: "Salinity",    unit: "PSU", min: 30, max: 40, step: 0.1 },
  { key: "oxygen",      label: "Oxygen",      unit: "mg/L", min: 0, max: 15, step: 0.1 },
  { key: "turbidity",   label: "Turbidity",   unit: "NTU", min: 0, max: 50, step: 0.1 },
];

export function AnomalyDetector() {
  const [values, setValues] = useState<SensorInput>(NORMAL_PRESET);
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [droneDispatched, setDroneDispatched] = useState(false);
  const addAlert = useAppStore((s) => s.addAlert);

  const handleChange = (key: keyof SensorInput, val: string) => {
    setValues((prev) => ({ ...prev, [key]: parseFloat(val) || 0 }));
    setResult(null);
    setDroneDispatched(false);
  };

  const runPrediction = async (customValues?: SensorInput) => {
    const inputData = customValues || values;
    setLoading(true);
    setResult(null);
    setError(null);
    setDroneDispatched(false);
    try {
      const res = await fetch("/api/sensors/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Unknown error");
      setResult(data);
      // If anomaly is detected, push a live alert to the dashboard
      if (data.isAnomaly) {
        addAlert({
          id: `ml-alert-${Date.now()}`,
          type: "critical",
          message: `AI Alert: Chemical Spill Anomaly — pH ${inputData.ph}, Turbidity ${inputData.turbidity} NTU`,
          location: "Autonomous Mesh Sector 4",
          timestamp: new Date().toISOString(),
          read: false,
          resolved: false,
          category: "pollution",
        });
      }
    } catch (e: any) {
      setError(e.message || "Failed to connect to ML model.");
    } finally {
      setLoading(false);
    }
  };

  const loadCleanPreset = () => {
    setValues(NORMAL_PRESET);
    setResult(null);
    setError(null);
    setDroneDispatched(false);
  };

  const triggerChemicalSpillScenario = () => {
    setValues(SPILL_PRESET);
    runPrediction(SPILL_PRESET);
  };

  return (
    <Card className="border border-ocean-500/20 bg-abyss-950/80 shadow-lg">
      <CardHeader
        title="AI Anomaly Detector"
        subtitle="Live ML-powered water quality analysis · Isolation Forest Model"
        icon={<Brain className="h-5 w-5 text-violet-400" />}
      />

      {/* QUICK PRESETS & DEMO SCENARIOS */}
      <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.02] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-ocean-200/70">
            Quick Simulation Scenarios:
          </span>
          <button
            onClick={loadCleanPreset}
            className="flex items-center gap-1 text-[11px] text-ocean-200/50 hover:text-ocean-200 transition"
          >
            <RotateCcw className="h-3 w-3" /> Reset Values
          </button>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={loadCleanPreset}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/25 active:scale-95"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            Clean Ocean Baseline
          </button>
          <button
            id="btn-chemical-spill"
            onClick={triggerChemicalSpillScenario}
            className="flex items-center gap-1.5 rounded-lg border border-rose-500 bg-rose-600/30 px-3.5 py-2 text-xs font-bold text-rose-200 shadow-md shadow-rose-950/50 transition hover:bg-rose-600/50 hover:border-rose-400 active:scale-95 animate-pulse"
          >
            <AlertTriangle className="h-4 w-4 text-rose-400" />
            ⚠️ Trigger Chemical Spill Scenario
          </button>
        </div>
      </div>

      {/* Input Sliders */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {FIELDS.map(({ key, label, unit, min, max, step }) => (
          <div key={key} className="rounded-xl border border-white/5 bg-white/[0.03] p-2.5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-medium text-ocean-200/70">{label}</span>
              <span className="text-xs font-bold text-white">
                {values[key].toFixed(step < 0.1 ? 2 : 1)} <span className="text-[10px] text-ocean-200/40">{unit}</span>
              </span>
            </div>
            <input
              id={`sensor-${key}`}
              type="range"
              min={min}
              max={max}
              step={step}
              value={values[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full accent-violet-500 cursor-pointer"
            />
            <div className="mt-0.5 flex justify-between text-[9px] text-ocean-200/30">
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Primary Action Button */}
      <button
        id="run-anomaly-detection"
        onClick={() => runPrediction()}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 active:scale-[0.99] disabled:opacity-60"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing Sensor Mesh with Isolation Forest…</>
        ) : (
          <><Brain className="h-4 w-4" /> Run Anomaly Detection</>
        )}
      </button>

      {/* Error Output */}
      {error && (
        <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/15 p-3 text-xs text-rose-300">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Result Output */}
      <AnimatePresence>
        {result && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mt-4 rounded-xl border p-4 shadow-xl ${
              result.isAnomaly
                ? "border-rose-500/60 bg-gradient-to-r from-rose-950/60 to-rose-900/40"
                : "border-emerald-500/60 bg-gradient-to-r from-emerald-950/60 to-emerald-900/40"
            }`}
          >
            <div className="flex items-start gap-3">
              {result.isAnomaly ? (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400">
                  <AlertTriangle className="h-6 w-6 animate-bounce" />
                </div>
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
              )}
              <div className="flex-1">
                <p className={`text-base font-bold ${result.isAnomaly ? "text-rose-300" : "text-emerald-300"}`}>
                  {result.isAnomaly ? "CRITICAL ANOMALY DETECTED — Chemical Spill Event!" : "Normal Water Quality Verified"}
                </p>
                <p className="mt-1 text-xs text-ocean-100/80 leading-relaxed">
                  {result.isAnomaly
                    ? `Sensor parameters deviated significantly from deep-sea baseline (pH ${values.ph}, Turbidity ${values.turbidity} NTU, Oxygen ${values.oxygen} mg/L). Potential acid/oil chemical runoff.`
                    : "All physical and chemical parameters are strictly within normal marine thresholds."}
                </p>
              </div>
            </div>

            {/* DRONE DISPATCH ACTION */}
            {result.isAnomaly && (
              <div className="mt-4 border-t border-rose-500/30 pt-3">
                {droneDispatched ? (
                  <div className="flex items-center justify-between rounded-lg border border-emerald-500/40 bg-emerald-500/20 p-3 text-xs text-emerald-200">
                    <div className="flex items-center gap-2 font-semibold">
                      <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                      <span>AquaDrone Alpha Dispatched · Telemetry En Route (Sector 4)</span>
                    </div>
                    <span className="rounded-full bg-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      ETA: 3m 45s
                    </span>
                  </div>
                ) : (
                  <button
                    id="btn-dispatch-drone"
                    onClick={() => setDroneDispatched(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/50 bg-gradient-to-r from-cyan-600 to-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg transition hover:from-cyan-500 hover:to-blue-500 active:scale-98"
                  >
                    <Send className="h-4 w-4" />
                    🚁 Dispatch Nearest Drone for Emergency Inspection
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

