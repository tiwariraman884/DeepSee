"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  AlertTriangle,
  Fish,
  Radio,
  MoreHorizontal,
  Map,
  Brain,
  FileBarChart,
  Bot,
  Sparkles,
  Settings,
  Info,
  X,
  Cpu,
} from "lucide-react";
import { cn } from "@/lib/utils";

const primary = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/pollution", label: "Pollution", icon: AlertTriangle },
  { href: "/species", label: "Species", icon: Fish },
  { href: "/drones", label: "Drones", icon: Radio },
];

const more = [
  { href: "/ai-center", label: "AI Center", icon: Cpu },
  { href: "/map", label: "Ocean Map", icon: Map },
  { href: "/risk", label: "Risk Engine", icon: Brain },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/innovation", label: "Innovation", icon: Sparkles },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/about", label: "About", icon: Info },
];

export function BottomTabBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* More menu overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute bottom-16 left-2 right-2 rounded-2xl border border-ocean-500/15 bg-abyss-950 p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-ocean-200/60">
                All sections
              </p>
              <button onClick={() => setOpen(false)} className="text-ocean-200/60">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {more.map((m) => {
                const Icon = m.icon;
                return (
                  <Link
                    key={m.href}
                    href={m.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm",
                      isActive(m.href)
                        ? "bg-ocean-500/15 text-ocean-200"
                        : "text-ocean-200/70 hover:bg-ocean-500/10"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {m.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar — mobile only (<640px) */}
      <nav aria-label="Primary mobile" className="fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-ocean-500/10 bg-abyss-950/95 backdrop-blur sm:hidden">
        {primary.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium",
                active ? "text-ocean-200" : "text-ocean-200/55"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "text-ocean-300")} />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium",
            open ? "text-ocean-200" : "text-ocean-200/55"
          )}
        >
          <MoreHorizontal className={cn("h-5 w-5", open && "text-ocean-300")} />
          More
        </button>
      </nav>
    </>
  );
}
