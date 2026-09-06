---
name: LabSense - AI Lab Assistant
description: Clean, high-trust glassmorphic healthcare design system for medical report analysis & RAG reasoning
colors:
  primary: "#6366f1"
  primary-glow: "#8b5cf6"
  accent-pink: "#d946ef"
  success: "#10b981"
  warning: "#f59e0b"
  destructive: "#ef4444"
  neutral-bg: "#f8fafc"
  neutral-card: "#ffffff"
  neutral-text: "#0f172a"
  neutral-muted: "#64748b"
  border: "#e2e8f0"
typography:
  display:
    fontFamily: "Urbanist, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 800
    lineHeight: "1.15"
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Urbanist, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: "1.2"
  body:
    fontFamily: "Urbanist, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.5"
  label:
    fontFamily: "Urbanist, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.05em"
rounded:
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "12px 24px"
  button-primary-hover:
    backgroundColor: "{colors.primary-glow}"
  card-glass:
    backgroundColor: "{colors.neutral-card}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: LabSense - AI Lab Assistant

## Overview

**Creative North Star: "LabSense Mindful Clinical Assistant"**

LabSense is designed as a calm, high-trust clinical workspace combining glassmorphic translucency, rich atmospheric lighting, and high-contrast status triage. It blends modern AI intelligence with strict clinical clarity, avoiding cluttered spreadsheets or clinical starkness.

The visual language relies on soft glass containers (`glass-card`, `glass-panel`), generous 3xl rounded corners (32px), indigo-to-purple primary gradients, and explicit status pills (emerald for normal, rose for abnormal).

### Key Characteristics:
- **Glassmorphic Precision:** Translucent backdrops (`backdrop-blur-xl`) with subtle 1px border highlights.
- **High-Trust Triage:** Color-coded status badges for instant patient & practitioner orientation.
- **Fluid Typography:** Clean, modern Urbanist typography with crisp hierarchy.
- **Dual Light/Dark Adaptability:** Dedicated light mode background ambient lights and obsidian dark theme (`#090d16`).

## Colors

The color palette centers on vibrant indigo and purple for intelligence, emerald for clinical normal states, and rose/amber for attention-required triage.

### Primary
- **LabSense Indigo** (`#6366f1` / `var(--primary)`): Primary action buttons, active navigation states, and focal glows.
- **Violet Glow** (`#8b5cf6` / `var(--primary-glow)`): Gradient endpoints and secondary accent highlights.

### Secondary
- **Emerald Health** (`#10b981` / `var(--success)`): Normal clinical status badges, positive verification badges, and success notifications.

### Tertiary
- **Amber Warning** (`#f59e0b` / `var(--warning)`): Admin alerts and differential diagnosis indicators.

### Neutral
- **Slate Text** (`#0f172a` / `var(--foreground)`): Primary readable headings and data labels.
- **Muted Subtext** (`#64748b` / `var(--muted-foreground)`): Secondary copy, reference range indicators, and timestamps.
- **Glass Border** (`#e2e8f0` / `var(--border)`): Translucent 1px borders defining card containers.

### Named Rules
**The Triage Hierarchy Rule.** The primary indigo accent is reserved for key actions and brand presence. Clinical status colors (emerald for normal, rose for abnormal) strictly communicate medical triage data and must never be repurposed for decorative highlights.

## Typography

**Display Font:** Urbanist (with Inter, sans-serif fallbacks)  
**Body Font:** Urbanist (with -apple-system, BlinkMacSystemFont, Roboto, sans-serif)  
**Label/Mono Font:** Urbanist / System Monospace for OTP codes and raw values.

### Hierarchy
- **Display** (ExtraBold 800, clamp(2rem, 5vw, 3rem), 1.15): Page titles and primary hero headings.
- **Headline** (Bold 700, 1.5rem, 1.2): Section titles, modal headers, and report card titles.
- **Title** (Bold 700, 1.125rem, 1.3): Card section headers and sub-panel titles.
- **Body** (Medium 500 / Regular 400, 0.875rem, 1.5): Findings summaries, medical rationale, and chat messages.
- **Label** (Bold 700, 0.75rem, 0.05em, uppercase): Status badges, tab pills, and data field labels.

