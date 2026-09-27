"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { User, Bell, Palette, Globe, Download, Upload, X, Check, Loader2, AlertCircle, RefreshCcw, WifiOff, Save } from "lucide-react";
import { DashboardShell } from "@/components/layout/DashboardShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { oceanRegions } from "@/lib/regions";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { profileSchema, notificationSchema, settingsSchema, type Profile, type Notifications, type Settings } from "@/lib/settings/schema";
import { useTheme } from "next-themes";
import { useAppStore } from "@/store/useAppStore";
import { useAuthStore } from "@/store/useAuthStore";

type ProfileForm = Profile;
type NotificationForm = Notifications;

const NOTIFICATION_ITEMS: { key: keyof NotificationForm; label: string; desc: string }[] = [
  { key: "critical", label: "Critical Alerts", desc: "Illegal dumping, bleaching events" },
  { key: "weeklyDigest", label: "Weekly Digest", desc: "Summary every Monday" },
  { key: "droneUpdates", label: "Drone Updates", desc: "Mission & battery changes" },
  { key: "emergency", label: "Emergency Alerts", desc: "Urgent environmental events" },
  { key: "oceanHealth", label: "Ocean Health Reports", desc: "Daily ecosystem metrics" },
  { key: "speciesMonitoring", label: "Species Monitoring", desc: "Population & migration alerts" },
  { key: "aiRecommendations", label: "AI Recommendations", desc: "Suggested conservation actions" },
  { key: "missionStatus", label: "Mission Status", desc: "Active drone missions" },
  { key: "email", label: "Email Notifications", desc: "Receive updates via email" },
  { key: "push", label: "Push Notifications", desc: "Browser push alerts" },
  { key: "sms", label: "SMS Alerts", desc: "Text message notifications (optional)" },
];

const DEFAULT_SETTINGS: Settings = {
  profile: {
    fullName: "DeepSea Admin",
    email: "admin@deepsea.io",
    organization: "DeepSea Research Lab",
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

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px]", status === "saving" && "text-ocean-200/60", status === "saved" && "text-biolum-400", status === "error" && "text-rose-300")}>
      {status === "saving" && <Loader2 className="h-3 w-3 animate-spin" />}
      {status === "saved" && <Check className="h-3 w-3" />}
      {status === "error" && <AlertCircle className="h-3 w-3" />}
      {status === "saving" ? "Saving..." : status === "saved" ? "Saved" : "Retry"}
    </span>
  );
}

