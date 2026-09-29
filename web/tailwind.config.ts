import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        line: "var(--line)",
        brand: {
          DEFAULT: "var(--brand)",
          soft: "var(--brand-soft)",
          ink: "var(--brand-ink)",
        },
        good: {
          DEFAULT: "var(--good)",
          soft: "var(--good-soft)",
          ink: "var(--good-ink)",
        },
        bad: {
          DEFAULT: "var(--bad)",
          soft: "var(--bad-soft)",
          ink: "var(--bad-ink)",
        },
        warn: {
          DEFAULT: "var(--warn)",
          soft: "var(--warn-soft)",
          ink: "var(--warn-ink)",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "SF Pro Display",
          "Segoe UI",
          "Roboto",
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,18,35,0.04), 0 4px 16px rgba(16,18,35,0.05)",
        float: "0 8px 30px rgba(16,18,35,0.12)",
        nav: "0 -4px 24px rgba(16,18,35,0.08)",
      },
      keyframes: {
        "pulse-ring": {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(2.4)", opacity: "0" },
        },
        scanline: {
          "0%": { top: "8%" },
          "50%": { top: "82%" },
          "100%": { top: "8%" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "pulse-ring": "pulse-ring 1.6s cubic-bezier(0.2, 0.6, 0.4, 1) infinite",
        scanline: "scanline 2.4s ease-in-out infinite",
        "fade-up": "fade-up 0.35s cubic-bezier(0.2, 0.7, 0.3, 1) both",
        shimmer: "shimmer 1.4s infinite",
      },
    },
  },
};

export default config;
