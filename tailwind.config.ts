import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bone:  "#f5f0e8",
        ink:   "#1a1814",
        gold:  "#b8904a",
        "gold-light": "#d4a96a",
        "gold-dark":  "#9a7338",
        "bone-dark":  "#ede8df",
        "bone-deeper":"#e0d9ce",
        "ink-light":  "#3a342e",
        "ink-muted":  "#6b6156",
      },
      fontFamily: {
        serif: ["var(--font-playfair)", "Georgia", "serif"],
        sans:  ["var(--font-dm-sans)", "system-ui", "sans-serif"],
      },
      letterSpacing: {
        widest2: "0.25em",
      },
    },
  },
  plugins: [],
};
export default config;
