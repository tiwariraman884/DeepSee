"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { User, Shield, Calendar, Save, Loader2, Camera, X, Upload, Check } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { useProfile } from "@/lib/profile/store";
import { profileSchema, type Profile } from "@/lib/settings/schema";
import { useAuthStore } from "@/store/useAuthStore";
import { cn } from "@/lib/utils";

type FormValues = Profile;

const STORAGE_KEY = "deepsea-profile";

export default function ProfilePage() {
  const { profile, update, hydrated } = useProfile();
  const { success, info } = useToast();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [preview, setPreview] = useState<string>(profile.avatar ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(profileSchema),
    values: profile,
    resetOptions: { keepDirtyValues: true },
    mode: "onBlur",
  });

  useEffect(() => {
    reset(profile);
    setPreview(profile.avatar ?? "");
  }, [profile, reset]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const onSubmit = async (data: FormValues) => {
    setStatus("saving");
    try {
      update(data);
      useAuthStore.getState().updateUser({
        name: data.fullName,
        email: data.email,
        organization: data.organization ?? undefined,
        avatar: data.avatar ?? undefined,
      });
      reset(data);
      setStatus("saved");
      success("Profile updated successfully");
      timerRef.current = setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
    }
  };

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      info("Only JPG, PNG, and WEBP images are allowed");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      info("Image must be under 5MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      update({ avatar: result });
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setPreview("");
    update({ avatar: "" });
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!hydrated) {
    return (
      <DashboardShell title="Profile" subtitle="Manage your account">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-64 animate-pulse rounded-card bg-ocean-500/5" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell title="Profile" subtitle="Manage your account information">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader title="Profile Information" icon={<User className="h-4 w-4" />} />
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" aria-label="Profile form">
              <div>
                <label htmlFor="profile-avatar" className="text-xs text-ocean-200/60">
                  Profile Photo
                </label>
                <div className="mt-1 flex items-center gap-4">
                  <div className="relative h-20 w-20 overflow-hidden rounded-2xl border border-ocean-500/15 bg-abyss-900">
                    {preview ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={preview} alt="Profile preview" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl" aria-hidden="true">
                        👤
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-lg border border-ocean-500/15 px-3 py-2 text-xs text-ocean-100 hover:bg-ocean-500/10"
                    >
                      <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                      Upload Photo
                    </button>
                    {preview && (
                      <button
                        type="button"
                        onClick={removeAvatar}
                        className="inline-flex items-center gap-2 rounded-lg border border-rose-500/15 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/10"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                        Remove
                      </button>
                    )}
                    <input
                      ref={fileRef}
                      id="profile-avatar"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0])}
                      aria-label="Upload profile photo"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="fullName" className="text-xs text-ocean-200/60">
                    Full Name
                  </label>
                  <input
                    id="fullName"
                    {...register("fullName")}
                    className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400"
                    aria-required="true"
                  />
                  {errors.fullName && (
                    <p className="mt-1 text-xs text-rose-300" role="alert">
                      {errors.fullName.message}
                    </p>
                  )}
                </div>
                <div>
                  <label htmlFor="email" className="text-xs text-ocean-200/60">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    {...register("email")}
                    className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400"
                    aria-required="true"
                  />
                  {errors.email && (
                    <p className="mt-1 text-xs text-rose-300" role="alert">
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="organization" className="text-xs text-ocean-200/60">
                  Organization
                </label>
                <input
                  id="organization"
                  {...register("organization")}
                  className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2.5 text-sm text-ocean-50 outline-none focus:border-ocean-400"
                />
                {errors.organization && (
                  <p className="mt-1 text-xs text-rose-300" role="alert">
                    {errors.organization.message}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs",
                    status === "saved" && "text-biolum-400",
                    status === "error" && "text-rose-300",
                    status === "saving" && "text-ocean-200/60"
                  )}
                >
                  {status === "saving" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
                  {status === "saved" && <Check className="h-3 w-3" aria-hidden="true" />}
                  {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : ""}
                </div>
                <button
                  type="submit"
                  disabled={status === "saving"}
                  className="inline-flex items-center gap-2 rounded-lg border border-ocean-500/20 bg-ocean-500/15 px-4 py-2.5 text-sm text-ocean-100 hover:bg-ocean-500/20 disabled:opacity-50"
                >
                  {status === "saving" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  <Save className="h-4 w-4" aria-hidden="true" />
                  Save Changes
                </button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Account" icon={<Shield className="h-4 w-4" />} />
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-lg border border-ocean-500/10 bg-abyss-950/40 p-3">
                <Calendar className="h-4 w-4 text-ocean-300" aria-hidden="true" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-ocean-200/60">Member since</p>
                  <p className="text-sm text-white">July 2026</p>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border border-ocean-500/10 bg-abyss-950/40 p-3">
                <Shield className="h-4 w-4 text-ocean-300" aria-hidden="true" />
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-ocean-200/60">Account status</p>
                  <p className="text-sm text-biolum-400">Active</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
