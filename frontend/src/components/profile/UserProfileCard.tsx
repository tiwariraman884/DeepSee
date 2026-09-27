"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  ChevronUp,
  LogOut,
  Camera,
  Settings,
  HelpCircle,
  Moon,
  Sun,
  Monitor,
  Shield,
  UserCircle2,
} from "lucide-react";
import { useProfile } from "@/lib/profile/store";
import { useToast } from "@/components/ui/Toast";
import { ProfileDropdown } from "./ProfileDropdown";
import { ProfilePhotoModal } from "./ProfilePhotoModal";
import { LogoutConfirmDialog } from "./LogoutConfirmDialog";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCurrentUser } from "@/hooks/useCurrentUser";

function Avatar({
  src,
  name,
  size = 40,
}: {
  src?: string;
  name?: string;
  size?: number;
}) {
  const initial = (name ?? "U").charAt(0).toUpperCase();
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "User"}
        className="h-full w-full rounded-full object-cover"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="flex h-full w-full items-center justify-center rounded-full bg-ocean-500/20 text-sm font-semibold text-ocean-200">
      {initial}
    </div>
  );
}

export function UserProfileCard() {
  const { profile, hydrated } = useProfile();
  const { user, loading, logout } = useCurrentUser();
  const { success, info } = useToast();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setPhotoModalOpen(false);
        setLogoutOpen(false);
      }
    }
    function onClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  const cycleTheme = () => {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(next);
    info(`Theme set to ${next}`);
  };

  const handleLogout = () => {
    setOpen(false);
    setLogoutOpen(true);
  };

  const confirmLogout = async () => {
    setLogoutOpen(false);
    await logout();
    success("Signed out successfully");
    router.push("/login");
  };

  if (!hydrated || loading) {
    return (
      <div className="border-t border-ocean-500/10 p-3">
        <div className="flex items-center gap-3 rounded-xl border border-ocean-500/10 bg-abyss-950/40 p-2">
          <div className="h-10 w-10 shrink-0 rounded-full bg-ocean-500/10" />
          <div className="hidden min-w-0 flex-1 lg:block">
            <div className="h-3.5 w-24 rounded bg-ocean-500/10" />
            <div className="mt-1.5 h-3 w-32 rounded bg-ocean-500/10" />
          </div>
        </div>
      </div>
    );
  }

  const displayName = profile.fullName || user?.name || "DeepSea Admin";
  const displayEmail = profile.email || user?.email || "admin@deepsea.io";
  const displayAvatar = profile.avatar || user?.avatar || "";

  return (
    <div ref={rootRef} className="relative border-t border-ocean-500/10 p-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={`User menu for ${displayName}`}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-ocean-500/10 bg-abyss-950/40 p-2 text-left transition-colors hover:bg-ocean-500/10 focus:outline-none focus:ring-2 focus:ring-biolum-400/50",
          open && "border-ocean-500/25 bg-ocean-500/10"
        )}
      >
        <div className="relative shrink-0">
          <div className="h-10 w-10 overflow-hidden rounded-full border border-ocean-500/15">
            <Avatar src={displayAvatar} name={displayName} size={40} />
          </div>
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-abyss-950 bg-biolum-400"
          />
        </div>
        <div className="hidden min-w-0 flex-1 text-left lg:block">
          <p className="truncate text-sm font-medium text-white">{displayName}</p>
          <p className="truncate text-[11px] text-ocean-200/60">{displayEmail}</p>
        </div>
        <ChevronUp
          className={cn(
            "hidden h-4 w-4 shrink-0 text-ocean-200/60 transition-transform lg:block",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {open && (
          <ProfileDropdown
            onClose={() => setOpen(false)}
            onViewProfile={() => {
              setOpen(false);
              router.push("/profile");
            }}
            onEditProfile={() => {
              setOpen(false);
              router.push("/profile");
            }}
            onChangePhoto={() => {
              setOpen(false);
              setPhotoModalOpen(true);
            }}
            onAccountSettings={() => {
              setOpen(false);
              router.push("/settings");
            }}
            onHelp={() => {
              setOpen(false);
              info("Opening help center...");
            }}
            onToggleTheme={cycleTheme}
            onLogout={handleLogout}
            theme={resolvedTheme ?? "dark"}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {photoModalOpen && (
          <ProfilePhotoModal
            currentAvatar={profile.avatar ?? ""}
            name={profile.fullName}
            onClose={() => setPhotoModalOpen(false)}
            onSave={(dataUrl) => {
              setPhotoModalOpen(false);
              success("Profile photo updated");
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {logoutOpen && (
          <LogoutConfirmDialog
            onClose={() => setLogoutOpen(false)}
            onConfirm={confirmLogout}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