export default function SettingsPage() {
  const { success: toastSuccess, error: toastError, info: toastInfo } = useToast();
  const { resolvedTheme, setTheme } = useTheme();
  const fileRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [isOnline, setIsOnline] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [original, setOriginal] = useState<Settings>(DEFAULT_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  const initialized = useRef(false);

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: settings.profile,
    resetOptions: { keepDirtyValues: true },
    mode: "onBlur",
  });

  const notifForm = useForm<NotificationForm>({
    resolver: zodResolver(notificationSchema),
    values: settings.notifications,
    resetOptions: { keepDirtyValues: true },
    mode: "onChange",
  });

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        try {
          const parsed = settingsSchema.parse(data);
          setSettings(parsed);
          setOriginal(parsed);
          profileForm.reset(parsed.profile);
          notifForm.reset(parsed.notifications);
          setAvatarPreview(parsed.profile.avatar ?? "");
          initialized.current = true;
        } catch (err) {
          console.error("Settings parse error:", err);
        }
      })
      .catch(() => {
        const fallback = DEFAULT_SETTINGS;
        setSettings(fallback);
        setOriginal(fallback);
        profileForm.reset(fallback.profile);
        notifForm.reset(fallback.notifications);
        setAvatarPreview(fallback.profile.avatar ?? "");
        initialized.current = true;
      });
    return () => {
      mountedRef.current = false;
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [profileForm, notifForm]);

  const persistToApi = useCallback(async (patch: Record<string, unknown>): Promise<boolean> => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setStatus("saving");
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const parsed = settingsSchema.parse(data);
      setSettings(parsed);
      setOriginal(parsed);
      profileForm.reset(parsed.profile);
      notifForm.reset(parsed.notifications);
      setDirty(false);
      setStatus("saved");
      timerRef.current = setTimeout(() => {
        if (mountedRef.current) setStatus("idle");
      }, 2000);
      return true;
    } catch {
      setStatus("error");
      return false;
    }
  }, [profileForm, notifForm]);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const onProfileSubmit = useCallback(
    async (data: ProfileForm) => {
      useAuthStore.getState().updateUser({
        name: data.fullName,
        email: data.email,
        organization: data.organization ?? undefined,
        avatar: data.avatar ?? undefined,
      });
      await persistToApi({ profile: data });
      toastSuccess("Profile updated successfully");
    },
    [persistToApi, toastSuccess]
  );

  const onNotifSubmit = useCallback(
    async (data: NotificationForm) => {
      await persistToApi({ notifications: data });
      toastSuccess("Notification preferences saved");
    },
    [persistToApi, toastSuccess]
  );

  const onRegionChange = useCallback(
    async (e: React.ChangeEvent<HTMLSelectElement>) => {
      const newRegion = e.target.value;
      useAppStore.getState().setRegion(newRegion);
      const ok = await persistToApi({ region: newRegion });
      if (ok) toastSuccess(`Region updated to ${newRegion}`);
      else toastError("Failed to update region");
    },
    [persistToApi, toastSuccess, toastError]
  );

  const onThemeChange = useCallback(
    async (t: string) => {
      setTheme(t);
      const ok = await persistToApi({ theme: t as Settings["theme"] });
      if (ok) toastInfo(`Theme set to ${t}`);
      else toastError("Failed to update theme");
    },
    [setTheme, persistToApi, toastInfo, toastError]
  );

  const handleImageUpload = useCallback(
    (file?: File) => {
      if (!file) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toastError("Only JPG, PNG, and WEBP images are allowed");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toastError("Image must be under 5MB");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setAvatarPreview(result);
        onProfileSubmit({ avatar: result } as ProfileForm);
      };
      reader.readAsDataURL(file);
    },
    [onProfileSubmit, toastError]
  );

  const removeAvatar = useCallback(() => {
    setAvatarPreview("");
    onProfileSubmit({ avatar: "" } as ProfileForm);
    if (fileRef.current) fileRef.current.value = "";
  }, [onProfileSubmit]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/settings/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `deepsea-settings-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toastSuccess("Settings exported successfully");
    } catch {
      toastError("Failed to export settings");
    } finally {
      setExporting(false);
    }
  }, [settings, toastSuccess, toastError]);

  const handleReset = useCallback(async () => {
    const ok = await persistToApi({
      profile: DEFAULT_SETTINGS.profile,
      notifications: DEFAULT_SETTINGS.notifications,
      region: DEFAULT_SETTINGS.region,
      theme: DEFAULT_SETTINGS.theme,
    });
    if (ok) {
      profileForm.reset(DEFAULT_SETTINGS.profile);
      notifForm.reset(DEFAULT_SETTINGS.notifications);
      setAvatarPreview(DEFAULT_SETTINGS.profile.avatar ?? "");
      setTheme(DEFAULT_SETTINGS.theme);
      toastSuccess("Settings reset to defaults");
    } else {
      toastError("Failed to reset settings");
    }
  }, [persistToApi, profileForm, notifForm, toastSuccess, toastError, setTheme]);

  const handleCancel = useCallback(() => {
    setSettings(original);
    setDirty(false);
    profileForm.reset(original.profile);
    notifForm.reset(original.notifications);
    setAvatarPreview(original.profile.avatar ?? "");
    toastInfo("Changes discarded");
  }, [original, profileForm, notifForm, toastInfo]);

  const profileDirty = useMemo(() => {
    const current = profileForm.getValues();
    return current.fullName !== settings.profile.fullName ||
      current.email !== settings.profile.email ||
      current.organization !== (settings.profile.organization ?? "") ||
      current.avatar !== (settings.profile.avatar ?? "");
  }, [profileForm, settings.profile]);

  const notifDirty = useMemo(() => {
    const current = notifForm.getValues();
    return Object.keys(current).some((key) => {
      const k = key as keyof NotificationForm;
      return current[k] !== (settings.notifications[k] ?? false);
    });
  }, [notifForm, settings.notifications]);

  const isSaving = status === "saving";

  return (
    <DashboardShell title="Settings" subtitle="Manage your profile & preferences">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          {isOnline ? (
            <>
              <WifiOff className="h-3.5 w-3.5 text-biolum-400" aria-hidden="true" />
              <span>Online — changes sync automatically</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-rose-400" aria-hidden="true" />
              <span>Offline — changes saved locally</span>
            </>
          )}
        </div>
        <SaveIndicator status={status} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Profile */}
        <Card>
          <CardHeader title="Profile" icon={<User className="h-4 w-4" />} />
          <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-3" aria-label="Profile form">
            <div>
              <label htmlFor="profile-avatar" className="text-xs text-ocean-200/60">Profile Photo</label>
              <div className="mt-1 flex items-center gap-3">
                <div className="relative h-12 w-12 overflow-hidden rounded-lg bg-abyss-900">
                  {avatarPreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={avatarPreview} alt="Profile preview" className="h-full w-full object-cover" />
                    </>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg" aria-hidden="true">👤</div>
                  )}
                </div>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1 rounded-md border border-ocean-500/15 px-2 py-1 text-xs text-ocean-100 hover:bg-ocean-500/10">
                    <Upload className="h-3 w-3" aria-hidden="true" /> Upload
                  </button>
                  {avatarPreview && (
                    <button type="button" onClick={removeAvatar} className="inline-flex items-center gap-1 rounded-md border border-rose-500/15 px-2 py-1 text-xs text-rose-200 hover:bg-rose-500/10">
                      <X className="h-3 w-3" aria-hidden="true" /> Remove
                    </button>
                  )}
                </div>
                <input ref={fileRef} id="profile-avatar" type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleImageUpload(e.target.files?.[0])} aria-label="Upload profile photo" />
              </div>
            </div>
            <div>
              <label htmlFor="profile-name" className="text-xs text-ocean-200/60">Full Name</label>
              <input id="profile-name" {...profileForm.register("fullName")} className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2 text-sm text-ocean-50 outline-none focus:border-ocean-400" aria-required="true" />
              {profileForm.formState.errors.fullName && <p className="mt-1 text-xs text-rose-300" role="alert">{profileForm.formState.errors.fullName.message}</p>}
            </div>
            <div>
              <label htmlFor="profile-email" className="text-xs text-ocean-200/60">Email</label>
              <input id="profile-email" type="email" {...profileForm.register("email")} className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2 text-sm text-ocean-50 outline-none focus:border-ocean-400" aria-required="true" />
              {profileForm.formState.errors.email && <p className="mt-1 text-xs text-rose-300" role="alert">{profileForm.formState.errors.email.message}</p>}
            </div>
            <div>
              <label htmlFor="profile-org" className="text-xs text-ocean-200/60">Organization</label>
              <input id="profile-org" {...profileForm.register("organization")} className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2 text-sm text-ocean-50 outline-none focus:border-ocean-400" />
              {profileForm.formState.errors.organization && <p className="mt-1 text-xs text-rose-300" role="alert">{profileForm.formState.errors.organization.message}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleCancel} className="inline-flex items-center gap-2 rounded-lg border border-ocean-500/15 px-4 py-2 text-sm text-ocean-200/60 hover:bg-ocean-500/10">
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
              </button>
              <button type="submit" disabled={isSaving || !profileDirty} className="inline-flex items-center gap-2 rounded-lg border border-ocean-500/20 px-4 py-2 text-sm text-ocean-100 hover:bg-ocean-500/10 disabled:opacity-50">
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                Save Profile
              </button>
            </div>
          </form>
        </Card>

        {/* Theme */}
        <Card>
          <CardHeader title="Theme" icon={<Palette className="h-4 w-4" />} />
          <div className="space-y-3">
            <p className="text-xs text-ocean-200/60">Choose your preferred theme. This setting syncs across devices.</p>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Theme selection">
              {(["dark", "light", "system"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onThemeChange(t)}
                  aria-pressed={(resolvedTheme ?? "dark") === t || (t === "system" && settings.theme === "system")}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm capitalize transition-colors",
                    (resolvedTheme ?? "dark") === t || (t === "system" && settings.theme === "system")
                      ? "border-ocean-400 bg-ocean-500/20 text-ocean-100"
                      : "border-ocean-500/15 text-ocean-200/60 hover:text-ocean-100"
                  )}
                >
                  <span className="text-lg" aria-hidden="true">{t === "dark" ? "🌙" : t === "light" ? "☀️" : "💻"}</span>
                  {t}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-text-muted">Current: {resolvedTheme ?? "system"}</p>
          </div>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader title="Notifications" icon={<Bell className="h-4 w-4" />} />
          <form onSubmit={notifForm.handleSubmit(onNotifSubmit)} className="space-y-3" aria-label="Notification preferences">
            {NOTIFICATION_ITEMS.map((n) => (
              <div key={n.key} className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white">{n.label}</p>
                  <p className="text-xs text-ocean-200/60">{n.desc}</p>
                </div>
                <Toggle
                  on={!!notifForm.watch(n.key)}
                  onChange={() => notifForm.setValue(n.key, !notifForm.watch(n.key))}
                  label={`${n.label} notifications`}
                  disabled={isSaving}
                />
              </div>
            ))}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={handleCancel} className="inline-flex items-center gap-2 rounded-lg border border-ocean-500/15 px-4 py-2 text-sm text-ocean-200/60 hover:bg-ocean-500/10">
                <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
              </button>
              <button type="submit" disabled={isSaving || !notifDirty} className="inline-flex items-center gap-2 rounded-lg border border-ocean-500/20 px-4 py-2 text-sm text-ocean-100 hover:bg-ocean-500/10 disabled:opacity-50">
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                <Save className="h-3.5 w-3.5" aria-hidden="true" />
                Save Preferences
              </button>
            </div>
          </form>
        </Card>

        {/* Region */}
        <Card>
          <CardHeader title="Region & Data" icon={<Globe className="h-4 w-4" />} />
          <div className="space-y-3">
            <div>
              <label htmlFor="region-select" className="text-xs text-ocean-200/60">Default Region</label>
              <select
                id="region-select"
                value={settings.region}
                onChange={onRegionChange}
                disabled={isSaving}
                className="mt-1 w-full rounded-lg border border-ocean-500/15 bg-abyss-900 px-3 py-2 text-sm text-ocean-50 outline-none focus:border-ocean-400 disabled:opacity-50"
              >
                {oceanRegions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="rounded-lg border border-ocean-500/10 bg-abyss-950/40 p-3 text-xs text-ocean-200/70">
              <p className="font-medium text-text-primary mb-1">What this changes</p>
              <p>Dashboard widgets, analytics focus, prediction engine context, and assistant behavior will all adapt to your selected region.</p>
            </div>
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-ocean-500/20 py-2.5 text-sm text-ocean-100 hover:bg-ocean-500/10 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
              {exporting ? "Generating..." : "Export My Data"}
            </button>
            <button
              type="button"
              onClick={handleReset}
              disabled={isSaving}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/15 py-2 text-xs text-rose-200 hover:bg-rose-500/10 disabled:opacity-50"
            >
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" /> Reset to Defaults
            </button>
          </div>
        </Card>
      </div>

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title">
          <div className="w-full max-w-sm rounded-card border border-white/10 bg-secondary p-5">
            <h3 id="cancel-dialog-title" className="text-base font-semibold text-text-primary">Discard unsaved changes?</h3>
            <p className="mt-2 text-sm text-text-muted">You have unsaved changes that will be lost if you continue.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCancelConfirm(false)} className="rounded-lg border border-ocean-500/15 px-4 py-2 text-sm text-ocean-100 hover:bg-ocean-500/10">
                Keep Editing
              </button>
              <button type="button" onClick={() => { handleCancel(); setShowCancelConfirm(false); }} className="rounded-lg border border-rose-500/20 px-4 py-2 text-sm text-rose-200 hover:bg-rose-500/10">
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}

function Toggle({ on, onChange, label, disabled }: { on: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn("relative h-6 w-11 rounded-full transition-colors disabled:opacity-50", on ? "bg-ocean-500" : "bg-abyss-700")}
    >
      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}
