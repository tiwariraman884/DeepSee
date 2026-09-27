"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type SubScores = {
  pollution: number;
  biodiversity: number;
  waterQuality: number;
  coralHealth: number;
};

const SVG_SIZE = 160;
const ARC = 270;
const START = 135;

function band(value: number) {
  if (value >= 75) return { color: "#10B981", label: "Healthy" };
  if (value >= 50) return { color: "#F59E0B", label: "Moderate" };
  return { color: "#EF4444", label: "At Risk" };
}

export function Gauge({
  value,
  size = 120,
  label = "Ocean Health",
  subScores,
  className,
}: {
  value: number;
  size?: number;
  label?: string;
  subScores?: SubScores;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);
  const [hover, setHover] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    if (started.current) return;
    started.current = true;
    const start = performance.now();
    const duration = 800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(value * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value, reduce]);

  const cx = SVG_SIZE / 2;
  const cy = SVG_SIZE / 2;
  const r = (SVG_SIZE - 16) / 2;
  const circ = 2 * Math.PI * r;
  const arcLen = (ARC / 360) * circ;
  const dash = (display / 100) * arcLen;
  const { color, label: bandLabel } = band(value);

  const pillars = subScores
    ? [
        { name: "Pollution", v: subScores.pollution },
        { name: "Biodiversity", v: subScores.biodiversity },
        { name: "Water Quality", v: subScores.waterQuality },
        { name: "Coral Health", v: subScores.coralHealth },
      ]
    : [];

  return (
    <div className={cn("relative flex flex-col items-center", className)}>
      <div
        className="relative w-full"
        style={{ maxWidth: size, aspectRatio: "1/1" }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <svg
          viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
          preserveAspectRatio="xMidYMid meet"
          className="h-full w-full transition-transform duration-200 ease-out group-hover:scale-[1.02]"
          style={{ transform: `rotate(${START}deg)` }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke="#1E293B"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${arcLen} ${circ}`}
          />
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            style={{ transition: "stroke 300ms ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <p className="text-[40px] font-bold tabular-nums leading-none transition-transform duration-200 ease-out group-hover:scale-[1.02]" style={{ color }}>
            {Math.round(display)}
          </p>
          <p className="mt-1 text-[13px] font-medium text-white">{label}</p>
          <span
            className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: `${color}20`, color }}
          >
            {bandLabel}
          </span>
        </div>
      </div>

      {hover && subScores && (
        <div className="absolute left-1/2 top-full z-10 mt-2 w-48 -translate-x-1/2 rounded-control border border-white/10 bg-secondary p-3 text-xs shadow-soft-xl">
          {pillars.map((p) => (
            <div key={p.name} className="mb-1.5 last:mb-0">
              <div className="flex justify-between text-text-muted">
                <span>{p.name}</span>
                <span className="font-semibold text-text-primary tabular-nums">{p.v}</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-primary">
                <div className="h-full rounded-full" style={{ width: `${p.v}%`, backgroundColor: band(p.v).color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const RadialScore = Gauge;
