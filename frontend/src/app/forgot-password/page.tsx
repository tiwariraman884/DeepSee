"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

const forgotSchema = z.object({
  email: z.string().min(1, "Email is required").email("Please enter a valid email address."),
});

type ForgotFormData = z.infer<typeof forgotSchema>;

function ForgotForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotFormData>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(data: ForgotFormData) {
    setIsSubmitting(true);

    // Mock API call
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSuccess(true);
    }, 1200);
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Reset password</h1>
        <p className="mt-2 text-sm text-ocean-200/60">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {isSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center"
          >
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="mb-2 text-lg font-medium text-white">Check your email</h3>
            <p className="text-sm text-emerald-200/70">
              We&apos;ve sent password reset instructions to your email address.
            </p>
            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-white py-2.5 text-sm font-semibold text-gray-900 transition hover:bg-sky-50"
              >
                Return to login
              </Link>
            </div>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="space-y-5"
          >
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

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-semibold text-gray-900 transition hover:bg-sky-50 disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> Sending link...
                </>
              ) : (
                "Send reset link"
              )}
            </button>

            <p className="mt-6 text-center text-sm text-white/40">
              Remember your password?{" "}
              <Link href="/login" className="font-semibold text-white hover:text-sky-300">
                Sign in
              </Link>
            </p>
          </motion.form>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotForm />
    </AuthShell>
  );
}
