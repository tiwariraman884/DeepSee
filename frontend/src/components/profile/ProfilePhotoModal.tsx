"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Camera, Trash2, RotateCw, ZoomIn, ZoomOut, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ProfilePhotoModalProps = {
  currentAvatar: string;
  name: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
};

type Step = "upload" | "edit" | "saving";

export function ProfilePhotoModal({ currentAvatar, name, onClose, onSave }: ProfilePhotoModalProps) {
  const [step, setStep] = useState<Step>("upload");
  const [preview, setPreview] = useState<string>(currentAvatar);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleFile = useCallback((file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      alert("Only JPG, PNG, and WEBP images are allowed");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Image must be under 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      setRotation(0);
      setZoom(1);
      setStep("edit");
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStep("saving");
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          onSave(preview);
        }, 200);
      }
    }, 120);
  };

  const reset = () => {
    setPreview(currentAvatar);
    setRotation(0);
    setZoom(1);
    setStep("upload");
  };

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
          className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-abyss-950 shadow-soft-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Change profile photo"
        >
          <div className="flex items-center justify-between border-b border-ocean-500/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Change Profile Photo</h2>
              <p className="text-xs text-ocean-200/60">{name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-ocean-500/15 text-ocean-200/70 hover:bg-ocean-500/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="p-5">
            {step === "upload" && (
              <div className="space-y-4">
                <div
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
                  }}
                  role="button"
                  tabIndex={0}
                  className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-ocean-500/25 bg-abyss-900/40 p-10 text-center transition-colors hover:border-ocean-500/40 hover:bg-abyss-900/60"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ocean-500/15 text-ocean-300">
                    <Upload className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Click to upload</p>
                    <p className="mt-1 text-xs text-ocean-200/60">
                      Drag & drop, browse, or take a photo
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-ocean-200/50">
                    <Camera className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>JPG, PNG, WEBP up to 10MB</span>
                  </div>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  aria-label="Upload profile photo"
                />
              </div>
            )}

            {step === "edit" && (
              <div className="space-y-4">
                <div className="flex items-center justify-center overflow-hidden rounded-xl bg-abyss-900/60">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imageRef}
                    src={preview}
                    alt="Preview"
                    className="max-h-64 w-full object-contain transition-transform"
                    style={{ transform: `rotate(${rotation}deg) scale(${zoom})` }}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-ocean-500/15 text-ocean-200/70 hover:bg-ocean-500/10"
                      aria-label="Zoom out"
                    >
                      <ZoomOut className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="w-10 text-center text-xs text-ocean-200/70">
                      {Math.round(zoom * 100)}%
                    </span>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(3, z + 0.1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-ocean-500/15 text-ocean-200/70 hover:bg-ocean-500/10"
                      aria-label="Zoom in"
                    >
                      <ZoomIn className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setRotation((r) => r - 90)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-ocean-500/15 text-ocean-200/70 hover:bg-ocean-500/10"
                      aria-label="Rotate left"
                    >
                      <RotateCw className="h-4 w-4 -scale-x-100" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRotation((r) => r + 90)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-ocean-500/15 text-ocean-200/70 hover:bg-ocean-500/10"
                      aria-label="Rotate right"
                    >
                      <RotateCw className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === "saving" && (
              <div className="space-y-4 py-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-ocean-500/15 text-ocean-300">
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-center text-sm font-medium text-white">Uploading photo...</p>
                  <div className="mx-auto mt-3 h-1.5 w-full max-w-[200px] overflow-hidden rounded-full bg-ocean-500/10">
                    <div
                      className="h-full rounded-full bg-ocean-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className="mt-2 text-center text-[11px] text-ocean-200/60">{progress}%</p>
                </div>
              </div>
            )}
          </div>

          {step !== "saving" && (
            <div className="flex items-center justify-between border-t border-ocean-500/10 px-5 py-4">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-lg border border-ocean-500/15 px-4 py-2 text-sm text-ocean-200/70 hover:bg-ocean-500/10"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-ocean-500/15 px-4 py-2 text-sm text-ocean-100 hover:bg-ocean-500/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={step === "upload"}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm",
                    step === "edit"
                      ? "border-ocean-500/20 bg-ocean-500/15 text-ocean-100 hover:bg-ocean-500/20"
                      : "border-ocean-500/10 bg-ocean-500/5 text-ocean-200/40"
                  )}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
