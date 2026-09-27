"use client";

import { useState, useEffect, useCallback, useRef, createContext, useContext, useMemo } from "react";
import { settingsSchema, type Settings, type Profile, type Notifications } from "./schema";

const STORAGE_KEY = "deepsea-settings";

const DEFAULT_SETTINGS: Settings = {
  profile: {
    fullName: "Dr. Sarah",
    email: "sarah@ocean.org",
    organization: "Marine Research Lab",
    avatar: "",
  },
  notifications: {
    critical: true,
    weeklyDigest: true,
    droneUpdates: false,
    emergency: true,
    oceanHealth: false,
    speciesMonitoring: false,
    aiRecommendations: true,
    missionStatus: false,
    email: true,
    push: true,
    sms: false,
  },
  region: "Coral Triangle",
  theme: "dark",
};

function readSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return settingsSchema.parse(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SettingsContextValue {
  settings: Settings;
  status: SaveStatus;
  dirty: boolean;
  setDirty: (d: boolean) => void;
  updateProfile: (patch: Partial<Profile>) => Promise<boolean>;
  updateNotifications: (patch: Partial<Notifications>) => Promise<boolean>;
  updateRegion: (region: string) => Promise<boolean>;
  updateTheme: (theme: Settings["theme"]) => Promise<boolean>;
  reset: () => Promise<void>;
  cancel: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function persistToStorage(next: Settings): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

async function apiPatch(path: string, body: unknown): Promise<boolean> {
  try {
    const res = await fetch(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return true;
  } catch {
    return false;
  }
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [dirty, setDirty] = useState(false);
  const [original, setOriginal] = useState<Settings>(DEFAULT_SETTINGS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const stored = readSettings();
    setSettings(stored);
    setOriginal(stored);
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const updateStatus = useCallback((s: SaveStatus) => {
    if (!mountedRef.current) return;
    setStatus(s);
    if (s === "saved") {
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) setStatus("idle");
      }, 2000);
    }
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>): Promise<boolean> => {
      updateStatus("saving");
      const next = { ...settings, profile: { ...settings.profile, ...patch } };
      const ok = await apiPatch("/api/settings", { profile: patch });
      if (ok) {
        persistToStorage(next);
        setSettings(next);
        setOriginal(next);
        setDirty(false);
        updateStatus("saved");
        return true;
      }
      updateStatus("error");
      return false;
    },
    [settings, updateStatus]
  );

  const updateNotifications = useCallback(
    async (patch: Partial<Notifications>): Promise<boolean> => {
      updateStatus("saving");
      const next = { ...settings, notifications: { ...settings.notifications, ...patch } };
      const ok = await apiPatch("/api/settings", { notifications: patch });
      if (ok) {
        persistToStorage(next);
        setSettings(next);
        setOriginal(next);
        setDirty(false);
        updateStatus("saved");
        return true;
      }
      updateStatus("error");
      return false;
    },
    [settings, updateStatus]
  );

  const updateRegion = useCallback(
    async (region: string): Promise<boolean> => {
      updateStatus("saving");
      const next = { ...settings, region };
      const ok = await apiPatch("/api/settings", { region });
      if (ok) {
        persistToStorage(next);
        setSettings(next);
        setOriginal(next);
        setDirty(false);
        updateStatus("saved");
        return true;
      }
      updateStatus("error");
      return false;
    },
    [settings, updateStatus]
  );

  const updateTheme = useCallback(
    async (theme: Settings["theme"]): Promise<boolean> => {
      updateStatus("saving");
      const next = { ...settings, theme };
      const ok = await apiPatch("/api/settings", { theme });
      if (ok) {
        persistToStorage(next);
        setSettings(next);
        setOriginal(next);
        setDirty(false);
        updateStatus("saved");
        return true;
      }
      updateStatus("error");
      return false;
    },
    [settings, updateStatus]
  );

  const reset = useCallback(async () => {
    updateStatus("saving");
    const next = DEFAULT_SETTINGS;
    persistToStorage(next);
    setSettings(next);
    setOriginal(next);
    setDirty(false);
    updateStatus("saved");
  }, [updateStatus]);

  const cancel = useCallback(() => {
    setSettings(original);
    setDirty(false);
  }, [original]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      settings,
      status,
      dirty,
      setDirty,
      updateProfile,
      updateNotifications,
      updateRegion,
      updateTheme,
      reset,
      cancel,
    }),
    [settings, status, dirty, updateProfile, updateNotifications, updateRegion, updateTheme, reset, cancel]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
