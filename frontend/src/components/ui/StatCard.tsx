import { isValidElement } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card } from "./Card";
import { CountUp } from "@/components/visuals/CountUp";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ColorVariant = "default" | "success" | "warning" | "danger";

const accents: Record<ColorVariant, string> = {
  default: "text-accent bg-accent/15",
  success: "text-success bg-success/15",
  warning: "text-warning bg-warning/15",
  danger: "text-danger bg-danger/15",
};

export function StatCard({
  title,
  value,
  icon,
  trend,
  color = "default",
  goodWhenUp = true,
  unit,
  status,
  className,
  index = 0,
}: {
  title: string;
  value: number | string;
  icon: LucideIcon | React.ReactNode;
  trend?: { direction: "up" | "down" | "flat"; percent: number };
  color?: ColorVariant;
  goodWhenUp?: boolean;
  unit?: string;
  status?: string;
  className?: string;
  index?: number;
}) {
  const numeric = typeof value === "number";
  const isIconElement = isValidElement(icon);
  const Icon = isIconElement ? null : (icon as LucideIcon);
  const iconNode = isIconElement ? (icon as React.ReactNode) : null;

  const trendColor = (() => {
    if (!trend || trend.direction === "flat") return "text-text-muted";
    const isUp = trend.direction === "up";
    const isGood = isUp ? goodWhenUp : !goodWhenUp;
    return isGood ? "text-success" : "text-danger";
  })();

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: (i: number) => ({
          opacity: 1,
          y: 0,
          transition: { delay: i * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] },
        }),
      }}
      custom={index}
      initial="hidden"
      animate="visible"
    >
      <Card
        className={cn(
          "group relative overflow-hidden !p-6 border border-white/[0.06] transition-all duration-200 ease-out hover:-translate-y-1 hover:shadow-glow-accent",
          className
        )}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        <div className="relative flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ocean-200/70">{title}</span>
            <div
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.06] backdrop-blur-sm bg-white/[0.03]",
                accents[color]
              )}
            >
              {Icon ? <Icon className="h-[18px] w-[18px]" /> : iconNode}
            </div>
          </div>
          <div className="text-5xl font-bold text-white tabular-nums tracking-tight">
            {numeric ? <CountUp end={value} duration={600} /> : value}
            {unit && <span className="ml-1.5 text-base font-medium text-ocean-200/50">{unit}</span>}
          </div>
          <div className="flex items-center">
            {trend ? (
              <span className={cn("flex items-center gap-1.5 text-xs font-medium", trendColor)}>
                {trend.direction === "up" ? (
                  <ArrowUpRight className="h-3.5 w-3.5" />
                ) : trend.direction === "down" ? (
                  <ArrowDownRight className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
                {trend.percent}%
              </span>
            ) : (
              status && <span className="text-xs text-ocean-200/50">{status}</span>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
