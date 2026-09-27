---
version: 1.0.0
name: Tactile Ambient Radio System (WJRH)
description: A deeply immersive, dark-mode canvas utilizing fluid WebGL liquid-metal elements, organic typography weights, and strict functional constraints. Designed for a science-backed, low-stimulus listening experience where the UI acts as a breathing material rather than a digital screen.

tokens:
  colors:
    primary: "#FFFFFF"       # High-contrast elements, critical typography
    background: "#0A0A0E"    # Deep space obsidian canvas (Base App layer)
    surface: "#12121A"       # Elevated module/card backgrounds
    surface-muted: "#1A1A26" # Inner containers, borders, or inactive states
    accent: "#6366F1"        # Indigo biometric pulses & active indicators
    text:
      primary: "#FFFFFF"
      secondary: "#8E8E9F"
      muted: "#52526B"
    semantic:
      focus: "#818CF8"       # Live broadcasting / High-focus states
      relax: "#34D399"       # Ambient / Idle playback
      sleep: "#A78BFA"       # Stream offline / Reconnecting

  typography:
    families:
      display: "Söhne Mono, JetBrains Mono, monospace" # Metrics, time, status
      body: "Inter, system-ui, sans-serif"             # Prose, descriptions, titles
    sizes:
      xs: "12px"
      sm: "14px"
      base: "16px"
      lg: "20px"
      xl: "28px"
      display: "48px"
    weights:
      light: 300
      regular: 400
      medium: 500
    tracking:
      tightest: "-0.04em"
      tight: "-0.02em"
      normal: "0em"

  spacing:
    base: 4
    scale:
      - 4px
      - 8px
      - 12px
      - 16px
      - 24px
      - 32px
      - 48px
      - 64px

  borderRadius:
    none: "0px"
    sm: "4px"
    md: "12px"
    lg: "24px"
    pill: "9999px"

  elevation:
    glow-primary: "0 0 20px rgba(99, 102, 241, 0.15)"
    glow-live: "0 0 24px rgba(129, 140, 248, 0.25)"
    card: "0 4px 24px rgba(0, 0, 0, 0.5)"
    inner-rim: "inset 0 1px 1px rgba(255, 255, 255, 0.05)"

  animation:
    easing: "cubic-bezier(0.25, 1, 0.5, 1)" # "Circadian Fluidity"
    duration:
      fast: "300ms"
      breathing: "800ms"
---

## 1. Visual Identity & Brand Philosophy

This interface must prioritize cognitive rest, visual breathing room, and organic fluid feedback. The app is intentionally designed **not** to be obsessively interacted with; once the radio stream is set, the user should be drawn to lock their phone. The UI is a dark, obsidian void populated by isolated pools of liquid metal (`metal-fx`) that pulse and catch light only when active.

## 2. Color Strategy & The Obsidian Canvas

- **Absolute Dominance of Dark:** Always render interfaces on the deep `{colors.background}` (`#0A0A0E`) canvas. White or light backgrounds are strictly prohibited.
- **Functional Radiance:** Saturated accent colors must never be used purely for decoration. Use `{colors.semantic}` tokens only to dictate real-time radio states: Live (`focus`), Idle/Scheduled (`relax`), or Offline (`sleep`).
- **Surface Elevation:** Use `{colors.surface}` (`#12121A`) for cards and player modules. Separate them from the background using `{elevation.glow-primary}` rather than hard borders.

## 3. Typography & Editorial Density

- **Monospace Structure:** Numeric readouts (frequency, time, bitrates) and status badges MUST utilize `{typography.families.display}` at `{typography.weights.light}`.
- **Negative Letter-Spacing:** For large headers or metrics, apply tight, negative letter-spacing (`{typography.tracking.tightest}`) to establish an editorial, high-end technical feel.
- **Prose Rules:** Track names, artist data, and show bios utilize the sans-serif `{typography.families.body}`. Keep contrast low using `{colors.text.secondary}` unless it is the currently playing track title.

## 4. Materials & WebGL Chrome (metal-fx)

