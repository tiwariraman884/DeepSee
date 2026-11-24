"use client";

/**
 * PollutionForecastEnhanced
 * =========================
 * Short-term pollution spread predictions with:
 *   - 6-hour bar chart of projected severity
 *   - Animated "spread rings" SVG visualisation (each time step expands the
 *     affected radius by the wind factor × concentration)
 *   - Live event list bound to the pollution API
 *
 * Data: POST /api/pollution/forecast (Python heuristic model)
 * This is a heuristic projection, NOT an ocean-current transport model.
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Wind,
  AlertTriangle,
  Loader2,
  MapPin,
  RefreshCw,
  Droplets,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { PollutionEvent } from "@/types";

interface Prediction {
  hour: number;
  label: string;
  severity: number;
}

// ─── Spread Rings SVG ────────────────────────────────────────────────────────

function SpreadRings({
  predictions,
  trend,
}: {
  predictions: Prediction[];
  trend: string;
}) {
  const SIZE = 220;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const BASE_R = 14;
  const MAX_R = CX - 8;

  // Each prediction gets a ring. Radius scales with severity.
  const rings = predictions.map((p, i) => {
    const frac = p.severity / 10;
    const r = BASE_R + frac * (MAX_R - BASE_R) * (0.4 + (i / (predictions.length - 1 || 1)) * 0.6);
    const hue =
      p.severity >= 8
        ? { stroke: "#ef4444", fill: "rgba(239,68,68,0.06)" }
        : p.severity >= 5
        ? { stroke: "#f97316", fill: "rgba(249,115,22,0.05)" }
        : { stroke: "#34d399", fill: "rgba(52,211,153,0.04)" };
    return { r, ...hue, label: p.label, severity: p.severity, hour: p.hour };
  });

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ocean-200/50">
        Spread Projection (6 h)
      </p>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        aria-label="Pollution spread rings showing projected radius over 6 hours"
      >
        {/* Grid circles */}
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <circle
            key={f}
            cx={CX}
            cy={CY}
            r={f * MAX_R}
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth={1}
          />
        ))}

        {/* Spread rings (outermost first so smaller ones render on top) */}
        {[...rings].reverse().map((ring, i) => (
          <motion.circle
            key={ring.hour}
            cx={CX}
            cy={CY}
            r={0}
            fill={ring.fill}
            stroke={ring.stroke}
            strokeWidth={1.5}
            strokeDasharray="4 2"
            initial={{ r: 0, opacity: 0 }}
            animate={{ r: ring.r, opacity: 0.9 }}
            transition={{
              delay: (rings.length - 1 - i) * 0.12,
              duration: 0.6,
              type: "spring",
              bounce: 0.3,
            }}
          />
        ))}

        {/* Origin dot */}
        <motion.circle
          cx={CX}
          cy={CY}
          r={BASE_R}
          fill="rgba(239,68,68,0.3)"
          stroke="#ef4444"
          strokeWidth={2}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.4 }}
        />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize={9} fill="#fb7185" fontWeight="bold">
          SRC
        </text>

        {/* Hour labels on the last two rings */}
        {rings.slice(-2).map((ring) => (
          <text
            key={`label-${ring.hour}`}
            x={CX + ring.r * 0.72}
            y={CY - ring.r * 0.72}
            fontSize={8}
            fill={ring.stroke}
            textAnchor="middle"
          >
            +{ring.hour}h
          </text>
        ))}
      </svg>
      <p className="text-center text-[9px] text-ocean-200/40">
        Each ring represents projected affected radius at that hour.
        <br />
        Heuristic model — not an ocean-current transport simulation.
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PollutionForecastEnhanced() {
  const [severity, setSeverity] = useState(5.0);
  const [trend, setTrend] = useState("stable");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<PollutionEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<PollutionEvent | null>(null);

  // Load active pollution events for quick-fill
  useEffect(() => {
    setEventsLoading(true);
    fetch("/api/pollution?status=active&limit=6")
      .then((r) => r.json())
      .then((d) => {
        const list: PollutionEvent[] = d.pollution ?? [];
        setEvents(list);
        if (list.length > 0) {
          // Pre-fill from the highest severity active event
          const top = [...list].sort((a, b) => b.severity - a.severity)[0];
          setSeverity(top.severity);
          setTrend(top.trend);
          setSelectedEvent(top);
        }
      })
      .catch(() => {})
      .finally(() => setEventsLoading(false));
  }, []);

  const runForecast = async (sev?: number, tr?: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/pollution/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity: sev ?? severity, trend: tr ?? trend }),
      });
      const data = await res.json();
      if (data.predictions) {
        setPredictions(data.predictions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fillFromEvent = (evt: PollutionEvent) => {
    setSelectedEvent(evt);
    setSeverity(evt.severity);
    setTrend(evt.trend);
    setPredictions([]);
  };

  const barColor = (sev: number) =>
    sev > 7 ? "#ef4444" : sev > 4 ? "#f97316" : "#34d399";

  return (
    <Card className="border border-purple-500/20 bg-abyss-950/80">
      <CardHeader
        icon={<TrendingUp className="h-5 w-5 text-purple-400" />}
        title="Pollution Spread Forecast"
        subtitle="6-hour projected severity · heuristic dispersion model"
      />

      {/* Active Events Quick-Fill */}
      <div className="mb-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300/80">
          <MapPin className="h-3.5 w-3.5" />
          Quick-fill from Active Events:
        </p>
        {eventsLoading ? (
          <div className="flex h-8 items-center gap-2 text-xs text-ocean-200/40">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading events…
          </div>
        ) : events.length === 0 ? (
          <p className="text-xs text-ocean-200/40">No active events</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {events.map((evt) => (
              <button
                key={evt.id}
                onClick={() => fillFromEvent(evt)}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition hover:opacity-100 ${
                  selectedEvent?.id === evt.id
                    ? "border-purple-400/60 bg-purple-500/20 text-purple-200"
                    : "border-white/10 bg-white/[0.03] text-ocean-200/60 hover:text-ocean-100"
                }`}
              >
                <span className="font-mono font-bold" style={{ color: barColor(evt.severity) }}>
                  {evt.severity}
                </span>
                {"  "}
                {evt.name.split(" ").slice(0, 2).join(" ")}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Controls */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-ocean-200/70">
                Current Severity
              </label>
              <span
                className="font-mono text-sm font-bold"
                style={{ color: barColor(severity) }}
              >
                {severity.toFixed(1)} / 10
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="0.5"
              value={severity}
              onChange={(e) => {
                setSeverity(parseFloat(e.target.value));
                setPredictions([]);
              }}
              className="w-full accent-purple-500"
            />
            <div className="flex justify-between text-[9px] text-ocean-200/30">
              <span>Low</span>
              <span>Critical</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-ocean-200/70">Trend Direction</label>
            <div className="grid grid-cols-3 gap-2">
              {(["decreasing", "stable", "increasing"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTrend(t);
                    setPredictions([]);
                  }}
                  className={`rounded-lg border px-2 py-2 text-[11px] font-medium transition capitalize ${
                    trend === t
                      ? t === "increasing"
                        ? "border-rose-500/50 bg-rose-500/15 text-rose-300"
                        : t === "decreasing"
                        ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-300"
                        : "border-ocean-500/50 bg-ocean-500/15 text-ocean-300"
                      : "border-white/[0.06] bg-white/[0.02] text-ocean-200/50 hover:text-ocean-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={() => runForecast()}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-3 text-sm font-bold text-white transition hover:bg-purple-500 disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Running Model…
              </>
            ) : (
              <>
                <Wind className="h-4 w-4" /> Generate 6-Hour Forecast
              </>
            )}
          </button>

          {/* Severity bar chart */}
          <AnimatePresence>
            {predictions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300/80">
                  <AlertTriangle className="h-3 w-3 text-orange-400" />
                  Projected Severity
                </p>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={predictions} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fill: "#64748b", fontSize: 9 }} />
                    <YAxis domain={[0, 10]} tick={{ fill: "#64748b", fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{
                        background: "#1e293b",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 8,
                        fontSize: 11,
                      }}
                      formatter={(v: number) => [v.toFixed(1), "Severity"]}
                    />
                    <Bar dataKey="severity" radius={[3, 3, 0, 0]}>
                      {predictions.map((p, i) => (
                        <Cell key={i} fill={barColor(p.severity)} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Spread ring visualisation */}
        <div className="flex items-center justify-center">
          {predictions.length > 0 ? (
            <SpreadRings predictions={predictions} trend={trend} />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <Droplets className="h-10 w-10 text-purple-500/30" />
              <p className="text-xs text-ocean-200/40">
                Generate a forecast to see the spread ring visualisation
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Selected event summary */}
      {selectedEvent && (
        <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs">
          <p className="mb-1.5 font-semibold text-ocean-100/80">{selectedEvent.name}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-ocean-200/60">
            <span>
              Severity:{" "}
              <span style={{ color: barColor(selectedEvent.severity) }} className="font-bold">
                {selectedEvent.severity}/10
              </span>
            </span>
            <span>Region: {selectedEvent.region}</span>
            <span>
              Area: {selectedEvent.affectedArea.toLocaleString()} km²
            </span>
            <span>
              Trend: <span className="capitalize font-medium">{selectedEvent.trend}</span>
            </span>
          </div>
        </div>
      )}
    </Card>
  );
}

export default PollutionForecastEnhanced;
