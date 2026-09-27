import { useEffect, useRef, useState } from "react";

export type LoadStatus = "loading" | "success" | "error";

/**
 * Simulates an async data load so static (dummy-mode) views can show
 * production-quality loading/error states without a real network call.
 *
 * The initial state is "loading" — this matches SSR output to the first
 * client render, so there is NO hydration mismatch. After `delayMs` the
 * status flips to "success" (or "error" when `fail` is true). `retry()`
 * restarts the cycle.
 */
export function useSimulatedLoad(opts: {
  delayMs?: number;
  fail?: boolean;
} = {}): { status: LoadStatus; retry: () => void } {
  const { delayMs = 0, fail = false } = opts;
  const [status, setStatus] = useState<LoadStatus>(delayMs === 0 ? "success" : "loading");
  const [nonce, setNonce] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (delayMs === 0) {
      setStatus(fail ? "error" : "success");
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    setStatus("loading");
    timer.current = setTimeout(() => {
      setStatus(fail ? "error" : "success");
    }, delayMs);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [delayMs, fail, nonce]);

  return { status, retry: () => setNonce((n) => n + 1) };
}
