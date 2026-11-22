---
version: alpha
name: House-Default
description: Global fallback design system for any project that has no DESIGN.md of its own. A calm, technical look built on a warm off-white (or deep graphite in dark mode), one confident teal accent, a geometric sans for UI, and a monospace face for data, labels and code. Built for dashboards, tools, IoT panels and product sites that should feel engineered, not templated.

colors:
  # Light theme
  canvas: "#FAFAF7"
  surface: "#FFFFFF"
  surface-sunken: "#F2F2EE"
  ink: "#16181D"
  body: "#3D424D"
  mute: "#6B7280"
  hairline: "#E4E4DE"
  hairline-strong: "#C9C9C1"
  control-border: "#8C8C7B"
  primary: "#0E7C74"
  primary-hover: "#0A635D"
  primary-soft: "#D7EFEC"
  primary-ink: "#0D756E"
  on-primary: "#FFFFFF"
  accent: "#E8590C"
  accent-soft: "#FDE6D8"
  accent-ink: "#B34509"
  success: "#2F9E44"
  success-soft: "#DDF3E1"
  success-ink: "#247934"
  warning: "#C77700"
  warning-soft: "#FCEFD5"
  warning-ink: "#9C5D00"
  danger: "#D6336C"
  danger-soft: "#FBE0EA"
  danger-ink: "#BF265C"
  info: "#1C7ED6"
  info-soft: "#DCEBFA"
  info-ink: "#186AB4"
  focus-ring: "#0E7C74"
  # Dark theme
  dark-canvas: "#0F1115"
  dark-surface: "#171A20"
  dark-surface-raised: "#1E222A"
  dark-ink: "#ECEDEF"
  dark-body: "#B4B9C3"
  dark-mute: "#7D8491"
  dark-hairline: "#2A2F38"
  dark-control-border: "#616C81"
  dark-primary: "#2DB8AC"
  dark-primary-hover: "#4FCFC4"
  dark-on-primary: "#06201E"
  dark-accent: "#FF8A3D"
  dark-success: "#2F9E44"
  dark-warning: "#C77700"
  dark-danger: "#DF5D8B"
  dark-info: "#2F8EE4"

typography:
  display-xl:
    fontFamily: "Space Grotesk, Inter, system-ui, sans-serif"
    fontSize: 56px
    fontWeight: 600
    lineHeight: 60px
    letterSpacing: -1.6px
  display-lg:
    fontFamily: "Space Grotesk, Inter, system-ui, sans-serif"
    fontSize: 40px
    fontWeight: 600
    lineHeight: 46px
    letterSpacing: -1px
  heading-1:
    fontFamily: "Space Grotesk, Inter, system-ui, sans-serif"
    fontSize: 28px
    fontWeight: 600
    lineHeight: 34px
    letterSpacing: -0.4px
  heading-2:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: -0.2px
  heading-3:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 24px
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 15px
    fontWeight: 400
    lineHeight: 24px
  body-sm:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 20px
  label:
    fontFamily: "JetBrains Mono, ui-monospace, Consolas, monospace"
    fontSize: 11px
    fontWeight: 500
    lineHeight: 16px
    letterSpacing: 0.8px
    textTransform: uppercase
  data:
    fontFamily: "JetBrains Mono, ui-monospace, Consolas, monospace"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
    fontVariantNumeric: tabular-nums
  metric:
    fontFamily: "Space Grotesk, Inter, system-ui, sans-serif"
    fontSize: 36px
    fontWeight: 600
    lineHeight: 40px
    letterSpacing: -0.8px
    fontVariantNumeric: tabular-nums

spacing:
  unit: 4px
  scale: [0, 4, 8, 12, 16, 24, 32, 48, 64, 96]

radius:
  none: 0px
  sm: 6px
  md: 10px
  lg: 14px
  pill: 999px

shadow:
  none: "none"
  raised: "0 1px 2px rgba(22,24,29,0.06), 0 1px 1px rgba(22,24,29,0.04)"
  overlay: "0 12px 32px rgba(22,24,29,0.14), 0 2px 6px rgba(22,24,29,0.08)"

