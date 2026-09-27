"use client";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export function RiskChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff7043" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#ff7043" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" tick={{ fill: "#7fb0cd", fontSize: 10 }} />
        <YAxis tick={{ fill: "#7fb0cd", fontSize: 10 }} domain={[30, 90]} />
        <Tooltip
          contentStyle={{ background: "#0f2233", border: "1px solid #43d1ff55", borderRadius: 12, color: "#e6f4f1" }}
        />
        <Area type="monotone" dataKey="upper" stroke="none" fill="url(#band)" />
        <Area type="monotone" dataKey="lower" stroke="none" fill="#0b1722" />
        <ReferenceLine y={70} stroke="#7cffcb" strokeDasharray="4 4" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
