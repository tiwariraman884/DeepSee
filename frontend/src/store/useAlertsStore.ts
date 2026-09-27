import { create } from "zustand";
import type { Alert } from "@/types";

interface AlertsState {
  alerts: Alert[];
  unread: number;
  loaded: boolean;
  fetchAlerts: () => Promise<void>;
  markAllRead: () => void;
}

export const useAlertsStore = create<AlertsState>((set, get) => ({
  alerts: [],
  unread: 0,
  loaded: false,
  fetchAlerts: async () => {
    if (get().loaded) return;
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      set({ alerts: data.alerts, unread: data.unread, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
  markAllRead: () => set({ unread: 0 }),
}));
