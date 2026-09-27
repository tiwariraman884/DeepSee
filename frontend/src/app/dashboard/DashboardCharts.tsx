"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { oceanHealth } from "@/data/metrics";

const CHART_COLORS = {
  pollution: "#ff7043",
  biodiversity: "#22e6a3",
  waterQuality: "#43d1ff",
  coralHealth: "#ff8a65",
};

type DashboardChartsProps = {
  trendData: { label: string; pollution: number; biodiversity: number; waterQuality: number }[];
  dateRange: string;
  timeHorizon: string;
  projection: { oceanHealth: number; label: string; changePct: number };
};

export function DashboardCharts({ trendData, dateRange, timeHorizon, projection }: DashboardChartsProps) {
  const healthPie = useMemo(() => {
    const scale = projection.oceanHealth / oceanHealth.overall;
    return [
      { name: "Pollution", value: Math.round(oceanHealth.pollution * scale), color: "#ff7043" },
      { name: "Biodiversity", value: Math.round(oceanHealth.biodiversity * scale), color: "#22e6a3" },
      { name: "Water Quality", value: Math.round(oceanHealth.waterQuality * scale), color: "#43d1ff" },
      { name: "Coral Health", value: Math.round(oceanHealth.coralHealth * scale), color: "#ff8a65" },
    ];
  }, [projection.oceanHealth]);

  return (
    <section className="grid gap-4 lg:grid-cols-2" style={{ minHeight: 300 }}>
      <Card>
        <CardHeader title="Pollution Trend" subtitle={`${dateRange} · ${projection.label}`} />
        <div key={`pollution-${dateRange}-${timeHorizon}`} className="transition-opacity duration-300" role="img" aria-label={`Pollution trend area chart for ${dateRange}, ${projection.label} horizon. Latest value ${trendData[trendData.length - 1]?.pollution}, range ${Math.min(...trendData.map((d) => d.pollution))} to ${Math.max(...trendData.map((d) => d.pollution))}.`}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="pollGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ff7043" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#ff7043" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fill: "#7fb0cd", fontSize: 9 }} interval={Math.floor(trendData.length / 6)} />
              <YAxis tick={{ fill: "#7fb0cd", fontSize: 10 }} domain={[40, 70]} />
              <Tooltip contentStyle={{ background: "#0f2233", border: "1px solid #43d1ff55", borderRadius: 12, color: "#e6f4f1" }} />
              <Area type="monotone" dataKey="pollution" stroke="#ff7043" strokeWidth={2} fill="url(#pollGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
      <Card>
        <CardHeader title="Ocean Health Index" subtitle={`Pillar breakdown · ${projection.label}`} />
        <div key={`health-${dateRange}-${timeHorizon}`} className="flex items-center gap-4 transition-opacity duration-300" role="img" aria-label={`Ocean Health Index donut chart, ${projection.label} horizon. Overall ${projection.oceanHealth} out of 100. Pollution ${Math.round(oceanHealth.pollution * projection.oceanHealth / 72)}, Biodiversity ${Math.round(oceanHealth.biodiversity * projection.oceanHealth / 72)}, Water Quality ${Math.round(oceanHealth.waterQuality * projection.oceanHealth / 72)}, Coral Health ${Math.round(oceanHealth.coralHealth * projection.oceanHealth / 72)}.`}>
          <ResponsiveContainer width="55%" height={220}>
            <PieChart>
              <Pie data={healthPie} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={3}>
                {healthPie.map((h, i) => (
                  <Cell key={i} fill={h.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#0f2233", border: "1px solid #43d1ff55", borderRadius: 12, color: "#e6f4f1" }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex-1 space-y-2">
            {healthPie.map((h) => (
              <div key={h.name} className="text-xs">
                <div className="flex justify-between">
                  <span className="text-ocean-200/70">{h.name}</span>
                  <span className="font-semibold text-white">{h.value}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-abyss-800">
                  <div className="h-full rounded-full" style={{ width: `${h.value}%`, backgroundColor: h.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </section>
  );
}
