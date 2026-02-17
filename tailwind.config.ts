import type { Config } from "tailwindcss";

// Tailwind setup using CSS variables so both "default" and "ghibli" themes
// share the same utility classes and only swap variable values.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        surface: "var(--surface)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        card: "var(--card)",
        popover: "var(--popover)",
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        muted: "var(--muted)",
        accent: "var(--accent)",
        "text-primary": "var(--text-primary)",
        "text-secondary": "var(--text-secondary)",
        "accent-amber": "var(--accent-amber)",
        "accent-moss": "var(--accent-moss)",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        elevated: "var(--shadow-elevated)",
      },
      borderRadius: {
        theme: "var(--radius)",
      },
      backgroundImage: {
        "paper-grain": "var(--paper-grain)",
      },
    },
  },
};

export default config;
