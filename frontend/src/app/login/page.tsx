"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuthStore } from "@/store/useAuthStore";
import { useToast } from "@/components/ui/Toast";

const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address."),
  password: z.string().min(1, "Password is required").min(8, "Password must be at least 8 characters."),
});

type LoginFormData = z.infer<typeof loginSchema>;

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { error: toastError } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  // Gate the submit button until React has hydrated: a native form submit
  // before hydration does a raw GET and leaks email/password into the URL.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const login = useAuthStore((s) => s.login);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      setGeneralError(error);
    }
    // Warm the post-login route while the user is still typing credentials —
    // in dev the dashboard otherwise compiles on first visit AFTER the
    // redirect, which reads as a multi-second hang after clicking Sign In.
    router.prefetch("/dashboard");
  }, [searchParams, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(data: LoginFormData) {
    setGeneralError(null);
    setIsSubmitting(true);

    try {
      const result = await login(data.email, data.password);
      if (!result.success) {
        const msg = result.error ?? "Something went wrong.";
        setGeneralError(msg);
        toastError(msg);
        setIsSubmitting(false);
      } else {
        // Navigate immediately — no artificial delay. The dashboard is
        // prefetched on mount, so this is a client-side hop, not a compile.
        router.push("/dashboard");
      }
    } catch {
      const msg = "Something went wrong.";
      setGeneralError(msg);
      toastError(msg);
      setIsSubmitting(false);
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Welcome back</h1>
        <p className="mt-2 text-sm text-ocean-200/60">Sign in to access your ocean intelligence dashboard.</p>
      </div>

      {generalError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400"
        >
          {generalError}
        </motion.div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div>
          <div className="relative">
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...register("email")}
              placeholder=" "
              className={cn(
                "peer w-full rounded-xl border bg-white/5 px-4 pb-2.5 pt-6 text-sm text-white outline-none transition-all focus:ring-1",
                errors.email ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500" : "border-white/10 focus:border-sky-400 focus:ring-sky-400"
              )}
            />
            <label htmlFor="email" className="pointer-events-none absolute left-4 top-4 z-10 origin-[0] -translate-y-2.5 scale-75 text-white/40 transition-all duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-sky-400">
              Email address
            </label>
            {errors.email && <AlertCircle className="absolute right-3 top-4 h-5 w-5 text-rose-400" />}
          </div>
          {errors.email && <p className="mt-1.5 text-xs text-rose-400">{errors.email.message}</p>}
        </div>

        <div>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              {...register("password")}
              placeholder=" "
              className={cn(
                "peer w-full rounded-xl border bg-white/5 px-4 pb-2.5 pt-6 pr-10 text-sm text-white outline-none transition-all focus:ring-1",
                errors.password ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500" : "border-white/10 focus:border-sky-400 focus:ring-sky-400"
              )}
            />
            <label htmlFor="password" className="pointer-events-none absolute left-4 top-4 z-10 origin-[0] -translate-y-2.5 scale-75 text-white/40 transition-all duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-sky-400">
              Password
            </label>
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-4 text-white/30 hover:text-white/70">
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && <p className="mt-1.5 text-xs text-rose-400">{errors.password.message}</p>}
        </div>

        <div className="flex items-center justify-between text-xs">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" className="rounded border-white/20 bg-white/5 text-sky-500" />
            <span className="text-white/50">Remember me</span>
          </label>
          <Link href="/forgot-password" className="text-sky-400 hover:text-sky-300">Forgot password?</Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isSuccess || !mounted}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-gray-900 transition hover:bg-sky-50 disabled:opacity-70"
        >
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.span key="ok" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" /> Authenticated!
              </motion.span>
            ) : isSubmitting ? (
              <motion.span key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Signing in…
              </motion.span>
            ) : (
              <motion.span key="txt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Sign In</motion.span>
            )}
          </AnimatePresence>
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-white/40">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-semibold text-white hover:text-sky-300">Sign up</Link>
      </p>
    </motion.div>
  );
}

export default function LoginPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-64 w-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
