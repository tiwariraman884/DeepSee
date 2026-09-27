"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import { timeSeries, riskPredictions } from "@/data/metrics";
import { getMetricProjection, HORIZON_ORDER } from "@/lib/innovation-projections";
import type { TimeHorizon } from "@/types";

const CHART_COLORS = {
  pollution: "#ff7043",
  biodiversity: "#22e6a3",
  waterQuality: "#43d1ff",
  temperature: "#f59e0b",
  coral: "#ff8a65",
  risk: "#fb923c",
  illegalFishing: "#EF4444",
  oilSpill: "#fbbf24",
};

function makeTemperatureSeries() {
  return HORIZON_ORDER.map((h) => {
    const p = getMetricProjection(h);
    return { label: h === "today" ? "Now" : h, value: p.temperature };
  });
}

function makeCoralSeries() {
  return HORIZON_ORDER.map((h) => {
    const p = getMetricProjection(h);
    const prob = Math.max(0, Math.min(100, 100 - p.coralHealth));
    return { label: h === "today" ? "Now" : h, value: prob };
  });
}

function makeRiskBars() {
  const cats = [
    { key: "illegalFishing", label: "Illegal Fishing", color: CHART_COLORS.illegalFishing, category: "illegal_fishing" as const },
    { key: "oilSpill", label: "Oil Spill", color: CHART_COLORS.oilSpill, category: "oil_spill" as const },
    { key: "coral", label: "Coral Bleaching", color: CHART_COLORS.coral, category: "coral_bleaching" as const },
    { key: "biodiversity", label: "Biodiversity Loss", color: CHART_COLORS.biodiversity, category: "biodiversity_loss" as const },
    { key: "pollution", label: "Pollution", color: CHART_COLORS.pollution, category: "pollution_expansion" as const },
  ];
  return cats.map((c) => {
    const items = riskPredictions.filter((r) => r.category === c.category);
    const score = items.length ? Math.round(items.reduce((s, r) => s + r.score, 0) / items.length) : 0;
    return { label: c.label, value: score, color: c.color };
  });
}

const tooltipStyle = {
  contentStyle: {
    background: "#0b1722",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "8px",
    color: "#e2e8f0",
    fontSize: "12px",
  } as React.CSSProperties,
};

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <p className="mb-2 text-[11px] uppercase tracking-wide text-text-muted">{title}</p>
      <div className="h-36 w-full">{children}</div>
    </div>
  );
}

export function PredictionCharts() {
  const temp = useMemo(() => makeTemperatureSeries(), []);
  const coral = useMemo(() => makeCoralSeries(), []);
  const bars = useMemo(() => makeRiskBars(), []);
  const maxTemp = Math.max(...temp.map((d) => d.value));
  const minTemp = Math.min(...temp.map((d) => d.value));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <ChartCard title="Pollution Forecast">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeSeries}>
            <defs>
              <linearGradient id="grad-pollution" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.pollution} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CHART_COLORS.pollution} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="pollution" stroke={CHART_COLORS.pollution} fill="url(#grad-pollution)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Marine Biodiversity">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeSeries}>
            <defs>
              <linearGradient id="grad-bio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.biodiversity} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CHART_COLORS.biodiversity} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="biodiversity" stroke={CHART_COLORS.biodiversity} fill="url(#grad-bio)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Temperature Anomaly">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={temp}>
            <defs>
              <linearGradient id="grad-temp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.temperature} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CHART_COLORS.temperature} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis domain={[minTemp - 0.1, maxTemp + 0.1]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={32} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS.temperature} fill="url(#grad-temp)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Coral Bleaching Probability">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={coral}>
            <defs>
              <linearGradient id="grad-coral" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.coral} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CHART_COLORS.coral} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="value" stroke={CHART_COLORS.coral} fill="url(#grad-coral)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Water Quality">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timeSeries}>
            <defs>
              <linearGradient id="grad-wq" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={CHART_COLORS.waterQuality} stopOpacity={0.35} />
                <stop offset="95%" stopColor={CHART_COLORS.waterQuality} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis domain={[60, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip {...tooltipStyle} />
            <Area type="monotone" dataKey="waterQuality" stroke={CHART_COLORS.waterQuality} fill="url(#grad-wq)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Threat Risk Index">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={bars}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={28} />
            <Tooltip {...tooltipStyle} />
            <Bar dataKey="value" radius={[3, 3, 0, 0]}>
              {bars.map((entry) => (
                <rect key={entry.label} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}
