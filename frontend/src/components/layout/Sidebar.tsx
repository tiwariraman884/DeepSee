"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  AlertTriangle,
  Fish,
  Brain,
  Bot,
  Radio,
  FileBarChart,
  Sparkles,
  Settings,
  Info,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfileCard } from "@/components/profile/UserProfileCard";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Ocean Map", icon: Map },
  { href: "/pollution", label: "Pollution", icon: AlertTriangle },
  { href: "/species", label: "Biodiversity", icon: Fish },
  { href: "/risk", label: "Risk Engine", icon: Brain },
  { href: "/drones", label: "Drone Center", icon: Radio },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/assistant", label: "AI Assistant", icon: Bot },
  { href: "/innovation", label: "Innovation", icon: Sparkles },
  { href: "/profile", label: "Profile", icon: User },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/about", label: "About", icon: Info },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-[72px] shrink-0 flex-col border-r border-ocean-500/10 bg-abyss-950/60 backdrop-blur lg:w-64">
      <div className="flex items-center gap-2 px-3 py-5 lg:px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl overflow-hidden bg-abyss-900/80 border border-ocean-500/20">
          <Image
            src="/logo-icon.png"
            alt="DeepSea Guardian"
            width={36}
            height={36}
            className="object-contain"
          />
        </div>
        <div className="hidden lg:block">
          <p className="text-sm font-bold text-white leading-tight">
            DeepSea Guardian
          </p>
          <p className="text-[10px] uppercase tracking-widest text-ocean-300/60">
            Mission Control
          </p>
        </div>
      </div>
      <nav aria-label="Primary" className="flex-1 space-y-1 px-2 py-2 lg:px-3">
        {nav.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:justify-center lg:justify-start",
                active
                  ? "bg-ocean-500/15 text-ocean-200"
                  : "text-ocean-200/60 hover:bg-ocean-500/5 hover:text-ocean-100"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="hidden p-4 lg:block">
        <div className="rounded-xl bg-ocean-500/10 p-3 text-xs text-ocean-200/70">
          <p className="font-semibold text-ocean-100">Live</p>
          <p className="mt-1">6 drones · 8 sensors streaming</p>
        </div>
      </div>
      <UserProfileCard />
    </aside>
  );
}
