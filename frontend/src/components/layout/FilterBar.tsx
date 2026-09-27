"use client";

import { useState, type ReactNode } from "react";
import { RotateCcw, Filter, AlertTriangle, Globe, Calendar, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface FilterChip {
  value: string;
  label: string;
}

export function FilterBar({
  children,
  onReset,
  hasActiveFilters = false,
  resetLabel = "Reset",
  variant = "chips",
}: {
  children: ReactNode;
  onReset?: () => void;
  hasActiveFilters?: boolean;
  resetLabel?: string;
  variant?: "chips" | "toolbar";
}) {
  if (variant === "toolbar") {
    return (
      <div className="mb-4 rounded-xl border border-white/[0.08] bg-abyss-900/30 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {children}
          </div>
          {onReset && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onReset}
                aria-label={`Reset ${resetLabel.toLowerCase()} filters`}
                disabled={!hasActiveFilters}
                className="flex h-12 items-center gap-1.5 rounded-lg border border-accent/20 bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-accent/15 disabled:opacity-30"
              >
                <RotateCcw className="h-3.5 w-3.5" /> {resetLabel}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-ocean-500/10 bg-abyss-950/50 p-3">
      {children}
      {onReset && hasActiveFilters && (
        <button
          type="button"
          onClick={onReset}
          aria-label={`Reset ${resetLabel.toLowerCase()} filters`}
          className="ml-auto flex items-center gap-1 rounded-full border border-ocean-500/15 px-3 py-1 text-xs text-ocean-200/60 transition-colors hover:text-ocean-100"
        >
          <RotateCcw className="h-3 w-3" /> {resetLabel}
        </button>
      )}
    </div>
  );
}

export function FilterChips({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: FilterChip[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-ocean-200/60">{label}:</span>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={cn(
            "rounded-full border px-3 py-1 text-xs transition-colors",
            value === o.value
              ? "border-ocean-400 bg-ocean-500/20 text-ocean-100"
              : "border-ocean-500/15 text-ocean-200/60 hover:text-ocean-100"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

type SelectVariant = "type" | "severity" | "region" | "date";

const selectMeta: Record<SelectVariant, { icon: React.ReactNode; label: string }> = {
  type: { icon: <Filter className="h-4 w-4" />, label: "Type" },
  severity: { icon: <AlertTriangle className="h-4 w-4" />, label: "Severity" },
  region: { icon: <Globe className="h-4 w-4" />, label: "Region" },
  date: { icon: <Calendar className="h-4 w-4" />, label: "Date" },
};

export function FilterSelect({
  variant,
  value,
  onChange,
  options,
}: {
  variant: SelectVariant;
  value: string;
  onChange: (value: string) => void;
  options: FilterChip[];
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  const meta = selectMeta[variant];

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`filter-${variant}`} className="text-xs font-medium text-ocean-200/60">
        {meta.label}
      </label>
      <div className="relative">
        <select
          id={`filter-${variant}`}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(false);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          className={cn(
            "h-12 w-full appearance-none rounded-xl border border-white/[0.08] bg-abyss-900/80 pl-10 pr-10 text-sm text-ocean-100 outline-none transition-all duration-200 ease-out",
            "hover:border-white/20 focus:border-accent focus:ring-2 focus:ring-accent/20"
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ocean-200/60">
          {meta.icon}
        </span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ocean-200/60">
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.18 }}>
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.span>
        </span>
      </div>
    </div>
  );
}

export function FilterSearch({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="ml-auto flex items-center gap-2 rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-1.5">
      <SearchIcon />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-40 bg-transparent text-xs text-ocean-50 outline-none placeholder:text-ocean-200/40"
      />
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 text-ocean-200/50"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
