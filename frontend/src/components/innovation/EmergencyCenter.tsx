"use client";

import { motion } from "framer-motion";
import { alerts } from "@/data/alerts.json";
import { alertMeta } from "@/lib/constants";
import { Eye, CheckCircle2, ExternalLink, Send } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

function entityLabel(alert: typeof alerts[number]): string {
  const id = alert.relatedEntity ?? "";
  if (id.startsWith("sp-")) return `Species ${id}`;
  if (id.startsWith("poll_")) return `Pollution ${id}`;
  if (id.startsWith("drone_")) return `Drone ${id}`;
  return id || "—";
}

function confidenceFor(type: typeof alerts[number]["type"]): number {
  return type === "critical" ? 95 : type === "warning" ? 82 : 62;
}

const FIXED_NOW = 175_296_000_000; // deterministic reference ~2026-07-19

function timeAgo(ts: string) {
  const diff = FIXED_NOW - new Date(ts).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function EmergencyCenter() {
  const unresolved = alerts.filter((a) => !a.resolved).slice(0, 4);

  return (
    <div className="space-y-2">
      {unresolved.length === 0 && (
        <p className="py-4 text-center text-xs text-text-muted">No active emergency alerts.</p>
      )}
      {unresolved.map((a, i) => {
        const meta = alertMeta[a.type];
        const conf = confidenceFor(a.type);
        return (
          <motion.div
            key={a.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className="flex flex-col gap-2 rounded-lg border border-white/5 bg-white/[0.02] p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-start gap-2.5">
              <span className={`mt-0.5 inline-flex h-2 w-2 shrink-0 rounded-full ${meta.bg.split(" ")[0]}`} style={{ backgroundColor: meta.color.replace("text-", "") }} />
              <div>
                <p className="text-sm font-medium text-text-primary line-clamp-1">{a.message}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
                  <span>{a.location}</span>
                  <span>{timeAgo(a.timestamp)}</span>
                  <span>{conf}% AI conf.</span>
                  <span className="text-ocean-200/50">{entityLabel(a)}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:ml-2">
              <QuickAction icon={<Eye className="h-3.5 w-3.5" />} label="View" />
              <QuickAction icon={<Send className="h-3.5 w-3.5" />} label="Dispatch" />
              <QuickAction icon={<CheckCircle2 className="h-3.5 w-3.5" />} label="Resolve" accent />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function QuickAction({ icon, label, accent }: { icon: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <button
      type="button"
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
        accent
          ? "border-biolum-500/30 bg-biolum-500/10 text-biolum-300 hover:bg-biolum-500/20"
          : "border-white/10 text-ocean-200/80 hover:bg-white/5"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
