---
name: HeatGate Policy System
colors:
  surface: '#f7f9ff'
  surface-dim: '#d7dae0'
  surface-bright: '#f7f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f1f4f9'
  surface-container: '#ebeef3'
  surface-container-high: '#e5e8ee'
  surface-container-highest: '#e0e3e8'
  on-surface: '#181c20'
  on-surface-variant: '#3e4947'
  inverse-surface: '#2d3135'
  inverse-on-surface: '#eef1f6'
  outline: '#6e7977'
  outline-variant: '#bdc9c6'
  surface-tint: '#006a63'
  primary: '#005c55'
  on-primary: '#ffffff'
  primary-container: '#0f766e'
  on-primary-container: '#a3faef'
  inverse-primary: '#80d5cb'
  secondary: '#0051d5'
  on-secondary: '#ffffff'
  secondary-container: '#316bf3'
  on-secondary-container: '#fefcff'
  tertiary: '#7d4200'
  on-tertiary: '#ffffff'
  tertiary-container: '#a15600'
  on-tertiary-container: '#ffe6d5'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#9cf2e8'
  primary-fixed-dim: '#80d5cb'
  on-primary-fixed: '#00201d'
  on-primary-fixed-variant: '#00504a'
  secondary-fixed: '#dbe1ff'
  secondary-fixed-dim: '#b4c5ff'
  on-secondary-fixed: '#00174b'
  on-secondary-fixed-variant: '#003ea8'
  tertiary-fixed: '#ffdcc3'
  tertiary-fixed-dim: '#ffb77d'
  on-tertiary-fixed: '#2f1500'
  on-tertiary-fixed-variant: '#6e3900'
  background: '#f7f9ff'
  on-background: '#181c20'
  surface-variant: '#e0e3e8'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '400'
    lineHeight: 30px
  body-md:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  metric-xl:
    fontFamily: JetBrains Mono
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 52px
    letterSpacing: -0.03em
  metric-lg:
    fontFamily: JetBrains Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  metric-md:
    fontFamily: JetBrains Mono
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 22px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
---

## Brand & Style

This design system is tailored for institutional civic technology, evidence-based labor safety research, and urban policy simulation. Designed to support municipal bodies, logistics aggregators, and labor advocates monitoring occupational heat exposure for delivery riders across India, the interface prioritizes high-legibility governance over commercial decoration.

The visual style is characterized by functional minimalism, calibrated structure, and high contrast suitable for projector rooms and communal decision-making environments. Surfaces prioritize non-fatiguing paper-like warmth, absolute semantic clarity, and strict state discipline. Every element conveys statistical rigor, ethical responsibility, and human safety without visual melodrama, gradients, or non-functional embellishments.

## Colors

The system uses a strictly controlled semantic palette designed for long-distance legibility (3 to 6 meters) under uneven projection conditions. Ambient background glare is mitigated using an unbleached paper surface, while text contrast strictly meets or exceeds WCAG AAA criteria.

### Foundation & Surfaces
- **Page Canvas:** `#FAFAF7` (warm off-white foundation that eliminates eye strain).
- **Surface Elevation:** `#FFFFFF` (clean surface container).
- **Card & Division Stroke:** `#E3E1DA` (neutral structural rule).

### Typography Tiers
- **Primary Text:** `#1B1F23` (deep slate-black; used for headlines, core metrics, body copy).
- **Secondary Text:** `#4B5563` (accessible mid-tone slate; strictly no lighter grey is permitted anywhere in the system).

### Primary Actions & Policy State
- **Brand Accent (HeatGate Fair & Primary Actions):** Deep Teal `#0F766E`, subtle container `#E6F4F1`, interactive hover `#0B4F4A`.

### Reserved State Taxonomy (Functional Exclusivity)
These colors are strictly reserved for rider lifecycle and simulated policy outcomes. They must never appear as decorative flourishes, marketing highlights, or ambient backgrounds:
- **Idle / Skip Order:** Neutral Grey `#6B7280` (Surface: `#F3F4F6`, Foreground: `#374151`).
- **Delivering / Allow:** Active Blue `#2563EB` (Surface: `#EFF6FF`, Foreground: `#1D4ED8`).
- **Resting / Force Rest:** Cautionary Amber `#D97706` (Surface: `#FEF3C7`, Foreground: `#92400E`).
- **Paused / Deny:** Critical Red `#DC2626` (Surface: `#FEE2E2`, Foreground: `#991B1B`).

## Typography

Typography is scaled specifically for institutional presentation rooms, projection units, and large displays. Minimum font sizes ensure legibility at standard briefing distances (3 to 6 meters).

- **UI Headings & Interface Copy:** Set in `Inter` with optical kerning, balanced ascenders, and tabular figures enabled for quantitative layouts.
- **Data, Simulation Telemetry & Identifiers:** Set in `JetBrains Mono` with fixed-width numerals (`tnum`) to eliminate layout jitter when real-time simulation counters shift.
- **Multilingual Script Support:** Indian regional localizations must pair directly with `Noto Sans Devanagari` and `Noto Sans Telugu` at matched cap-heights and line heights (+2px extra line-height allowance for conjunct glyphs).

### Sizing Scale & Usage Rules
- **Large Telemetry Metrics (`metric-xl`, `metric-lg`):** Reserved for wet-bulb globe temperature (WBGT), heat index, and active fleet counts. Always monospaced.
- **Page Titles (`headline-lg`):** Fixed at 32px for unambiguous identification from the back of the conference room.
- **Section Headers (`headline-md`):** Fixed at 24px.
- **Body & Table Cells (`body-md`):** Hard floor of 18px. Never reduce table cell fonts below 18px.
- **Captions, Microcopy & Timestamps (`body-sm`, `code-sm`):** Hard floor of 16px. Typography smaller than 16px is prohibited across all screens.

