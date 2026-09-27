"use client";

import { cn } from "@/lib/utils";

export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  let strength = 0;
  if (password.length >= 8) strength++;
  if (/[A-Z]/.test(password)) strength++;
  if (/[0-9]/.test(password)) strength++;
  if (/[^A-Za-z0-9]/.test(password)) strength++;

  const colors = ["", "bg-rose-500", "bg-amber-500", "bg-emerald-400", "bg-emerald-500"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"];

  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <div className="flex flex-1 gap-1">
        {[1, 2, 3, 4].map((level) => (
          <div
            key={level}
            className={cn("h-1 flex-1 rounded-full transition-colors duration-300", level <= strength ? colors[strength] : "bg-white/10")}
          />
        ))}
      </div>
      <span className="text-[10px] uppercase tracking-wider text-white/40">{labels[strength]}</span>
    </div>
  );
}