motion:
  fast: 120ms
  base: 200ms
  slow: 320ms
  easing: "cubic-bezier(0.2, 0, 0, 1)"
---

# House Default Design System

## Overview

This is the fallback look for every project that does not ship its own DESIGN.md. The goal is an interface that reads as engineered and deliberate: warm neutral surfaces, a single teal accent that carries all interactive meaning, generous but disciplined spacing, and monospace for anything that is data. It suits web apps, admin panels, IoT and sensor dashboards, and simple product sites. It deliberately avoids the common AI-generated look: no purple-to-blue gradients, no glassmorphism cards on cards, no emoji as icons, no centered hero with three identical feature cards underneath.

## Colors

### Brand and Accent
- `primary` (teal) is the only color for interactive elements: primary buttons, links, active tabs, focus rings, selected states, toggles.
- `accent` (signal orange) is reserved for one thing per screen at most: a highlight badge, a live indicator, a key call-out. Never for buttons.
- Text on a soft background uses the matching `-ink` token: `primary-ink` on `primary-soft`, `accent-ink` on `accent-soft`.

### Surfaces
- Page background is `canvas`, content sits on `surface`. Use `surface-sunken` for wells, code blocks, table headers and input backgrounds in dense layouts.
- Separate regions with `hairline` borders first, shadows second. Most of the UI should have no shadow at all.
- `hairline` and `hairline-strong` are decorative dividers only. Borders that identify a control (inputs, selects, secondary buttons) use `control-border`, which meets 3:1.

### Text
- `ink` for headings and key values, `body` for paragraphs, `mute` for secondary labels, timestamps and placeholders.
- Never put `mute` text on `surface-sunken` or `dark-mute` text on `dark-surface-raised`; contrast drops below 4.5:1. Use `body` or `dark-body` there.

### Semantic
- `success`, `warning`, `danger`, `info` are status colors only. Use them for icons, dots, borders and fills, not for text: most fall below 4.5:1 as text.
- Status text uses the matching `-ink` token (`success-ink`, `warning-ink`, `danger-ink`, `info-ink`), on `canvas`, `surface`, `surface-sunken` or its `-soft` variant. Use the `-soft` variant as the background for badges and alerts.
- Status is never communicated by color alone: always add an icon or a text label.

### Dark Mode
- Dark mode is a first-class theme, not an inverted afterthought: surfaces step up in lightness as they rise (canvas < surface < surface-raised).
- Status and accent colors use `dark-success`, `dark-warning`, `dark-danger`, `dark-info` and `dark-accent` for both text and marks. Controls use `dark-control-border`.
- There are no dark `-soft` or `-ink` tokens. In dark mode, soft backgrounds become `dark-surface-raised`, with the matching dark color as text.
- Respect `prefers-color-scheme` and offer a manual toggle when the app has a settings area.

## Typography

### Font Family
- **Space Grotesk** for display, page titles and big metrics.
- **Inter** for all UI text and body copy.
- **JetBrains Mono** for labels, data values, IDs, timestamps, sensor readings and code.
- Load from Google Fonts or self-host; always keep the system fallbacks in the stack.

### Hierarchy
- One `display` size per page at most. Most screens start at `heading-1`.
- Uppercase mono `label` style is the signature detail: use it for section eyebrows, table column headers, form field labels in dense UIs and chart axis titles.
- Numbers that change (counters, prices, readings) use `tabular-nums` so they do not jitter.

### Principles
- Body line length 60 to 75 characters.
- Do not go below 13px for any readable text.
- Bold is for headings and key values, not for emphasis inside paragraphs; use `ink` color instead.

## Layout

### Spacing System
- 4px base unit. Use only the values in the `spacing.scale` token.
- Inside components: 8 to 16. Between components: 16 to 24. Between sections: 48 to 96.

### Grid and Container
- Max content width 1200px for apps, 1080px for marketing pages, 720px for long-form text.
- 12-column grid with 24px gutters on desktop, 4 columns with 16px gutters on mobile.
- Dashboards: a left sidebar (240px, collapsible to 64px) plus a fluid content area.

