"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function Slider({
  steps,
  value,
  onChange,
  className,
  ariaLabel = "Time range",
}: {
  steps: string[];
  value: number;
  onChange: (index: number) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const [fade, setFade] = useState(false);

  useEffect(() => {
    setFade(true);
    const t = setTimeout(() => setFade(false), 300);
    return () => clearTimeout(t);
  }, [value]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min(steps.length - 1, value + 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max(0, value - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(0);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(steps.length - 1);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="transition-opacity duration-300 focus-visible:ring-2 focus-visible:ring-accent/50 rounded-full"
        style={{ opacity: fade ? 0.35 : 1 }}
      >
        <div className="relative">
          <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-secondary" aria-hidden="true" />
          <div
            className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-accent transition-all duration-300"
            style={{ width: `${(value / (steps.length - 1)) * 100}%` }}
            aria-hidden="true"
          />
          <div className="relative flex justify-between">
            {steps.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange(i)}
                title={s}
                aria-label={s}
                aria-pressed={i === value}
                className="relative flex flex-col items-center focus:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-4 w-4 rounded-full border-2 transition-all duration-300",
                    i <= value ? "border-accent bg-accent" : "border-white/20 bg-secondary"
                  )}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="mt-2 flex justify-between" aria-hidden="true">
          {steps.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(i)}
              className={cn(
                "text-xs transition-colors focus:outline-none",
                i === value ? "font-semibold text-text-primary" : "text-text-muted hover:text-text-primary"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