## Layout & Spacing

The layout is built upon an architectural 12-column grid system capped at a maximum width of 1440px to preserve data density and maintain ergonomic glanceability during presentations.

### Grid & Canvas Structure
- **Max Width:** `1440px`, centered with fluid margins on ultra-wide viewports.
- **Columns & Gutters:** 12 columns with uniform 24px (`1.5rem`) gutters on desktop screens (>1024px); 8 columns with 20px gutters on mid-size monitors/tablets; 4 columns with 16px gutters on mobile viewports.
- **Canvas Edge Margins:** Minimum 32px (`2rem`) horizontal buffer to prevent edge-clipping on projector bezels.

### Interactive Rhythm
- **Minimum Interactive Dimension:** Every touch or click target must measure a minimum of 48px by 48px to accommodate both field touchscreens and rapid pointer control during live demonstrations.
- **Vertical Hierarchy:** Group parameters and statistical panels using consistent 24px (`space-lg`) or 32px (`space-xl`) intervals.

## Elevation & Depth

Visual depth is conveyed through tactile structural framing rather than heavy drop shadows or blurred surfaces. This maintains boundary sharpness through lower-lumen digital projectors.

- **Surface Delineation:** All cards and data modules use a mandatory 1px solid `#E3E1DA` perimeter border.
- **Base Surface Elevation:** Level-1 panels feature a subtle ambient elevation: `0 1px 3px 0 rgba(27, 31, 35, 0.04), 0 1px 2px -1px rgba(27, 31, 35, 0.04)`.
- **Flyout & Inspector Elevation:** Flyouts, tooltips, and modal overlays use: `0 4px 6px -1px rgba(27, 31, 35, 0.06), 0 2px 4px -2px rgba(27, 31, 35, 0.04)` combined with a 1px solid `#D1CEC4` border.
- **Restricted Techniques:** Glassmorphism, blurred backdrop filters, neomorphic extrusions, high-glow lighting, and decorative drops are strictly forbidden.

## Shapes

The geometric framework balances institutional authority with accessible civic software ergonomics. 

- **Cards & Data Modules:** Uniform corner radius of 12px (`rounded-lg`), establishing stable containers that resist physical corner harshness while preserving tabular order.
- **Badges, Chips & Form Fields:** 8px radius (`rounded-md`) for controls and categorical chips. Badges strictly avoid circular pill geometries to distinguish themselves from generic social or consumer interfaces.
- **Action Buttons:** 8px radius (`rounded-md`), preserving structural coherence with form inputs.
- **Dividers:** 1px solid stroke with square endings, strictly aligned to the horizontal and vertical grid columns.

## Components

### Buttons & Interactive Controls
- **Primary Action (Deep Teal):** `#0F766E` background with `#FFFFFF` text. Minimum height of 48px, minimum horizontal padding of 24px (`space-lg`), 8px corner radius. Hover state transitions to `#0B4F4A`. Focus ring: 2px solid `#0F766E` with 2px offset in `#FAFAF7`.
- **Secondary Action:** Transparent fill, 1px solid `#E3E1DA` border, `#1B1F23` text. Hover state switches background to `#F3F4F6`.
- **Destructive/Emergency Action:** `#DC2626` background, `#FFFFFF` text. Reserved strictly for overriding policies or shutting down dispatch pipelines.

### Policy Badges & Status Chips
Badges represent policy mandates and rider conditions. They must never appear as unadorned text or icon-only symbols; they require both a 2px stroke Lucide icon and an explicit text label.
- **ALLOW Badge:** `#EFF6FF` background, `#1D4ED8` text and icon (Lucide `CheckCircle2`), 1px solid `#BFDBFE` border.
- **FORCE_REST Badge:** `#FEF3C7` background, `#92400E` text and icon (Lucide `PauseCircle`), 1px solid `#FDE68A` border.
- **DENY Badge:** `#FEE2E2` background, `#991B1B` text and icon (Lucide `ShieldAlert`), 1px solid `#FECACA` border.
- **SKIP_ORDER Badge:** `#F3F4F6` background, `#374151` text and icon (Lucide `SkipForward`), 1px solid `#E5E7EB` border.
- Badge sizing: Height 36px, font size 16px (weight 600), icon size 18px (2px stroke), padding 6px 12px.

### Form Inputs & Policy Sliders
- **Numeric & Policy Inputs:** Minimum height 48px, white background `#FFFFFF`, 1px solid `#E3E1DA` border, 8px corner radius, text size 18px. Active focus: 2px solid `#0F766E`.
- **Heat Threshold Sliders:** Solid 6px track `#E3E1DA` with segmented color ranges for danger zones. Draggable thumb handle measures 24px in diameter with high-contrast `#1B1F23` border.

### Telemetry & Simulation Data Cards
- Container constructed of `#FFFFFF`, 12px radius, 1px `#E3E1DA` border.
- Headers feature 20px uppercase section subtitles (`#4B5563`) paired with a 2px stroke Lucide icon.
- Central quantitative readouts utilize `JetBrains Mono` at 32px or 48px with explicit unit annotations (e.g., `°C`, `min`, `riders`).

### Tables & Rider Rosters
- Row height: Minimum 56px to ensure high hit targets and readability.
- Border-bottom: 1px solid `#E3E1DA`.
- Cell typography: 18px `Inter` for names/locations; 18px `JetBrains Mono` for rider IDs and durations.
- Alternate zebra striping is omitted; hover states use `#F7F7F4` highlight.