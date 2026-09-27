import { Loader2, Inbox, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingState({ label = "Loading ocean data…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-text-muted">
      <Loader2 className="h-8 w-8 animate-spin text-accent" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title = "No data available",
  message = title,
  description,
  icon: Icon = Inbox,
  actionLabel,
  onAction,
}: {
  title?: string;
  message?: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const heading = message ?? title;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-text-muted">
      {Icon && <Icon className="h-10 w-10 opacity-60" />}
      <p className="text-sm font-medium text-text-primary">{heading}</p>
      {description && <p className="max-w-xs text-xs text-text-muted">{description}</p>}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 rounded-control border border-white/10 px-4 py-1.5 text-xs text-text-primary hover:bg-white/5"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-danger">
      <AlertTriangle className="h-10 w-10" />
      <p className="text-sm">Something went wrong loading this data.</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-control border border-danger/30 bg-danger/10 px-4 py-1.5 text-sm text-danger hover:bg-danger/20"
        >
          Retry
        </button>
      )}
    </div>
  );
}

export function Skeleton({
  variant = "card",
  count = 1,
  className,
  height,
}: {
  variant?: "card" | "text" | "chart" | "table-row";
  count?: number;
  className?: string;
  height?: number;
}) {
  const base =
    variant === "text"
      ? "h-4 w-2/3 rounded"
      : variant === "chart"
      ? "w-full rounded-card"
      : variant === "table-row"
      ? "h-10 w-full rounded"
      : "h-24 w-full rounded-card";
  const chartHeight = variant === "chart" ? height ?? 192 : undefined;
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "relative overflow-hidden bg-secondary/60",
            base,
            className
          )}
          style={chartHeight ? { height: chartHeight } : undefined}
        >
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      ))}
    </>
  );
}