### Named Rules
**The Scannable Medical Value Rule.** Extracted test parameters must pair a bold numerical value (`text-3xl font-extrabold`) with a explicit status badge (`normal` / `low` / `high`) and muted reference interval text (`text-xs text-muted-foreground`).

## Layout

Layouts use a responsive container grid with dynamic padding (`px-4 sm:px-6 py-8`). 

- **Desktop Top Navigation:** Glassmorphic sticky header (`glass-panel h-20`) with branded logo, central navigation pills, user profile, and theme toggle.
- **Dashboard Grid:** 3-column top stat cards leading into structured 2-column and 3-column parameter grids.
- **Assistant Grid:** 1-column left sidebar for recent chat threads (with delete thread actions) + 3-column right workspace for active chat streaming and medical reasoning.

## Elevation & Depth

Depth is achieved through a combination of backdrop glass blur, subtle 1px border strokes, and targeted glow effects (`glow-indigo`, `glow-emerald`).

### Shadow Vocabulary
- **Card Shadow** (`0 4px 20px -2px rgba(0, 0, 0, 0.06)` in light mode, `0 8px 32px 0 rgba(0, 0, 0, 0.36)` in dark mode): Standard container depth.
- **Indigo Glow** (`0 0 25px -5px rgba(99, 102, 241, 0.35)`): Ambient hover glow around primary action buttons and active brand icons.

### Named Rules
**The Flat-Rest Glow-State Rule.** Cards remain resting on a subtle glass plane with a 1px border. Ambient glows appear strictly on hover, active state, or key brand moments.

## Shapes

- **Card Radius:** Generous 3xl corners (`rounded-3xl` / 24px - 32px).
- **Control Radius:** 2xl corners (`rounded-2xl` / 16px) for inputs, buttons, and status pills.
- **Borders:** 1px subtle translucent border strokes (`border border-border` or `border-indigo-500/30`).

## Components

### Buttons
- **Shape:** `rounded-2xl` (16px radius)
- **Primary:** `bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 text-white font-bold px-6 py-3 shadow-xl glow-indigo`
- **Hover / Focus:** Scale `scale-[1.02]`, hover opacity shift, visible ring on focus.
- **Outline / Secondary:** `border border-border bg-card text-foreground hover:bg-muted`

### Cards / Containers
- **Corner Style:** `rounded-3xl` (24px - 32px)
- **Background:** `glass-card` (translucent backdrop blur with linear gradient overlay)
- **Border:** `1px solid var(--border)`
- **Internal Padding:** `p-6` (24px)

### Status Badges
- **Normal:** `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-bold rounded-full px-2.5 py-0.5`
- **Abnormal (Low/High):** `bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[11px] font-bold rounded-full px-2.5 py-0.5`

### Inputs / Fields
- **Style:** `bg-muted/50 border border-border text-foreground text-sm rounded-2xl h-11 px-4`
- **Focus:** `focus-visible:ring-2 focus-visible:ring-indigo-500`

### Navigation
- **Header Nav:** Glassmorphic bar with pill-shaped active routes (`bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md`).

## Do's and Don'ts

### Do:
- **Do** use `glass-card` and `rounded-3xl` for major content containers to maintain design continuity.
- **Do** pair every extracted health parameter with a clear status badge (`normal`, `low`, or `high`).
- **Do** provide keyboard accessibility and focus rings on all interactive elements.

### Don't:
- **Don't** use raw unformatted JSON or unstyled tables for lab report metrics.
- **Don't** use red or green status colors for decorative non-medical elements.
- **Don't** remove the medical disclaimer footer from diagnostic or assistant surfaces.
