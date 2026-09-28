"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

type LazyVideoProps = {
  src: string;
  poster?: string;
  className?: string;
  children?: React.ReactNode;
  overlayClassName?: string;
  ariaLabel?: string;
  priority?: boolean;
};

export function LazyVideo({
  src,
  poster,
  className,
  children,
  overlayClassName,
  ariaLabel,
  priority = false,
}: LazyVideoProps) {
  const [visible, setVisible] = useState(priority);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();

  useEffect(() => {
    if (priority) return;
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [priority]);

  useEffect(() => {
    if (!visible || reduce) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    let interactionHandler: ((e: Event) => void) | null = null;
    let playFailed = false;

    const log = (label: string, data?: Record<string, unknown>) => {
      if (typeof console !== "undefined") {
        console.log(`[LazyVideo][${src}] ${label}`, data ?? "");
      }
    };

    const state = () => ({
      readyState: video.readyState,
      networkState: video.networkState,
      currentTime: video.currentTime,
      paused: video.paused,
      ended: video.ended,
      error: video.error,
    });

    const attemptPlay = async (label = "autoplay") => {
      if (cancelled) return;
      log(`${label} attempt`, state());
      try {
        await video.play();
        log(`${label} success`, state());
        playFailed = false;
      } catch (err) {
        playFailed = true;
        log(`${label} rejected`, { error: err, state: state() });
        if (!cancelled && !interactionHandler) {
          interactionHandler = async () => {
            if (cancelled) return;
            log("interaction retry", state());
            try {
              await video.play();
              playFailed = false;
            } catch (interactionErr) {
              log("interaction retry rejected", { error: interactionErr, state: state() });
            }
            if (interactionHandler) {
              window.removeEventListener("pointerdown", interactionHandler);
              window.removeEventListener("keydown", interactionHandler);
              interactionHandler = null;
            }
          };
          window.addEventListener("pointerdown", interactionHandler, { once: true });
          window.addEventListener("keydown", interactionHandler, { once: true });
        }
      }
    };

    const onReady = () => {
      if (cancelled) return;
      log("ready event", state());
      attemptPlay("ready-event");
    };

    const onCanPlay = () => {
      if (cancelled) return;
      log("canplay", state());
      if (playFailed) {
        attemptPlay("canplay-retry");
      }
    };

    const onError = () => {
      if (cancelled) return;
      log("error", state());
      if (!cancelled) setError(true);
    };

    const noopLog = () => log("pause-state-change", state());
    video.addEventListener("loadstart", () => log("loadstart", state()));
    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("loadeddata", onReady);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("play", noopLog);
    video.addEventListener("playing", noopLog);
    video.addEventListener("pause", noopLog);
    video.addEventListener("waiting", noopLog);
    video.addEventListener("stalled", noopLog);
    video.addEventListener("error", onError);

    if (video.readyState >= 2) {
      attemptPlay("readyState");
    }

    return () => {
      cancelled = true;
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("loadeddata", onReady);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("play", noopLog);
      video.removeEventListener("playing", noopLog);
      video.removeEventListener("pause", noopLog);
      video.removeEventListener("waiting", noopLog);
      video.removeEventListener("stalled", noopLog);
      video.removeEventListener("error", onError);
      if (interactionHandler) {
        window.removeEventListener("pointerdown", interactionHandler);
        window.removeEventListener("keydown", interactionHandler);
      }
      video.pause();
      log("cleanup-pause", state());
    };
  }, [visible, reduce, src]);

  return (
    <motion.div
      ref={containerRef}
      className={className}
      initial={priority ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      aria-label={ariaLabel}
    >
      {visible && !error && (
        <video
          ref={videoRef}
          suppressHydrationWarning
          src={src}
          poster={poster}
          muted
          loop
          playsInline
          autoPlay={!reduce}
          // "auto" makes every off-screen instance (carousel × 5, backgrounds)
          // download the full file before it is even shown — "metadata" still
          // lets autoplay start but defers the bulk of the download.
          preload={priority ? "auto" : "metadata"}
          disableRemotePlayback
          className="h-full w-full object-cover"
          onError={() => setError(true)}
          style={{ opacity: reduce ? 0.85 : 1 }}
        />
      )}
      {error && (
        <div className="flex h-full w-full items-center justify-center bg-abyss-900/40 text-xs text-ocean-200/50">
          Video unavailable
        </div>
      )}
      {children}
      {overlayClassName && <div className={overlayClassName} aria-hidden="true" />}
    </motion.div>
  );
}
