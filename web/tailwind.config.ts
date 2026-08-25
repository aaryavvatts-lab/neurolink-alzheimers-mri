import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#FBFAF7",
        card: "#FFFFFF",
        ink: "#17181B",
        body: "#33363D",
        muted: "#666C77",
        rule: "#E1DED5",
        steel: "#1D5B8F",
        brick: "#A03027",
        forest: "#2C6E4E",
        amber: "#9C6F13",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      maxWidth: { prose: "37rem", wide: "62rem" },
    },
  },
  plugins: [],
} satisfies Config;