The `metal-fx` library is the signature chrome of the app. It must be treated as organic, breathing material.

- **Ambient Strength:** By default, metallic frames must remain subdued (`strength={0.3}`). They should only reach `strength={1.0}` during active states (e.g., Live audio playing).
- **Preset Mapping:** 
  - Use `preset="silver"` for neutral, structural containers, idle buttons, and schedule cards.
  - Use `preset="chromatic"` exclusively to signify the live state (`#818CF8`) or active play back.
- **Inner Shadow:** Circular controls must utilize the `innerShadow` prop to give the `#12121A` surface depth, grounding the metal in the dark canvas.
- **Typography Metal:** Use `<MetalText>` purely for the main "Frequency / Station ID" hero text or the large "Time Remaining" numbers. Never use it for standard body text.

## 5. Core Components

### `ambient-play-orb` (Main Player Control)
The persistent, primary interaction.
- **Shape:** `{borderRadius.pill}` / Circular. Minimum 64x64px footprint.
- **Surface:** Wrapped in `<MetalFx variant="circle" innerShadow theme="dark">`.
- **State - Idle:** `preset="silver"`, `strength={0.3}`. Icon opacity `0.5`.
- **State - Playing:** `preset="chromatic"`, `strength={1.0}`. `<useMetalBend>` active to track cursor/touch. Outer glow transitions to `{elevation.glow-live}`.

### `status-badge` (Live/Offline Indicators)
Replaces standard flat badges with metallic capsular readouts.
- **Structure:** Wrapped in `<MetalBadge theme="dark" strength={0.6}>`.
- **Typography:** `display` family, `12px`, uppercase, `{colors.text.secondary}`.
- **Indicator:** An inline 6px dot using the relevant semantic color (`#818CF8` for live) with a synchronized 800ms breathing opacity animation.

### `surface-card` (Schedule & Show Rows)
- **Background:** `{colors.surface}` (`#12121A`).
- **Radii:** `{borderRadius.lg}` (24px) for standalone hero cards, `{borderRadius.md}` (12px) for list items.
- **Border:** 1px solid `{colors.surface-muted}` or use `{elevation.inner-rim}`.
- **Interaction:** Hover or active states fade the background to `{colors.surface-muted}` over `800ms`. No sharp snaps.

### `track-display` (Persistent Meta Block)
- **Title:** `{typography.families.body}`, `16px`, `{colors.text.primary}`.
- **Artist/Show:** `{typography.families.body}`, `14px`, `{colors.text.secondary}`.
- **Missing Data:** If artist/album is unknown, fade the entire block to `{colors.text.muted}` and display "Signal Broadcast". Do not leave blank spaces or use jagged layout shifts.

## 6. Animation & Interaction (Circadian Fluidity)

- **No Snappy Transitions:** UI transitions must simulate biological states and liquid displacement. Avoid instant (`0ms`) or bouncy micro-interactions.
- **Global Easing:** Use long, ease-in-out bezier transitions: `cubic-bezier(0.25, 1, 0.5, 1)`.
- **Duration:** Hover and active state transitions must take `800ms` (`duration.breathing`). State swaps (like page navigation) can use `300ms` (`duration.fast`) but must fade gracefully.
- **Scrolling:** The background `#0A0A0E` canvas must remain locked. Only the content inside `surface` containers should scroll.

## 7. Do's and Don'ts

### DO:
- Use `MetalFx` to signify the most important interaction on the screen (Play, Connect, Submit).
- Ensure all children of `MetalFx` components have dark backgrounds (`#12121A` or `#0A0A0E`) so the metal edge catches the contrast.
- Embrace negative space. Use the `spacing.scale` multipliers generously.

### DON'T:
- Do NOT use standard CSS gradients or harsh CSS box-shadows. Use the `metal-fx` shaders and soft `rgba` glows.
- Do NOT use white or light backgrounds anywhere.
- Do NOT use standard sans-serif for numbers. Numbers are always monospace.
- Do NOT overuse metal. If everything is metallic, nothing is. Keep text and secondary lists flat `#12121A`.