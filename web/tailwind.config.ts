// Tailwind uses the tokens in src/theme.ts. Change tokens there, not here.
import type { Config } from "tailwindcss";
import { colors, fontSizes, fonts, outcomeColors, radii, spacing } from "./src/theme.ts";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: colors.surface,
        panel: colors.panel,
        border: colors.border,
        ink: { DEFAULT: colors.ink, muted: colors.inkMuted },
        brand: { DEFAULT: colors.brand, dark: colors.brandDark },
        cool: colors.cool,
        danger: colors.danger,
        warning: colors.warning,
        success: colors.success,
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
      },
      fontSize: fontSizes,
    },
  },
  plugins: [],
} satisfies Config;
