"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown } from "lucide-react";
import { useAlertsStore } from "@/store/useAlertsStore";
import { oceanRegions } from "@/lib/regions";
import { useAppStore } from "@/store/useAppStore";

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { User, Settings, ShieldAlert, LogOut } from "lucide-react";
import { UserProfileCard } from "@/components/profile/UserProfileCard";

function AlertBell({ onClick }: { onClick: () => void }) {
  const { unread, fetchAlerts } = useAlertsStore();
  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);
  return (
    <button
      onClick={onClick}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-ocean-500/15 text-ocean-200/70 hover:bg-ocean-500/10"
      aria-label="Alerts"
    >
      <Bell className="h-4 w-4" />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {unread}
        </span>
      )}
    </button>
  );
}

function RegionSelector() {
  const region = useAppStore((s) => s.selectedRegion);
  const setRegion = useAppStore((s) => s.setRegion);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg border border-ocean-500/15 px-3 py-1.5 text-xs text-ocean-200/80 hover:bg-ocean-500/10"
      >
        {region ?? "All Regions"}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-ocean-500/15 bg-abyss-950 p-1 shadow-xl">
          <button
            onClick={() => {
              setRegion(null);
              setOpen(false);
            }}
            className={cn(
              "block w-full rounded px-3 py-1.5 text-left text-xs text-ocean-200/70 hover:bg-ocean-500/10",
              !region && "text-ocean-100"
            )}
          >
            All Regions
          </button>
          {oceanRegions.map((r) => (
            <button
              key={r}
              onClick={() => {
                setRegion(r);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded px-3 py-1.5 text-left text-xs text-ocean-200/70 hover:bg-ocean-500/10",
                region === r && "text-ocean-100"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DateRange() {
  const [open, setOpen] = useState(false);
  const value = useAppStore((s) => s.dateRange);
  const setDateRange = useAppStore((s) => s.setDateRange);
  const ranges = ["Today", "Last 7 days", "Last 30 days", "Last 90 days", "Year to date"];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="hidden items-center gap-2 rounded-lg border border-ocean-500/15 px-3 py-1.5 text-xs text-ocean-200/80 hover:bg-ocean-500/10 sm:flex"
      >
        {value}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-40 rounded-lg border border-ocean-500/15 bg-abyss-950 p-1 shadow-xl">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => {
                setDateRange(r);
                setOpen(false);
              }}
              className={cn(
                "block w-full rounded px-3 py-1.5 text-left text-xs text-ocean-200/70 hover:bg-ocean-500/10",
                value === r && "text-ocean-100"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Topbar({
  title,
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-ocean-500/10 bg-abyss-950/70 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden bg-abyss-900/80 border border-ocean-500/20 transition-all group-hover:border-ocean-500/40">
            <Image
              src="/logo-icon.png"
              alt="DeepSea Guardian"
              width={32}
              height={32}
              className="object-contain"
            />
          </div>
          <span className="text-sm font-bold text-white">DeepSea Guardian</span>
        </Link>
        {title && (
          <>
            <span className="hidden text-ocean-200/30 sm:inline">/</span>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-white">{title}</h1>
              {subtitle && (
                <p className="text-[11px] text-ocean-200/60">{subtitle}</p>
              )}
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <RegionSelector />
        <DateRange />
        <AlertBell onClick={() => router.push("/alerts")} />
        <div className="hidden sm:block ml-2">
          <UserProfileCard />
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const items = [
    ["Dashboard", "/dashboard"],
    ["Map", "/map"],
    ["Pollution", "/pollution"],
    ["Species", "/species"],
    ["Risk", "/risk"],
    ["Drones", "/drones"],
    ["Alerts", "/alerts"],
    ["Reports", "/reports"],
    ["AI", "/assistant"],
    ["Innov.", "/innovation"],
    ["Profile", "/profile"],
    ["Settings", "/settings"],
    ["About", "/about"],
  ];
  return (
    <nav aria-label="Section navigation" className="flex gap-2 overflow-x-auto border-b border-ocean-500/10 bg-abyss-950/70 px-3 py-2 lg:hidden">
      {items.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          className="whitespace-nowrap rounded-full border border-ocean-500/15 px-3 py-1 text-xs text-ocean-200/70 hover:text-ocean-100"
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
