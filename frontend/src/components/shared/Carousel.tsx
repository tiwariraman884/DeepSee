"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CarouselSlide {
  id: string;
  content: ReactNode;
}

export function Carousel({
  slides,
  autoPlayMs = 5000,
  className,
}: {
  slides: CarouselSlide[];
  autoPlayMs?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const count = slides.length;

  const go = useCallback(
    (next: number) => setIndex((prev) => (next + count) % count),
    [count]
  );
  const next = useCallback(() => go(index + 1), [go, index]);
  const prev = useCallback(() => go(index - 1), [go, index]);

  useEffect(() => {
    if (reduce || count <= 1) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), autoPlayMs);
    return () => clearInterval(t);
  }, [reduce, count, autoPlayMs]);

  if (count === 0) return null;

  return (
    <div
      className={cn("relative", className)}
      role="region"
      aria-roledescription="carousel"
      aria-label="Innovation features"
    >
      <div className="overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0, x: reduce ? 0 : 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: reduce ? 0 : -40 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${count}`}
          >
            {slides[index].content}
          </motion.div>
        </AnimatePresence>
      </div>

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="Previous slide"
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/40 p-2 text-white/80 backdrop-blur transition-colors hover:bg-black/60 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="Next slide"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-black/40 p-2 text-white/80 backdrop-blur transition-colors hover:bg-black/60 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="mt-4 flex items-center justify-center gap-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === index ? "w-6 bg-biolum-400" : "w-2 bg-white/20 hover:bg-white/40"
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
