"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { oceanHealth } from "@/data/metrics";
import { scoreColor } from "@/lib/constants";
import { Sparkline } from "@/components/visuals/Sparkline";
import { AnimatedNumber } from "@/components/visuals/AnimatedNumber";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { sensors } from "@/data/sensors.json";

function deterministicJitter(base: number, idx: number, amp = 0.15): number {
  return +(base + Math.sin(idx * 1.3 + base) * amp).toFixed(1);
}

const PILLARS = [
  { key: "waterQuality", label: "Water Quality", color: "#43d1ff", unit: "" },
  { key: "coralHealth", label: "Coral Health", color: "#ff8a65", unit: "" },
  { key: "biodiversity", label: "Marine Life", color: "#22e6a3", unit: "" },
  { key: "pollution", label: "Pollution", color: "#ff7043", unit: "" },
  { key: "oxygen", label: "Oxygen", color: "#38bdf8", unit: " mg/L" },
  { key: "temperature", label: "Temperature", color: "#fbbf24", unit: " °C" },
] as const;

const BASE_SERIES: Record<string, number[]> = {
  waterQuality: [82, 83, 81, 80, 79, 81],
  coralHealth: [68, 65, 62, 60, 58, 64],
  biodiversity: [72, 70, 68, 66, 65, 70],
  pollution: [40, 42, 45, 48, 50, 46],
  oxygen: [5.8, 5.7, 5.6, 5.5, 5.4, 5.6],
  temperature: [28.2, 28.4, 28.6, 28.8, 29.0, 28.7],
};

function avgTemp(): number {
  const temps = sensors.filter((s) => s.type === "temperature" && s.lastReading.temp).map((s) => s.lastReading.temp as number);
  return temps.length ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : 28.5;
}

function avgOxygen(): number {
  const oxs = sensors.filter((s) => s.type === "oxygen" && s.lastReading.oxygen).map((s) => s.lastReading.oxygen as number);
  return oxs.length ? Math.round((oxs.reduce((a, b) => a + b, 0) / oxs.length) * 10) / 10 : 5.5;
}

function gaugeStroke(score: number): string {
  if (score >= 75) return "#34d399";
  if (score >= 50) return "#fbbf24";
  return "#fb7185";
}

function TrendGlyph({ value }: { value: number }) {
  if (value > 0) return <ArrowUpRight className="h-3 w-3" aria-hidden="true" />;
  if (value < 0) return <ArrowDownRight className="h-3 w-3" aria-hidden="true" />;
  return <Minus className="h-3 w-3" aria-hidden="true" />;
}

export function OceanHealth() {
  const overall = oceanHealth.overall;
  const circumference = 2 * Math.PI * 54;
  const dash = (overall / 100) * circumference;
  const tempVal = avgTemp();
  const oxVal = avgOxygen();

  const metrics = useMemo(
    () => ({
      waterQuality: oceanHealth.waterQuality,
      coralHealth: oceanHealth.coralHealth,
      biodiversity: oceanHealth.biodiversity,
      pollution: oceanHealth.pollution,
      oxygen: oxVal,
      temperature: tempVal,
    }),
    [oxVal, tempVal]
  );

  const series = useMemo(() => {
    const out: Record<string, number[]> = { ...BASE_SERIES };
    out.oxygen = out.oxygen.map((v, i) => deterministicJitter(v, i, 0.15));
    out.temperature = out.temperature.map((v, i) => deterministicJitter(v, i + 10, 0.2));
    return out;
  }, []);

  return (
    <div className="flex flex-col items-center">
      <div className="relative flex h-44 w-44 items-center justify-center">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#0f2233" strokeWidth="10" />
          <motion.circle
            cx={60}
            cy={60}
            r={54}
            fill="none"
            stroke={gaugeStroke(overall)}
            strokeWidth="10"
            strokeLinecap="round"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dash }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            strokeDasharray={circumference}
          />
        </svg>
        <div className="absolute text-center">
          <AnimatedNumber value={overall} className={`text-5xl font-bold ${scoreColor(overall)}`} />
          <p className="text-[10px] uppercase tracking-wide text-ocean-200/60">Health Index</p>
        </div>
      </div>

      <div className="mt-5 grid w-full grid-cols-2 gap-2">
        {PILLARS.map((p) => {
          const raw = metrics[p.key];
          const seriesData = series[p.key];
          const isPollution = p.key === "pollution";
          const change = seriesData.length >= 2 ? +(seriesData[seriesData.length - 1] - seriesData[0]).toFixed(1) : 0;
          const good = isPollution ? change < 0 : change > 0;
          const displayValue = typeof raw === "number" ? (p.unit === " °C" || p.unit === " mg/L" ? raw.toFixed(1) : Math.round(raw)) : raw;
          const barWidth = typeof raw === "number" ? Math.max(0, Math.min(100, raw)) : 0;
          const barColor = p.color;

          return (
            <div key={p.key} className="rounded-lg bg-abyss-950/60 p-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-ocean-200/70">{p.label}</span>
                <span className="font-semibold" style={{ color: barColor }}>
                  {displayValue}
                  {p.unit && <span className="ml-0.5 text-[10px] text-ocean-200/60">{p.unit}</span>}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-abyss-800">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${barWidth}%`, backgroundColor: barColor }} />
              </div>
              <div className="mt-1 flex items-center justify-between">
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${good ? "text-emerald-300" : "text-rose-300"}`}>
                  <TrendGlyph value={isPollution ? -change : change} />
                  {Math.abs(change).toFixed(1)}%
                </span>
                <Sparkline data={seriesData} color={barColor} width={48} height={18} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
