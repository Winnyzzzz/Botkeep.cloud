/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#05070c",
          900: "#080d15",
          850: "#0b111b",
          800: "#101825",
          700: "#182335",
          600: "#22314a",
        },
        signal: {
          DEFAULT: "#4ade80",
          soft: "#86efac",
          deep: "#16a34a",
        },
        wire: {
          DEFAULT: "#38bdf8",
          deep: "#0284c7",
        },
        warn: {
          DEFAULT: "#fbbf24",
          deep: "#d97706",
        },
        danger: {
          DEFAULT: "#f87171",
          deep: "#dc2626",
        },
      },
      fontFamily: {
        sans: ['"Inter"', "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(74,222,128,0.16), 0 18px 50px -20px rgba(74,222,128,0.35)",
        panel: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.9)",
      },
      backgroundImage: {
        grid: "linear-gradient(to right, rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.07) 1px, transparent 1px)",
        sweep: "radial-gradient(60% 60% at 50% 0%, rgba(74,222,128,0.16) 0%, transparent 70%)",
      },
      keyframes: {
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        pulseRing: {
          "0%": { transform: "scale(0.9)", opacity: "0.7" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
      },
      animation: {
        blink: "blink 1.1s step-end infinite",
        pulseRing: "pulseRing 2.4s ease-out infinite",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
