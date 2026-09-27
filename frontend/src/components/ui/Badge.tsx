import { cn } from "@/lib/utils";

type Variant = "success" | "warning" | "danger" | "neutral" | "info";

const variants: Record<Variant, string> = {
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/30 bg-warning/10 text-warning",
  danger: "border-danger/30 bg-danger/10 text-danger",
  info: "border-accent/30 bg-accent/10 text-accent",
  neutral: "border-white/10 bg-white/5 text-text-muted",
};

export function Badge({
  label,
  variant = "neutral",
  className,
}: {
  label: string;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {label}
    </span>
  );
}
