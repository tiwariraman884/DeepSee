"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, Info, ShieldAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toastVariants } from "@/lib/motion";

type Severity = "critical" | "warning" | "info";

const wrap: Record<Severity, string> = {
  critical: "border-l-4 border-danger bg-danger/10 text-danger",
  warning: "border-l-4 border-warning bg-warning/10 text-warning",
  info: "border-l-4 border-accent bg-accent/10 text-accent",
};

function SeverityIcon({ severity }: { severity: Severity }) {
  const reduce = useReducedMotion();
  if (severity === "critical") {
    return (
      <motion.span
        className="mt-0.5 flex shrink-0"
        animate={reduce ? undefined : { scale: [1, 1.1, 1] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <ShieldAlert className="h-4 w-4" />
      </motion.span>
    );
  }
  if (severity === "warning") return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />;
  return <Info className="mt-0.5 h-4 w-4 shrink-0" />;
}

export function Alert({
  severity,
  message,
  timestamp,
  actionLabel,
  onAction,
  onDismiss,
  toast = false,
}: {
  severity: Severity;
  message: string;
  timestamp: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss?: () => void;
  toast?: boolean;
}) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (severity === "info" && onDismiss) {
      const t = setTimeout(() => {
        setVisible(false);
        onDismiss();
      }, 6000);
      return () => clearTimeout(t);
    }
  }, [severity, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="alert"
          aria-live={toast ? "polite" : "assertive"}
          className={cn(
            "flex items-start gap-3 rounded-control px-4 py-3 text-sm shadow-soft-xl",
            wrap[severity],
            toast && "fixed right-4 top-4 z-[60] w-80 max-w-[calc(100vw-2rem)]"
          )}
          variants={toast ? toastVariants : undefined}
          initial={toast ? "hidden" : false}
          animate={toast ? "visible" : undefined}
          exit={toast ? "exit" : { opacity: 0 }}
        >
          <SeverityIcon severity={severity} />
          <div className="flex-1">
            <p className="font-medium text-text-primary">{message}</p>
            <p className="mt-0.5 text-xs opacity-70 text-text-muted">{timestamp}</p>
            {actionLabel && onAction && (
              <button
                onClick={onAction}
                className="mt-2 rounded-control border border-current px-2.5 py-1 text-xs font-medium"
              >
                {actionLabel}
              </button>
            )}
          </div>
          {onDismiss && (
            <button
              onClick={() => {
                setVisible(false);
                onDismiss();
              }}
              className="text-text-muted transition-colors hover:text-text-primary"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const Toast = Alert;
