"use client";

import { motion } from "framer-motion";
import {
  UserCircle2,
  User,
  Camera,
  Settings,
  HelpCircle,
  Moon,
  Sun,
  Monitor,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

type ProfileDropdownProps = {
  onClose: () => void;
  onViewProfile: () => void;
  onEditProfile: () => void;
  onChangePhoto: () => void;
  onAccountSettings: () => void;
  onHelp: () => void;
  onToggleTheme: () => void;
  onLogout: () => void;
  theme: string;
};

const spring = {
  type: "spring",
  stiffness: 300,
  damping: 28,
  mass: 0.8,
};

export function ProfileDropdown({
  onClose,
  onViewProfile,
  onEditProfile,
  onChangePhoto,
  onAccountSettings,
  onHelp,
  onToggleTheme,
  onLogout,
  theme,
}: ProfileDropdownProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 8 }}
      transition={spring}
      className="absolute bottom-full left-3 right-3 mb-2 z-50"
    >
      <div className="overflow-hidden rounded-xl border border-ocean-500/15 bg-abyss-950 shadow-soft-xl backdrop-blur">
        <div className="p-1">
          <button
            type="button"
            onClick={onViewProfile}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ocean-100 hover:bg-ocean-500/10"
          >
            <UserCircle2 className="h-4 w-4 shrink-0 text-ocean-300" aria-hidden="true" />
            <span>View Profile</span>
          </button>
          <button
            type="button"
            onClick={onEditProfile}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ocean-100 hover:bg-ocean-500/10"
          >
            <User className="h-4 w-4 shrink-0 text-ocean-300" aria-hidden="true" />
            <span>Edit Profile</span>
          </button>
          <button
            type="button"
            onClick={onChangePhoto}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ocean-100 hover:bg-ocean-500/10"
          >
            <Camera className="h-4 w-4 shrink-0 text-ocean-300" aria-hidden="true" />
            <span>Change Profile Photo</span>
          </button>
          <button
            type="button"
            onClick={onAccountSettings}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ocean-100 hover:bg-ocean-500/10"
          >
            <Settings className="h-4 w-4 shrink-0 text-ocean-300" aria-hidden="true" />
            <span>Account Settings</span>
          </button>
        </div>

        <div className="mx-3 my-1 h-px bg-ocean-500/10" />

        <div className="p-1">
          <button
            type="button"
            onClick={() => {
              onToggleTheme();
              onClose();
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ocean-100 hover:bg-ocean-500/10"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4 shrink-0 text-ocean-300" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4 shrink-0 text-ocean-300" aria-hidden="true" />
            )}
            <span>Dark Mode</span>
            <span className="ml-auto text-[10px] uppercase tracking-widest text-ocean-200/50">
              {theme}
            </span>
          </button>
          <button
            type="button"
            onClick={onHelp}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-ocean-100 hover:bg-ocean-500/10"
          >
            <HelpCircle className="h-4 w-4 shrink-0 text-ocean-300" aria-hidden="true" />
            <span>Help & Support</span>
          </button>
        </div>

        <div className="mx-3 my-1 h-px bg-ocean-500/10" />

        <div className="p-1">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-500/10"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}
