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
import { PasswordStrength } from "@/components/auth/PasswordStrength";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

type SignupFormData = z.infer<typeof signupSchema>;

function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { error: toastError } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const signup = useAuthStore((s) => s.signup);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error) {
      setGeneralError(error);
    }
  }, [searchParams]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const password = watch("password");

  async function onSubmit(data: SignupFormData) {
    setGeneralError(null);
    setIsSubmitting(true);

    try {
      const result = await signup(data.name, data.email, data.password);
      if (!result.success) {
        const msg = result.error ?? "Something went wrong.";
        setGeneralError(msg);
        toastError(msg);
        setIsSubmitting(false);
      } else {
        setIsSuccess(true);
        setTimeout(() => {
          router.push("/dashboard");
        }, 600);
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
        <h1 className="text-3xl font-bold tracking-tight text-white">Create account</h1>
        <p className="mt-2 text-sm text-ocean-200/60">Join the ocean intelligence mission today.</p>
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
              id="name"
              type="text"
              autoComplete="name"
              {...register("name")}
              placeholder=" "
              className={cn(
                "peer w-full rounded-xl border bg-white/5 px-4 pb-2.5 pt-6 text-sm text-white outline-none transition-all focus:ring-1",
                errors.name ? "border-rose-500/60 focus:border-rose-500 focus:ring-rose-500" : "border-white/10 focus:border-sky-400 focus:ring-sky-400"
              )}
            />
            <label htmlFor="name" className="pointer-events-none absolute left-4 top-4 z-10 origin-[0] -translate-y-2.5 scale-75 text-white/40 transition-all duration-200 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-2.5 peer-focus:scale-75 peer-focus:text-sky-400">
              Full name
            </label>
            {errors.name && <AlertCircle className="absolute right-3 top-4 h-5 w-5 text-rose-400" />}
          </div>
          {errors.name && <p className="mt-1.5 text-xs text-rose-400">{errors.name.message}</p>}
        </div>

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
              autoComplete="new-password"
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
          <PasswordStrength password={password} />
          {errors.password && <p className="mt-1.5 text-xs text-rose-400">{errors.password.message}</p>}
        </div>

        <button
          type="submit"
          disabled={isSubmitting || isSuccess}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-gray-900 transition hover:bg-sky-50 disabled:opacity-70"
        >
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.span key="ok" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" /> Account created!
              </motion.span>
            ) : isSubmitting ? (
              <motion.span key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Creating account…
              </motion.span>
            ) : (
              <motion.span key="txt" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>Create Account</motion.span>
            )}
          </AnimatePresence>
        </button>
      </form>

      <p className="mt-8 text-center text-sm text-white/40">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-white hover:text-sky-300">Sign in</Link>
      </p>
    </motion.div>
  );
}

export default function SignupPage() {
  return (
    <AuthShell>
      <Suspense fallback={<div className="h-64 w-full flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-white/30" /></div>}>
        <SignupForm />
      </Suspense>
    </AuthShell>
  );
}
