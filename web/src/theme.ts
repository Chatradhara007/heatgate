// Design tokens from DESIGN.md. tailwind.config.ts turns these into Tailwind classes.
// For charts (recharts) and inline styles, import the tokens from here.
import type { Outcome } from "@heatgate/contracts";

export const designTokens = {
  colors: {
    // DESIGN.md palette
    surface: "#f7f9ff",
    "surface-dim": "#d7dae0",
    "surface-bright": "#f7f9ff",
    "surface-container-lowest": "#ffffff",
    "surface-container-low": "#f1f4f9",
    "surface-container": "#ebeef3",
    "surface-container-high": "#e5e8ee",
    "surface-container-highest": "#e0e3e8",
    "surface-variant": "#e0e3e8",
    "on-surface": "#181c20",
    "on-surface-variant": "#3e4947",
    "inverse-surface": "#2d3135",
    "inverse-on-surface": "#eef1f6",
    outline: "#6e7977",
    "outline-variant": "#bdc9c6",
    "surface-tint": "#006a63",
    primary: "#005c55",
    "on-primary": "#ffffff",
    "primary-container": "#0f766e",
    "on-primary-container": "#a3faef",
    "inverse-primary": "#80d5cb",
    secondary: "#0051d5",
    "on-secondary": "#ffffff",
    "secondary-container": "#316bf3",
    "on-secondary-container": "#fefcff",
    tertiary: "#7d4200",
    "on-tertiary": "#ffffff",
    "tertiary-container": "#a15600",
    "on-tertiary-container": "#ffe6d5",
    error: "#ba1a1a",
    "on-error": "#ffffff",
    "error-container": "#ffdad6",
    "on-error-container": "#93000a",
    "primary-fixed": "#9cf2e8",
    "primary-fixed-dim": "#80d5cb",
    "on-primary-fixed": "#00201d",
    "on-primary-fixed-variant": "#00504a",
    "secondary-fixed": "#dbe1ff",
    "secondary-fixed-dim": "#b4c5ff",
    "on-secondary-fixed": "#00174b",
    "on-secondary-fixed-variant": "#003ea8",
    "tertiary-fixed": "#ffdcc3",
    "tertiary-fixed-dim": "#ffb77d",
    "on-tertiary-fixed": "#2f1500",
    "on-tertiary-fixed-variant": "#6e3900",
    background: "#f7f9ff",
    "on-background": "#181c20",
  },
  spacing: {
    margin: "2rem",
    "margin-mobile": "1rem",
    gutter: "1.5rem",
    "gutter-mobile": "1rem",
    "space-xs": "0.5rem",
    "space-sm": "0.75rem",
    "space-md": "1rem",
    "space-lg": "1.5rem",
    "space-xl": "2rem",
    "space-2xl": "3rem",
  },
  radii: {
    DEFAULT: "0.25rem",
    sm: "0.25rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    full: "9999px",
  },
  fontSizes: {
    "headline-xl": ["48px", { lineHeight: "56px", letterSpacing: "-0.02em", fontWeight: "700" }],
    "headline-lg": ["32px", { lineHeight: "40px", letterSpacing: "-0.01em", fontWeight: "700" }],
    "headline-md": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "600" }],
    "body-lg": ["20px", { lineHeight: "30px", fontWeight: "400" }],
    "body-md": ["18px", { lineHeight: "28px", fontWeight: "400" }],
    "body-sm": ["16px", { lineHeight: "24px", fontWeight: "500" }],
    "metric-xl": ["48px", { lineHeight: "52px", letterSpacing: "-0.03em", fontWeight: "700" }],
    "metric-lg": ["32px", { lineHeight: "38px", letterSpacing: "-0.02em", fontWeight: "700" }],
    "metric-md": ["20px", { lineHeight: "26px", fontWeight: "600" }],
    "code-sm": ["16px", { lineHeight: "22px", fontWeight: "500" }],
  },
} as const;

export const colors = {
  // Legacy / convenience tokens
  surface: "#FFFBF5",
  panel: "#FFFFFF",
  border: "#E7DED2",
  ink: "#1F1A17",
  inkMuted: "#6B6158",
  brand: "#0F766E", // updated to match DESIGN.md deep teal primary
  brandDark: "#0B4F4A",
  cool: "#2563EB",
  danger: "#DC2626",
  warning: "#D97706",
  success: "#2563EB",

  // DESIGN.md tokens included
  ...designTokens.colors,
} as const;

// Reserved State Taxonomy from DESIGN.md:
// - Idle / Skip Order: Neutral Grey #6B7280 (Surface: #F3F4F6, Foreground: #374151)
// - Delivering / Allow: Active Blue #2563EB (Surface: #EFF6FF, Foreground: #1D4ED8)
// - Resting / Force Rest: Cautionary Amber #D97706 (Surface: #FEF3C7, Foreground: #92400E)
// - Paused / Deny: Critical Red #DC2626 (Surface: #FEE2E2, Foreground: #991B1B)
export const outcomeColors: Record<Outcome, string> = {
  ALLOW: "#2563EB", // Active blue: delivering / order given
  SKIP_ORDER: "#6B7280", // Neutral grey: idle / skipped
  DENY: "#DC2626", // Critical red: paused
  FORCE_REST: "#D97706", // Cautionary amber: cooling break
};

export const outcomeLabels: Record<Outcome, string> = {
  ALLOW: "Order given",
  SKIP_ORDER: "Order skipped",
  DENY: "Paused",
  FORCE_REST: "Cooling break",
};

// Heat index bands for the heat scale (°C)
export const heatBands = [
  { fromC: -Infinity, color: "#2563EB" },
  { fromC: 32, color: "#D97706" },
  { fromC: 38, color: "#0F766E" },
  { fromC: 44, color: "#DC2626" },
] as const;

export const spacing = {
  xs: "4px",
  sm: "8px",
  md: "16px",
  lg: "24px",
  xl: "32px",
  "2xl": "48px",
  ...designTokens.spacing,
} as const;

export const radii = {
  sm: "4px",
  md: "8px",
  lg: "16px",
  ...designTokens.radii,
} as const;

export const fonts = {
  sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
  display: ["Bebas Neue", "Inter", "system-ui", "sans-serif"],
  mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
  "headline-xl": ["Inter"],
  "headline-lg": ["Inter"],
  "headline-md": ["Inter"],
  "body-lg": ["Inter"],
  "body-md": ["Inter"],
  "body-sm": ["Inter"],
  "metric-xl": ["JetBrains Mono"],
  "metric-lg": ["JetBrains Mono"],
  "metric-md": ["JetBrains Mono"],
  "code-sm": ["JetBrains Mono"],
} as const;

export const fontSizes = {
  xs: "12px",
  sm: "14px",
  base: "16px",
  lg: "20px",
  xl: "24px",
  "2xl": "32px",
  ...designTokens.fontSizes,
} as const;

// Tailwind class names for outcome colours
export const outcomeBgClass: Record<Outcome, string> = {
  ALLOW: "bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]",
  SKIP_ORDER: "bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]",
  DENY: "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]",
  FORCE_REST: "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]",
};
