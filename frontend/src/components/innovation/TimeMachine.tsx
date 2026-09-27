"use client";

import { useAppStore } from "@/store/useAppStore";
import { Slider } from "@/components/ui/Slider";
import { AnimatedNumber } from "@/components/visuals/AnimatedNumber";
import { cn } from "@/lib/utils";
import {
  getMetricProjection,
  confidenceForHorizon,
  HORIZON_ORDER,
  HORIZON_LABELS,
} from "@/lib/innovation-projections";
import type { TimeHorizon } from "@/types";

const horizons = HORIZON_ORDER.map((h) => ({ value: h, label: HORIZON_LABELS[h] }));

function DeltaRow({
  label,
  value,
  unit,
  decimals = 0,
  lowerIsBetter = true,
}: {
  label: string;
  value: number;
  unit?: string;
  decimals?: number;
  lowerIsBetter?: boolean;
}) {
  const positive = value >= 0;
  const good = lowerIsBetter ? !positive : positive;
  const Arrow = positive ? "▲" : "▼";
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-text-muted">{label}</span>
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium tabular-nums",
          good ? "text-emerald-300" : "text-rose-300"
        )}
      >
        <span aria-hidden="true">{Arrow}</span>
        <AnimatedNumber value={Math.abs(value)} decimals={decimals} suffix={unit} />
      </span>
    </div>
  );
}

export function TimeMachine() {
  const horizon = useAppStore((s) => s.timeHorizon);
  const setHorizon = useAppStore((s) => s.setTimeHorizon);
  const index = HORIZON_ORDER.indexOf(horizon);
  const p = getMetricProjection(horizon);
  const confidence = confidenceForHorizon(horizon);
  const isAction = horizon === "5y";

  return (
    <div>
      <Slider
        steps={horizons.map((h) => h.label)}
        value={index}
        onChange={(i) => setHorizon(HORIZON_ORDER[i] as TimeHorizon)}
      />

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-text-muted">
            {isAction ? "With Action" : "Projected"} Ocean Health
          </p>
          <div className="flex items-baseline gap-1">
            <AnimatedNumber
              value={p.oceanHealth}
              className={cn(
                "text-5xl font-bold tabular-nums",
                p.oceanHealth >= 70 ? "text-success" : p.oceanHealth >= 60 ? "text-warning" : "text-danger"
              )}
            />
            <span className="text-lg text-text-muted">/100</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                p.oceanHealth >= 70 ? "bg-success" : p.oceanHealth >= 60 ? "bg-warning" : "bg-danger"
              )}
              style={{ width: `${p.oceanHealth}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col justify-center rounded-control border border-white/5 bg-white/[0.03] p-3">
          <p className="text-[11px] uppercase tracking-wide text-text-muted">Prediction Confidence</p>
          <AnimatedNumber
            value={confidence}
            decimals={1}
            suffix="%"
            className="text-3xl font-bold tabular-nums text-accent"
          />
          <p className="mt-1 text-[11px] text-text-muted">
            {isAction ? "Intervention scenario" : "Trend extrapolation"}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-1.5 rounded-control border border-white/5 bg-white/[0.02] p-3">
        <DeltaRow label="Pollution Index" value={p.pollution - 58} />
        <DeltaRow label="Species Tracked" value={p.species - 148} />
        <DeltaRow label="Risk Score" value={p.risk - 47} />
        <DeltaRow label="Coral Health" value={p.coralHealth - 64} />
        <DeltaRow label="Temp. Anomaly" value={Math.round((p.temperature - 1.4) * 10) / 10} unit="°C" decimals={1} />
      </div>
    </div>
  );
}
