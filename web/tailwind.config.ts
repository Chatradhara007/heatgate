// Tailwind uses the tokens in src/theme.ts.
import type { Config } from "tailwindcss";
import { colors, fontSizes, fonts, outcomeColors, radii, spacing } from "./src/theme.ts";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ...colors,
        ink: { DEFAULT: colors.ink, muted: colors.inkMuted },
        brand: { DEFAULT: colors.brand, dark: colors.brandDark },
        outcome: {
          allow: outcomeColors.ALLOW,
          "skip-order": outcomeColors.SKIP_ORDER,
          deny: outcomeColors.DENY,
          "force-rest": outcomeColors.FORCE_REST,
        },
      },
      spacing,
      borderRadius: radii,
      fontFamily: {
        sans: [...fonts.sans],
        display: [...fonts.display],
        mono: [...fonts.mono],
        "headline-xl": ["Inter", "sans-serif"],
        "headline-lg": ["Inter", "sans-serif"],
        "headline-md": ["Inter", "sans-serif"],
        "body-lg": ["Inter", "sans-serif"],
        "body-md": ["Inter", "sans-serif"],
        "body-sm": ["Inter", "sans-serif"],
        "metric-xl": ["JetBrains Mono", "monospace"],
        "metric-lg": ["JetBrains Mono", "monospace"],
        "metric-md": ["JetBrains Mono", "monospace"],
        "code-sm": ["JetBrains Mono", "monospace"],
      },
      fontSize: fontSizes,
    },
  },
  plugins: [],
} satisfies Config;
