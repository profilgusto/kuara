import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Background layers – dark mode
        bg: {
          base: "#0B1411",
          surface1: "#11201A",
          surface2: "#162A22",
          border: "#1F3A30",
        },
        // Background layers – light mode
        light: {
          bg: "#F2F5F1",
          surface: "#E6ECE7",
          border: "#CFD8D2",
        },
        // Primary – Vida
        primary: {
          DEFAULT: "#3FAF5C",
          hover: "#2F8C49",
          glow: "rgba(63,175,92,0.25)",
          foreground: "#0B1411",
        },
        // Secondary – Sensores e Dados
        secondary: {
          DEFAULT: "#2FA8B8",
          deep: "#1F6E78",
          soft: "#7FD3DD",
          foreground: "#0B1411",
        },
        // Accent – Inteligência Orgânica
        accent: {
          DEFAULT: "#5B7F6E",
          deep: "#3F5C4F",
          light: "#8AAFA0",
          foreground: "#F2F5F1",
        },
        // Natural support tones
        sand: "#C9BFA3",
        clay: "#A56E4A",
        organic: "#4F5A55",
        // Shadcn/Radix overrides (pointing to our palette)
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
      },
      fontFamily: {
        serif: ["Fraunces", "Georgia", "serif"],
        sans: ["IBM Plex Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "Menlo", "monospace"],
      },
      fontSize: {
        "display-xl": [
          "4.5rem",
          { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "600" },
        ],
        "display-lg": [
          "3.5rem",
          { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" },
        ],
        "display-md": [
          "2.5rem",
          { lineHeight: "1.15", letterSpacing: "-0.015em", fontWeight: "600" },
        ],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "scroll-reveal": {
          "0%": { opacity: "0", transform: "translateY(7px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(63,175,92,0)" },
          "50%": { boxShadow: "0 0 18px 4px rgba(63,175,92,0.25)" },
        },
        "bg-breathe": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "underline-grow": {
          "0%": { width: "0%" },
          "100%": { width: "100%" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "count-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "scroll-reveal": "scroll-reveal 300ms ease-in-out forwards",
        "glow-pulse": "glow-pulse 2.5s ease-in-out infinite",
        "bg-breathe": "bg-breathe 30s ease infinite",
        "underline-grow": "underline-grow 250ms ease-in-out forwards",
        "fade-in": "fade-in 400ms ease-in-out forwards",
        "count-up": "count-up 300ms ease-out forwards",
      },
      transitionTimingFunction: {
        "bio-ease": "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      transitionDuration: {
        "240": "240ms",
        "320": "320ms",
      },
      backgroundSize: {
        "300%": "300%",
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
};

export default config;
