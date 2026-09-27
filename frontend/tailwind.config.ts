import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0F172A",
        secondary: "#1E293B",
        accent: {
          DEFAULT: "#0EA5E9",
          400: "#38bdf8",
          500: "#0EA5E9",
          600: "#0284c7",
        },
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        text: {
          primary: "#F8FAFC",
          muted: "#94A3B8",
        },
        // Legacy aliases kept for existing components
        ocean: {
          50: "#eefcff",
          100: "#d4f5ff",
          200: "#b0edff",
          300: "#7fe2ff",
          400: "#43d1ff",
          500: "#14b8e6",
          600: "#0692c4",
          700: "#0773a0",
          800: "#0d5e82",
          900: "#124e6c",
          950: "#093349",
        },
        abyss: {
          50: "#f2f6fa",
          100: "#e0e9f1",
          200: "#c2d4e3",
          300: "#94a3b8",
          400: "#5f8cad",
          500: "#3d6e8f",
          600: "#2f5672",
          700: "#28455c",
          800: "#1E293B",
          900: "#213345",
          950: "#0b1722",
        },
        coral: {
          400: "#ff8a65",
          500: "#ff7043",
          600: "#f4511e",
        },
        biolum: {
          400: "#34d399",
          500: "#10B981",
          600: "#059669",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        card: "16px",
        control: "12px",
      },
      boxShadow: {
        "soft-xl": "0 20px 40px -12px rgba(0,0,0,0.35)",
        "glow-accent": "0 0 24px -4px rgba(14,165,233,0.5)",
        soft: "0 20px 40px -12px rgba(0,0,0,0.35)",
      },
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      backgroundImage: {
        "radial-glow":
          "radial-gradient(circle at 50% 0%, rgba(14,165,233,0.18), transparent 60%)",
        "ocean-gradient":
          "linear-gradient(180deg, #0F172A 0%, #1E293B 60%, #0EA5E9 160%)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.8" },
          "100%": { transform: "scale(2.2)", opacity: "0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 2.4s cubic-bezier(0.4,0,0.6,1) infinite",
        float: "float 5s ease-in-out infinite",
        shimmer: "shimmer 1.5s infinite",
        "fade-up": "fade-up 600ms cubic-bezier(0.16,1,0.3,1) both",
      },
    },
  },
  plugins: [],
};

export default config;
