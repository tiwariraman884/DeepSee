"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { ZoomIn, ZoomOut, Navigation, Radio, Waves, Thermometer, Activity } from "lucide-react";

const LAYERS = [
  { name: "Surface", depth: "0–200 m", health: 88, color: "#43d1ff" },
  { name: "Sunlight", depth: "200–1 000 m", health: 74, color: "#22e6a3" },
  { name: "Twilight", depth: "1 000–4 000 m", health: 61, color: "#0bb487" },
  { name: "Midnight", depth: "4 000–6 000 m", health: 52, color: "#0692c4" },
  { name: "Abyss", depth: "6 000+ m", health: 47, color: "#124e6c" },
];

const SENSOR_NODES = [
  { layer: 0, angle: 20, id: "SN-01" },
  { layer: 1, angle: 75, id: "SN-02" },
  { layer: 2, angle: 140, id: "SN-03" },
  { layer: 3, angle: 210, id: "SN-04" },
  { layer: 4, angle: 290, id: "SN-05" },
  { layer: 1, angle: 320, id: "SN-06" },
];

const DRONES = [
  { layer: 0, angle: 45, label: "ReefGuard-01" },
  { layer: 2, angle: 170, label: "AbyssScan-04" },
  { layer: 4, angle: 260, label: "DeepCore-09" },
];

const POLLUTION = [
  { layer: 0, angle: 90, label: "Mediterranean" },
  { layer: 0, angle: 250, label: "N. Pacific Gyre" },
];

const BIODIVERSITY = [
  { layer: 1, angle: 120, label: "Coral Triangle" },
  { layer: 3, angle: 310, label: "Sargasso Sea" },
];

