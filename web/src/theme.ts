// Design tokens. tailwind.config.ts turns these into Tailwind classes, so use classes like
// `bg-outcome-force-rest`, `text-ink-muted`, `p-md` or `font-display` instead of raw values.
// For charts (recharts) and inline styles, import the tokens from here.
import type { Outcome } from "@heatgate/contracts";

export const colors = {
  // surfaces and text
  surface: "#FFFBF5", // page background, warm off-white
  panel: "#FFFFFF", // cards and panels
  border: "#E7DED2",
  ink: "#1F1A17", // main text
  inkMuted: "#6B6158", // secondary text
  // brand: heat
  brand: "#E4572E", // heat orange
  brandDark: "#B23A1A",
  cool: "#2E86AB", // shade, water, rest
  // status
  danger: "#C0392B",
  warning: "#E9A23B",
  success: "#2F9E44",
} as const;

// One colour per Decision.outcome. Keep these distinct for colour-blind users (also show the label).
export const outcomeColors: Record<Outcome, string> = {
  ALLOW: "#2F9E44", // green: order given
  SKIP_ORDER: "#E9A23B", // amber: too far for the heat, stays online
  DENY: "#C0392B", // red: paused 15 minutes
  FORCE_REST: "#2E86AB", // blue: cooling break
};

export const outcomeLabels: Record<Outcome, string> = {
  ALLOW: "Order given",
  SKIP_ORDER: "Order skipped",
  DENY: "Paused",
  FORCE_REST: "Cooling break",
};

// Heat index bands for the heat scale (°C, a proxy for outdoor heat stress, not a medical measure).
export const heatBands = [
  { fromC: -Infinity, color: "#2E86AB" },
  { fromC: 32, color: "#E9A23B" },
  { fromC: 38, color: "#E4572E" },
  { fromC: 46, color: "#7B1E12" },
] as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "48px",
} as const;

export const radii = {
  sm: "4px",
  md: "8px",
  lg: "16px",
} as const;

export const fonts = {
  sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
  display: ["Inter", "system-ui", "sans-serif"],
  mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
} as const;

export const fontSizes = {
  xs: "12px",
  sm: "14px",
  base: "16px",
  lg: "20px",
  xl: "24px",
  "2xl": "32px",
} as const;

// Tailwind class names for the outcome colours, written out in full so Tailwind finds them.
export const outcomeBgClass: Record<Outcome, string> = {
  ALLOW: "bg-outcome-allow",
  SKIP_ORDER: "bg-outcome-skip-order",
  DENY: "bg-outcome-deny",
  FORCE_REST: "bg-outcome-force-rest",
};
