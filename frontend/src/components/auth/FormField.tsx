"use client";

import { cn } from "@/lib/utils";

export function FormField({
  id,
  label,
  type = "text",
  value,
  onChange,
  onClear,
  error,
  placeholder,
  autoComplete,
  disabled,
  maxLength,
  children,
  right,
}: {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  error?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  maxLength?: number;
  children?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-ocean-200/60">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          maxLength={maxLength}
          className={cn(
            "w-full rounded-xl border bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none transition-all focus:border-ocean-400",
            error ? "border-rose-500/60 focus:border-rose-500" : "border-ocean-500/15"
          )}
        />
        {right && <div className="absolute right-2 top-1/2 -translate-y-1/2">{right}</div>}
      </div>
      {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
      {children}
    </div>
  );
}
