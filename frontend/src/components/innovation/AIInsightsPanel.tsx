"use client";

import { motion } from "framer-motion";
import { riskPredictions } from "@/data/metrics";
import { Brain, AlertTriangle, Info, CheckCircle2 } from "lucide-react";

const iconForCategory = (category: string) => {
  if (category.includes("coral")) return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
  if (category.includes("biodiversity")) return <Brain className="h-3.5 w-3.5" aria-hidden="true" />;
  if (category.includes("pollution")) return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
  if (category.includes("fishing")) return <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />;
  return <Info className="h-3.5 w-3.5" aria-hidden="true" />;
};

const priorityMeta: Record<string, { color: string; bg: string }> = {
  high: { color: "text-rose-300", bg: "bg-rose-500/15 border-rose-500/30" },
  medium: { color: "text-amber-300", bg: "bg-amber-500/15 border-amber-500/30" },
  low: { color: "text-ocean-200/80", bg: "bg-ocean-500/10 border-ocean-500/20" },
};

function priorityFor(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 45) return "medium";
  return "low";
}

export function AIInsightsPanel() {
  const insights = riskPredictions.slice(0, 5);
  return (
    <div className="space-y-2.5">
      {insights.map((r, i) => {
        const pri = priorityFor(r.score);
        const pm = priorityMeta[pri];
        const horizonOffset = r.horizon === "today" ? 0 : 30;
        const displayDate = new Date(2026, 6, 19 + horizonOffset).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        });
        return (
          <motion.div
            key={`${r.category}-${i}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            className="flex gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"
          >
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${pm.bg} ${pm.color}`}>
              {iconForCategory(r.category)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-sm font-medium text-text-primary">{r.narrative}</p>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                <span className="inline-flex items-center gap-1">
                  <Brain className="h-3 w-3" aria-hidden="true" />
                  {r.confidence}% confidence
                </span>
                <span className={`rounded-full border px-2 py-0.5 ${pm.bg} ${pm.color}`}>{pri.toUpperCase()}</span>
                <span>{r.region}</span>
                <span className="text-ocean-200/50">{displayDate}</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