function polar(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

const SVG_SIZE = 260;
const CX = 130;
const CY = 130;
const BASE_R = 110;

export function DigitalTwin() {
  const [zoom, setZoom] = useState(1);
  const [activeLayer, setActiveLayer] = useState<number | null>(null);

  return (
    <div className="relative flex flex-col">
      {/* visualization area — clipped, responsive */}
      <div
        className="relative w-full overflow-hidden rounded-card bg-abyss-950/40"
        style={{ aspectRatio: "1 / 1", maxHeight: 320 }}
      >
        {/* floating metrics */}
        <div className="absolute left-2 top-2 z-10 space-y-1 rounded-lg border border-white/10 bg-abyss-950/80 p-2 text-[10px] backdrop-blur-sm">
          {[
            { icon: <Navigation className="h-3 w-3" />, label: "Depth", value: "4 200 m" },
            { icon: <Activity className="h-3 w-3" />, label: "AI Confidence", value: "96.3%" },
            { icon: <Radio className="h-3 w-3" />, label: "Sensors Active", value: "12 / 14" },
            { icon: <Waves className="h-3 w-3" />, label: "Current Speed", value: "0.4 m/s" },
            { icon: <Thermometer className="h-3 w-3" />, label: "Temperature", value: "12.4 °C" },
            { icon: <Activity className="h-3 w-3" />, label: "Acoustic", value: "Low" },
          ].map((m) => (
            <div key={m.label} className="flex items-center gap-1 text-ocean-200/80">
              <span className="text-accent">{m.icon}</span>
              <span className="text-ocean-200/60">{m.label}</span>
              <span className="ml-auto font-medium text-text-primary">{m.value}</span>
            </div>
          ))}
        </div>

        {/* zoom controls */}
        <div className="absolute right-2 top-2 z-10 flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.3, +(z + 0.1).toFixed(2)))}
            aria-label="Zoom in"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-abyss-950/80 text-ocean-100 backdrop-blur-sm hover:bg-white/10"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.9, +(z - 0.1).toFixed(2)))}
            aria-label="Zoom out"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 bg-abyss-950/80 text-ocean-100 backdrop-blur-sm hover:bg-white/10"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* radar visualization — scales to container, clipped by parent overflow:hidden */}
        <motion.div
          animate={{ scale: zoom }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="absolute inset-0 flex items-center justify-center"
        >
          <svg
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="h-full w-full"
            preserveAspectRatio="xMidYMid meet"
            aria-hidden="true"
          >
            <defs>
              <radialGradient id="twin-grad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.1} />
                <stop offset="100%" stopColor="#0F172A" stopOpacity={0} />
              </radialGradient>
            </defs>

            {/* background glow */}
            <circle cx={CX} cy={CY} r={BASE_R + 10} fill="url(#twin-grad)" />

            {/* depth layers */}
            {LAYERS.map((l, i) => {
              const r = BASE_R * (1 - i * 0.18);
              return (
                <g key={l.name}>
                  <circle
                    cx={CX}
                    cy={CY}
                    r={r}
                    fill="none"
                    stroke={l.color}
                    strokeOpacity={0.25}
                    strokeWidth={1}
                  />
                  {/* current arc */}
                  <path
                    d={`M ${CX + r * Math.cos(-Math.PI / 2)} ${CY + r * Math.sin(-Math.PI / 2)} A ${r} ${r} 0 0 1 ${CX + r * Math.cos(Math.PI / 4)} ${CY + r * Math.sin(Math.PI / 4)}`}
                    fill="none"
                    stroke={l.color}
                    strokeOpacity={0.7}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

            {/* sensors */}
            {SENSOR_NODES.map((s) => {
              const r = BASE_R * (1 - s.layer * 0.18);
              const p = polar(CX, CY, r, s.angle);
              return (
                <g key={s.id}>
                  <circle cx={p.x} cy={p.y} r={3} fill="#34d399" />
                  <title>{s.id}</title>
                </g>
              );
            })}

            {/* drones */}
            {DRONES.map((d) => {
              const r = BASE_R * (1 - d.layer * 0.18);
              const p = polar(CX, CY, r, d.angle);
              return (
                <g key={d.label}>
                  <circle cx={p.x} cy={p.y} r={4} fill="#0EA5E9" stroke="#0F172A" strokeWidth={1.5} />
                  <title>{d.label}</title>
                </g>
              );
            })}

            {/* pollution */}
            {POLLUTION.map((p) => {
              const r = BASE_R * (1 - p.layer * 0.18);
              const pos = polar(CX, CY, r, p.angle);
              return (
                <g key={p.label}>
                  <circle cx={pos.x} cy={pos.y} r={5} fill="#EF4444" opacity={0.9} />
                  <circle cx={pos.x} cy={pos.y} r={8} fill="#EF4444" opacity={0.25}>
                    <animate attributeName="r" values="5;10;5" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0;0.4" dur="2.5s" repeatCount="indefinite" />
                  </circle>
                  <title>{p.label}</title>
                </g>
              );
            })}

            {/* biodiversity */}
            {BIODIVERSITY.map((b) => {
              const r = BASE_R * (1 - b.layer * 0.18);
              const pos = polar(CX, CY, r, b.angle);
              return (
                <g key={b.label}>
                  <circle cx={pos.x} cy={pos.y} r={5} fill="#10B981" />
                  <title>{b.label}</title>
                </g>
              );
            })}
          </svg>

          {/* sonar rings — clipped by parent overflow:hidden */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`sonar-${i}`}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/20"
              animate={{ scale: [0.4, 1.4], opacity: [0.6, 0] }}
              transition={{ duration: 4 + i, repeat: Infinity, ease: "linear", delay: i * 1.3 }}
              style={{ width: BASE_R * 1.4, height: BASE_R * 1.4 }}
            />
          ))}

          {/* AI scan pulse */}
          <motion.div
            className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent"
            animate={{ scale: [1, 2, 1], opacity: [0.9, 0.2, 0.9] }}
            transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>

      {/* layer legend — outside clipped area */}
      <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[10px]">
        {LAYERS.map((l, idx) => (
          <button
            key={l.name}
            type="button"
            onClick={() => setActiveLayer((current) => (current === idx ? null : idx))}
            className={`rounded-md border p-1 transition-colors ${
              activeLayer === idx
                ? "border-accent/40 bg-accent/10"
                : "border-white/5 bg-abyss-950/60 hover:bg-white/5"
            }`}
          >
            <p className="truncate font-medium text-text-primary">{l.name}</p>
            <p className="text-ocean-300/60">{l.depth}</p>
            <p className="text-biolum-400">{l.health}</p>
          </button>
        ))}
      </div>

      {/* legend chips */}
      <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-text-muted">
        {[
          { color: "#34d399", label: "Sensor" },
          { color: "#0EA5E9", label: "Drone" },
          { color: "#EF4444", label: "Pollution" },
          { color: "#10B981", label: "Biodiversity" },
        ].map((l) => (
          <span key={l.label} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
            {l.label}
          </span>
        ))}
      </div>
    </div>
  );
}
