import { create } from "zustand";

export interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  avatar?: string;
  organization?: string;
}

interface AuthState {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  updateUser: (patch: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoggedIn: false,
  isLoading: true,

  login: async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data?.error?.message ?? "Invalid email or password." };
      }

      set({ user: data.user, isLoggedIn: true });
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  },

  signup: async (name: string, email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        return { success: false, error: data?.error?.message ?? "Could not create account." };
      }

      set({ user: data.user, isLoggedIn: true });
      return { success: true };
    } catch {
      return { success: false, error: "Network error. Please try again." };
    }
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Best effort — clear local state regardless
    }
    set({ user: null, isLoggedIn: false });
  },

  initialize: async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        set({ user: data.user, isLoggedIn: true, isLoading: false });
      } else {
        set({ user: null, isLoggedIn: false, isLoading: false });
      }
    } catch {
      set({ user: null, isLoggedIn: false, isLoading: false });
    }
  },

  updateUser: (patch: Partial<User>) => {
    set((state) => ({
      user: state.user ? { ...state.user, ...patch } : ({ id: "usr_admin", name: "DeepSea Admin", email: "admin@deepsea.io", ...patch } as User),
      isLoggedIn: true,
    }));
  },
}));


