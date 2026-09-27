"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, LogOut } from "lucide-react";

type LogoutConfirmDialogProps = {
  onClose: () => void;
  onConfirm: () => void;
};

export function LogoutConfirmDialog({ onClose, onConfirm }: LogoutConfirmDialogProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: "spring", stiffness: 300, damping: 28, mass: 0.8 }}
          className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-abyss-950 shadow-soft-xl"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          aria-describedby="logout-desc"
        >
          <div className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/15 text-rose-300">
                <LogOut className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 id="logout-title" className="text-sm font-semibold text-white">
                  Sign Out?
                </h2>
                <p id="logout-desc" className="text-xs text-ocean-200/60">
                  Are you sure you want to log out of DeepSea Guardian?
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-ocean-500/10 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-ocean-500/15 px-4 py-2 text-sm text-ocean-100 hover:bg-ocean-500/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/15"
            >
              Log Out
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
