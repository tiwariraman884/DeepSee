"use client";

import { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import { oceanRegions } from "@/lib/regions";
import { useAppStore } from "@/store/useAppStore";

export type Region = (typeof oceanRegions)[number];

interface RegionContextValue {
  region: string;
  setRegion: (region: string) => void;
}

const RegionContext = createContext<RegionContextValue>({
  region: "Coral Triangle",
  setRegion: () => {},
});

const STORAGE_KEY = "deepsea-region";

export function RegionProvider({ children, defaultRegion = "Coral Triangle" }: { children: React.ReactNode; defaultRegion?: string }) {
  const appSetRegion = useAppStore((s) => s.setRegion);
  const [region, setRegionState] = useState(defaultRegion);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw && oceanRegions.includes(raw as Region)) {
        setRegionState(raw);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    appSetRegion(region);
  }, [region, appSetRegion]);

  const setRegion = useCallback((r: string) => {
    if (!oceanRegions.includes(r as Region)) return;
    setRegionState(r);
    try {
      localStorage.setItem(STORAGE_KEY, r);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ region, setRegion }), [region, setRegion]);

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>;
}

export function useRegion(): RegionContextValue {
  return useContext(RegionContext);
}