### Responsive Strategy
- Breakpoints: 640px (sm), 768px (md), 1024px (lg), 1280px (xl).
- Design mobile first. Every screen must work at 375px wide with no horizontal scroll.
- Touch targets are at least 44 by 44px.
- Tables collapse to stacked cards below 768px; sidebars become a top bar with a drawer.

## Elevation and Depth
- Level 0: flat with `hairline` border. This is the default for cards, panels and inputs.
- Level 1: `shadow.raised`. Only for elements that float above the flow: sticky headers, dropdown triggers in an open state.
- Level 2: `shadow.overlay`. Only for menus, popovers, dialogs and toasts.
- Never stack a shadowed card inside another shadowed card.

## Shapes
- `radius.md` (10px) is the default for cards, inputs and buttons.
- `radius.sm` for small elements: badges, chips, checkboxes, tooltips.
- `radius.pill` for status pills and toggles only.
- Icons: one outline icon set per project (Lucide by default), 1.5px stroke, sized 16 or 20px.

## Components

### Buttons
- Primary: `primary` background, `on-primary` text, 40px tall (36px in dense UIs), 16px horizontal padding, `radius.md`, weight 600.
- Secondary: `surface` background, `control-border` border, `ink` text.
- Ghost: no background or border, `primary` text; for tertiary actions and toolbars.
- Destructive: `danger` background, only inside a confirmation step.
- Every button has visible hover, active, focus-visible (2px `focus-ring` outline with 2px offset) and disabled states.
- One primary button per view region.

### Cards and Containers
- `surface` background, 1px `hairline` border, `radius.md`, 20 to 24px padding, no shadow.
- Card header: mono `label` eyebrow, then `heading-3` title, then optional `mute` description.

### Inputs and Forms
- 40px tall, `surface` background, 1px `control-border` border, `radius.md`.
- Focus: border becomes `primary` plus a 3px `primary-soft` ring.
- Labels sit above fields. Errors appear below in `danger-ink` with a `danger` icon, and the border turns `danger`.
- Always include helpful placeholder text and a clear empty state.

### Navigation
- Top bar 56px tall with a `hairline` bottom border, logo left, primary nav center or left, actions right.
- Active nav item: `ink` text with a 2px `primary` underline (top nav) or a `primary-soft` background pill (sidebar).

### Data Display
- Metric tiles: mono `label` on top, `metric` value, then a small delta in `success-ink` or `danger-ink` with an arrow icon.
- Tables: `surface-sunken` header row with mono `label` text in `body`, 48px rows, `hairline` row dividers, numeric columns right-aligned with `data` style.
- Charts: `primary` for the main series, then `info`, `accent`, `success`, `warning` in that order. Gridlines in `hairline`, no chart borders.
- Live or sensor values: show a small pulsing `success` dot next to the timestamp of the last update.

### Feedback
- Toasts bottom-right on desktop, top on mobile, auto-dismiss after 4s, `shadow.overlay`.
- Skeleton loaders in `surface-sunken` for anything that takes longer than 300ms.
- Every list and table has a designed empty state with an icon, one sentence and an action.

## Motion
- Use `motion.base` with the standard easing for most transitions; `motion.fast` for hover and press.
- Animate opacity and transform only. Respect `prefers-reduced-motion` by disabling non-essential animation.

## Do's and Don'ts

### Do
- Use the tokens above; do not invent new colors or spacing values.
- Keep one accent color doing one job.
- Use mono labels and tabular numbers for anything technical.
- Test every screen at 375px, 768px and 1280px, in light and dark mode.
- Hit WCAG AA contrast (4.5:1 for text, 3:1 for UI elements).

### Don't
- No purple or blue-to-purple gradients, no gradient text.
- No glassmorphism, no neon glows, no heavy drop shadows.
- No emoji as icons.
- No three identical feature cards in a row as the default layout.
- No placeholder lorem ipsum in delivered work; write real, specific copy.
- No more than two font weights visible in the same component.
