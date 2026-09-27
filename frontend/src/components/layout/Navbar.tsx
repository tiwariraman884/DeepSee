"use client";

import { useState } from "react";
import Link from "next/link";
import { Waves, Menu, X } from "lucide-react";

export function Navbar({
  showAuth = true,
}: {
  showAuth?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/20 text-accent">
            <Waves className="h-5 w-5" />
          </div>
          <span className="text-lg font-bold text-text-primary">DeepSea Guardian</span>
        </Link>
        <nav className="hidden gap-8 text-sm text-text-muted md:flex">
          <a href="#features" className="hover:text-text-primary">Features</a>
          <a href="#innovation" className="hover:text-text-primary">Innovation</a>
          <a href="#impact" className="hover:text-text-primary">Impact</a>
        </nav>
        <div className="flex items-center gap-3">
          {showAuth && (
            <>
              <Link href="/login" className="hidden text-sm text-text-muted hover:text-text-primary sm:block">
                Login
              </Link>
              <Link
                href="/signup"
                className="hidden rounded-control border border-white/10 px-4 py-2 text-sm font-medium text-text-primary hover:bg-white/5 sm:block"
              >
                Sign Up
              </Link>
              <Link
                href="/dashboard"
                className="rounded-control bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-600"
              >
                Launch
              </Link>
            </>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            aria-label="Toggle menu"
            className="flex h-9 w-9 items-center justify-center rounded-control border border-white/10 text-text-primary md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>
      {open && (
        <div className="mx-auto max-w-7xl px-6 md:hidden">
          <div className="flex flex-col gap-1 rounded-control border border-white/10 bg-secondary/95 p-3 backdrop-blur">
            <a href="#features" onClick={() => setOpen(false)} className="rounded px-3 py-2 text-sm text-text-muted hover:bg-white/5 hover:text-text-primary">Features</a>
            <a href="#innovation" onClick={() => setOpen(false)} className="rounded px-3 py-2 text-sm text-text-muted hover:bg-white/5 hover:text-text-primary">Innovation</a>
            <a href="#impact" onClick={() => setOpen(false)} className="rounded px-3 py-2 text-sm text-text-muted hover:bg-white/5 hover:text-text-primary">Impact</a>
          </div>
        </div>
      )}
    </header>
  );
}
