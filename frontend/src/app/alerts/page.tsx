"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Bell, CheckCircle2, Info, ShieldAlert, RotateCcw } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { alertMeta } from "@/lib/constants";
import { relativeTime, cn } from "@/lib/utils";
import { EmptyState, LoadingState } from "@/components/ui/States";
import type { Alert, AlertType } from "@/types";


const filters: { value: AlertType | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "warning", label: "Warning" },
  { value: "info", label: "Info" },
];

const icons: Record<string, React.ReactNode> = {
  critical: <ShieldAlert className="h-4 w-4" />,
  warning: <AlertTriangle className="h-4 w-4" />,
  info: <Info className="h-4 w-4" />,
};

export default function AlertsPage() {
  const [filter, setFilter] = useState<AlertType | "all">("all");
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/alerts?limit=100")
      .then((r) => r.json())
      .then((d) => setAlerts(d.alerts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const list = alerts.filter((a) => filter === "all" || a.type === filter);
  const open = alerts.filter((a) => !a.resolved).length;

  const resetFilters = () => setFilter("all");

  return (
    <DashboardShell title="Alerts & Notifications" subtitle={`${open} open · ${alerts.length} total`}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              filter === f.value
                ? "border-ocean-400 bg-ocean-500/20 text-ocean-100"
                : "border-ocean-500/15 text-ocean-200/60 hover:text-ocean-100"
            )}
          >
            {f.label}
          </button>
        ))}
        {filter !== "all" && (
          <button
            onClick={resetFilters}
            aria-label="Reset alert filters"
            className="ml-auto flex items-center gap-1 rounded-full border border-ocean-500/15 px-3 py-1.5 text-xs text-ocean-200/60 transition-colors hover:text-ocean-100"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </div>

      <div className="sr-only" role="status" aria-live="polite">
        {list.length} alert{list.length === 1 ? "" : "s"} shown.
      </div>

      {loading ? (
        <div className="space-y-3 lg:col-span-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-card bg-secondary/60" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          title="No alerts match this filter."
          description="All other categories are clear. Reset to view the full alert stream."
          actionLabel="Reset Filters"
          onAction={resetFilters}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-3 lg:col-span-2">
            {list.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className={cn("border", alertMeta[a.type].bg)}>
                  <div className="flex items-start gap-3">
                    <div className={cn("mt-0.5", alertMeta[a.type].color)}>
                      {icons[a.type]}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className={cn("text-sm font-semibold", alertMeta[a.type].color)}>
                          {a.message.split(" — ")[0]}
                        </p>
                        <span className="text-xs text-ocean-200/50">{relativeTime(a.timestamp)}</span>
                      </div>
                      <p className="mt-1 text-sm text-ocean-200/70">{a.message.split(" — ").slice(1).join(" — ") || a.message}</p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-ocean-200/50">{a.location}</span>
                        {a.resolved ? (
                          <span className="flex items-center gap-1 text-xs text-biolum-400">
                            <CheckCircle2 className="h-3 w-3" /> Resolved
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-amber-300">
                            <Bell className="h-3 w-3" /> Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
          <Card>
            <CardHeader title="Alert Center" icon={<Bell className="h-4 w-4" />} />
            <div className="space-y-3">
              {(["critical", "warning", "info"] as const).map((t) => {
                const count = alerts.filter((a) => a.type === t && !a.resolved).length;
                return (
                  <div key={t} className={cn("rounded-lg border p-3", alertMeta[t].bg)}>
                    <div className="flex items-center justify-between">
                      <span className={cn("flex items-center gap-2 text-sm font-medium", alertMeta[t].color)}>
                        {icons[t]} {alertMeta[t].label}
                      </span>
                      <span className="text-lg font-bold text-white">{count}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
