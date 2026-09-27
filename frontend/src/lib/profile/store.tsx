"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Profile } from "@/lib/settings/schema";
import { useAuthStore } from "@/store/useAuthStore";

const STORAGE_KEY = "deepsea-profile";

const DEFAULT_PROFILE: Profile = {
  fullName: "DeepSea Admin",
  email: "admin@deepsea.io",
  organization: "DeepSea Research Lab",
  avatar: "",
};

type ProfileState = {
  profile: Profile;
  update: (patch: Partial<Profile>) => void;
  reset: () => void;
  hydrated: boolean;
};

const ProfileContext = createContext<ProfileState | null>(null);

function readProfile(): Profile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return { ...DEFAULT_PROFILE, ...parsed };
    }
    return DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [hydrated, setHydrated] = useState(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const local = readProfile();
    setProfile(local);
    setHydrated(true);

    // Fetch live settings/profile from backend
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted.current || !data?.profile) return;
        const live: Profile = {
          fullName: data.profile.fullName || local.fullName,
          email: data.profile.email || local.email,
          organization: data.profile.organization || local.organization,
          avatar: data.profile.avatar !== undefined ? data.profile.avatar : local.avatar,
        };
        setProfile(live);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(live)); } catch {}
        useAuthStore.getState().updateUser({
          name: live.fullName,
          email: live.email,
          avatar: live.avatar ?? undefined,
          organization: live.organization ?? undefined,
        });
      })
      .catch(() => {});

    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useMemo(() => (patch: Partial<Profile>) => {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore storage errors
      }

      // Update auth store in real-time
      useAuthStore.getState().updateUser({
        name: next.fullName,
        email: next.email,
        avatar: next.avatar ?? undefined,
        organization: next.organization ?? undefined,
      });

      // Sync with backend API
      fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: next }),
      }).catch(() => {});

      return next;
    });
  }, []);

  const reset = useMemo(() => () => {
    const next = DEFAULT_PROFILE;
    setProfile(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }, []);

  const value = useMemo(() => ({ profile, update, reset, hydrated }), [profile, update, reset, hydrated]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileState {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    return {
      profile: DEFAULT_PROFILE,
      update: () => {},
      reset: () => {},
      hydrated: true,
    };
  }
  return ctx;
}
