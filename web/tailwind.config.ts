import type { Config } from "tailwindcss";

/* Colours are the design system's custom properties, so every utility follows the light and dark
   palettes. The old names are kept so the pages keep working: paper/card/ink/body/muted/rule,
   brick (the accent), steel (the honest data colour), forest (good), amber (warn). */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--bg)",
        card: "var(--surface)",
        ink: "var(--ink)",
        body: "var(--ink)",
        muted: "var(--muted)",
        rule: "var(--rule)",
        steel: "var(--data)",
        brick: "var(--accent)",
        forest: "var(--good)",
        amber: "var(--warn)",
        field: "var(--field)",
      },
      fontFamily: {
        serif: ["var(--font-erode)", "Georgia", "serif"],
        sans: ["var(--font-erode)", "Georgia", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      fontSize: {
        small: ["var(--step-small)", { lineHeight: "1.45" }],
        body: ["var(--step-body)", { lineHeight: "1.5" }],
        lead: ["var(--step-lead)", { lineHeight: "1.35" }],
        head: ["var(--step-head)", { lineHeight: "1.04" }],
        display: ["var(--step-display)", { lineHeight: "0.98" }],
      },
      maxWidth: { prose: "62ch", wide: "80rem" },
      borderRadius: { DEFAULT: "0px", sm: "0px", md: "0px", lg: "0px", full: "9999px" },
    },
  },
  plugins: [],
} satisfies Config;
