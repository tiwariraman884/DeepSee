import type { Variants, Transition } from "framer-motion";

// Matches tailwind config: ease-out-expo = cubic-bezier(0.16, 1, 0.3, 1)
export const EASE_OUT_EXPO: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.4, ease: EASE_OUT_EXPO },
  }),
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};

export const slideFadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, y: 8, transition: { duration: 0.2, ease: EASE_OUT_EXPO } },
};

export const modalVariants: Variants = {
  hidden: { opacity: 0, y: 16, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.25, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.25, ease: EASE_OUT_EXPO } },
};

export const overlayVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.25 } },
};

export const toastVariants: Variants = {
  hidden: { opacity: 0, x: 24, y: -8 },
  visible: { opacity: 1, x: 0, y: 0, transition: { duration: 0.25, ease: EASE_OUT_EXPO } },
  exit: { opacity: 0, x: 24, transition: { duration: 0.2, ease: EASE_OUT_EXPO } },
};

export const dropIn: Variants = {
  hidden: { opacity: 0, scale: 0.6, y: -8 },
  visible: (i: number = 0) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { delay: i * 0.04, type: "spring", stiffness: 500, damping: 24 },
  }),
};

export const DEFAULT_TRANSITION: Transition = { duration: 0.2, ease: EASE_OUT_EXPO };
