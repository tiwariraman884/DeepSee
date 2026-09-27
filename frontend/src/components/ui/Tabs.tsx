"use client";

import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export function Tabs({
  items,
  active,
  onChange,
  className,
}: {
  items: TabItem[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]", className)}>
      {items.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-control border px-3 py-1.5 text-sm transition-colors",
            active === t.id
              ? "border-accent bg-accent/20 text-text-primary"
              : "border-white/10 text-text-muted hover:text-text-primary"
          )}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
