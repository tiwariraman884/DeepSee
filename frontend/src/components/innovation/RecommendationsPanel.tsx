"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "@/store/useAppStore";
import { alerts, drones, sensors } from "@/data";
import { getMetricProjection, HORIZON_ORDER } from "@/lib/innovation-projections";
import type { TimeHorizon } from "@/types";
import { Radio, MapPin, Waves, AlertTriangle, Fish, Radar } from "lucide-react";

export type Recommendation = {
  id: string;
  title: string;
  region: string;
  priority: "High" | "Medium" | "Low";
  impact: string;
  confidence: number;
  icon: React.ReactNode;
};

function recommendationsFor(horizon: TimeHorizon): Recommendation[] {
  const p = getMetricProjection(horizon);
  const criticalAlerts = alerts.filter((a) => a.type === "critical" && !a.resolved);
  const activeDrones = drones.filter((d) => d.status === "active").length;
  const sensorsOnline = sensors.filter((s) => s.status === "online").length;
  const recs: Recommendation[] = [];

  if (p.pollution > 60) {
    recs.push({
      id: "r1",
      title: "Restrict fishing in high-pollution zones",
      region: criticalAlerts[0]?.location ?? "North Pacific Gyre",
      priority: "High",
      impact: "Reduce bycatch and ecosystem stress",
      confidence: 94,
      icon: <Waves className="h-3.5 w-3.5" aria-hidden="true" />,
    });
  }
  if (p.coralHealth < 60) {
    recs.push({
      id: "r2",
      title: "Deploy underwater drone for reef survey",
      region: "Caribbean / Coral Triangle",
      priority: "High",
      impact: "Early bleaching detection",
      confidence: 91,
      icon: <Radio className="h-3.5 w-3.5" aria-hidden="true" />,
    });
  }
  if (sensorsOnline < sensors.length) {
    recs.push({
      id: "r3",
      title: "Increase sampling frequency on degraded sensors",
      region: "Global",
      priority: "Medium",
      impact: "Improve data continuity",
      confidence: 88,
      icon: <Radar className="h-3.5 w-3.5" aria-hidden="true" />,
    });
  }
  if (criticalAlerts.length > 0) {
    recs.push({
      id: "r4",
      title: "Notify local maritime authorities",
      region: criticalAlerts[0].location,
      priority: "High",
      impact: "Accelerate enforcement response",
      confidence: 97,
      icon: <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />,
    });
  }
  if (p.risk > 55) {
    recs.push({
      id: "r5",
      title: "Increase sonar scan cadence",
      region: "Midnight / Abyss zones",
      priority: "Medium",
      impact: "Detect illegal activity sooner",
      confidence: 82,
      icon: <Radar className="h-3.5 w-3.5" aria-hidden="true" />,
    });
  }
  if (p.species < 140) {
    recs.push({
      id: "r6",
      title: "Monitor key species migration corridors",
      region: "Indo-Pacific / South Pacific",
      priority: "Medium",
      impact: "Protect declining populations",
      confidence: 85,
      icon: <Fish className="h-3.5 w-3.5" aria-hidden="true" />,
    });
  }
  return recs.slice(0, 4);
}

const priorityStyles: Record<string, { color: string; bg: string }> = {
  High: { color: "text-rose-300", bg: "bg-rose-500/15 border-rose-500/30" },
  Medium: { color: "text-amber-300", bg: "bg-amber-500/15 border-amber-500/30" },
  Low: { color: "text-ocean-200/80", bg: "bg-ocean-500/10 border-ocean-500/20" },
};

export function RecommendationsPanel() {
  const horizon = useAppStore((s) => s.timeHorizon);
  const recs = useMemo(() => recommendationsFor(horizon), [horizon]);

  return (
    <div className="space-y-2">
      {recs.map((r, i) => {
        const style = priorityStyles[r.priority];
        return (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            className="flex items-start gap-3 rounded-lg border border-white/5 bg-white/[0.02] p-3"
          >
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${style.bg} ${style.color}`}>
              {r.icon}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-text-primary">{r.title}</p>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.color}`}>
                  {r.priority}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {r.region}
                </span>
                <span>{r.impact}</span>
                <span className="tabular-nums">{r.confidence}% confidence</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
