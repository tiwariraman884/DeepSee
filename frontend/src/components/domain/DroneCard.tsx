"use client";

import { memo } from "react";
import { Battery } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Drone, DroneStatus } from "@/types";

type CardStatus = "active" | "charging" | "offline";

const statusMap: Record<DroneStatus, CardStatus> = {
  active: "active",
  returning: "active",
  charging: "charging",
  idle: "active",
  offline: "offline",
};

const statusMeta: Record<CardStatus, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "text-success", dot: "bg-success" },
  charging: { label: "Charging", color: "text-warning", dot: "bg-warning" },
  offline: { label: "Offline", color: "text-danger", dot: "bg-danger" },
};

export const DroneCard = memo(function DroneCard({
  drone,
  lastMission,
}: {
  drone: Drone;
  lastMission?: string;
}) {
  const status: CardStatus = statusMap[drone.status];
  const meta = statusMeta[status];
  const offline = status === "offline";
  const batColor = drone.battery < 20 ? "#EF4444" : drone.battery < 50 ? "#F59E0B" : "#10B981";
  const mission = lastMission ?? drone.currentMission ?? "—";

  return (
    <div className={cn("glass rounded-card p-4 transition-all", offline && "cursor-not-allowed opacity-50 grayscale")}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-text-primary">{drone.name}</p>
          <p className={cn("text-xs", meta.color)}>
            <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-full", meta.dot)} />
            {meta.label}
          </p>
        </div>
        <Battery className="h-5 w-5" style={{ color: batColor }} />
      </div>
      <div className="mt-3">
        <div className="flex justify-between text-xs text-text-muted">
          <span>Battery</span>
          <span className="tabular-nums" style={{ color: batColor }}>
            {drone.battery}%
          </span>
        </div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${drone.battery}%`, backgroundColor: batColor }}
          />
        </div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <div>
          <p className="text-text-muted">Depth</p>
          <p className="font-semibold tabular-nums text-text-primary">{drone.depth}m</p>
        </div>
        <div>
          <p className="text-text-muted">Speed</p>
          <p className="font-semibold tabular-nums text-text-primary">{drone.speed}kn</p>
        </div>
        <div>
          <p className="text-text-muted">Last Mission</p>
          <p className="truncate font-semibold text-text-primary" title={mission}>
            {mission}
          </p>
        </div>
      </div>
    </div>
  );
});
