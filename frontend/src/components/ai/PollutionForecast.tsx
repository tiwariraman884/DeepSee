"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, Wind, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";

interface Prediction {
  hour: number;
  label: string;
  severity: number;
}

export function PollutionForecast() {
  const [severity, setSeverity] = useState(5.0);
  const [trend, setTrend] = useState("stable");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);

  const runForecast = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/pollution/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity, trend }),
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

  return (
    <Card className="p-4 bg-black/40 border-slate-800">
      <CardHeader
        icon={<TrendingUp className="w-5 h-5 text-purple-400" />}
        title="AI Spread Forecast"
        subtitle="Predict 6-hour trajectory for active pollution events."
      />
      <div className="mt-4 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Current Severity (1-10)</label>
            <input
              type="range"
              min="1" max="10" step="0.5"
              value={severity}
              onChange={(e) => setSeverity(parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
            <div className="text-sm font-mono text-purple-400">{severity.toFixed(1)}</div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Current Trend</label>
            <select
              value={trend}
              onChange={(e) => setTrend(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-sm text-slate-300 focus:outline-none focus:border-purple-500"
            >
              <option value="decreasing">Decreasing</option>
              <option value="stable">Stable</option>
              <option value="increasing">Increasing</option>
            </select>
          </div>
        </div>

        <button
          onClick={runForecast}
          disabled={loading}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white p-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wind className="w-4 h-4" />}
          Generate 6h Forecast
        </button>

        <AnimatePresence>
          {predictions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="pt-4 border-t border-slate-800"
            >
              <div className="text-xs text-slate-400 mb-2 flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-orange-400" /> Projected Severity (1-10)
              </div>
              <div className="flex items-end justify-between h-24 gap-2">
                {predictions.map((p, i) => (
                  <div key={i} className="flex flex-col items-center flex-1 gap-1">
                    <span className="text-[10px] text-slate-300 font-mono">{p.severity.toFixed(1)}</span>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${(p.severity / 10) * 100}%` }}
                      transition={{ delay: i * 0.1, duration: 0.5, type: "spring" }}
                      className={`w-full rounded-t-sm ${
                        p.severity > 7 ? "bg-red-500/80" : p.severity > 4 ? "bg-orange-500/80" : "bg-emerald-500/80"
                      }`}
                    />
                    <span className="text-[10px] text-slate-500">{p.label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Card>
  );
}
