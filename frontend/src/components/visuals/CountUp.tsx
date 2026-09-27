"use client";

import { useEffect, useRef, useState } from "react";

function useReducedMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(mql.matches);
    const handler = (e: MediaQueryListEvent) => setReduce(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return reduce;
}

export function CountUp({
  end,
  duration = 1600,
  decimals = 0,
  prefix = "",
  suffix = "",
}: {
  end: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
}) {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(reduce ? end : 0);
  const ref = useRef<HTMLSpanElement>(null);
  // Tracks whether the CURRENT animation has started. This must reset whenever
  // `end` changes, otherwise a late-arriving value is never animated to:
  // on first paint the KPI cards render with end=0 (store still empty), the
  // observer fires once and latches `started` to true, and when the real data
  // arrives (end=18) the guard `!started.current` blocks the new animation —
  // leaving the counter permanently frozen at 0.
  const started = useRef(false);
  // Guards against a stale animation frame loop writing over a newer value.
  const runId = useRef(0);

  useEffect(() => {
    if (reduce) {
      setValue(end);
      return;
    }
    const el = ref.current;
    if (!el) return;

    // A new target value means a new animation is required.
    started.current = false;
    const myRun = ++runId.current;

    const animate = () => {
      if (started.current) return;
      started.current = true;
      // Start from whatever is currently displayed so a mid-flight value change
      // eases from where it is rather than snapping back to 0.
      const from = value;
      const start = performance.now();
      const tick = (now: number) => {
        if (runId.current !== myRun) return; // superseded by a newer run
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(from + (end - from) * eased);
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) animate();
    });
    obs.observe(el);
    // If the element is already on screen when `end` changes, IntersectionObserver
    // may not emit a fresh callback — animate directly so updates always land.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) animate();

    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, duration, reduce]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}
      {value.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}
