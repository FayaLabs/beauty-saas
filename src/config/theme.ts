import type { SaasTheme } from '@fayz-ai/saas'

/**
 * StudioControl — the fayz.ai design system in its beauty/wellness register.
 *
 * The system's neutrals are WARM (paper #FAFAF8 over a green-undertoned ink),
 * not the blue-grey shadcn default, and the brand colour appears as a plum
 * accent rather than as a tint on every surface. That combination is what
 * makes the screen read as sober: one saturated colour, used rarely, on
 * neutrals that stay quiet.
 *
 * Hex values are the design system's; the tokens below are their HSL
 * translation because the shell writes `hsl(var(--token))`.
 */

// ── Brand (plum) ────────────────────────────────────────────────────────────
const PLUM = '260 34% 47%' //   #6B4FA1  brand fills, links, active accents
const LAVENDER = '257 57% 76%' //   #B4A0E5  the rail's active mark — light on ink
const PLUM_SOFT = '260 56% 95%' //   #EFEAF9  hover halos, quiet accent surfaces

// ── Rail ────────────────────────────────────────────────────────────────────
// #161122 — the design's near-black plum. Alpha survives inside a token because
// Tailwind maps these as bare `hsl(var(--x))`, with no <alpha-value> slot.
const RAIL = '258 33% 10%'
const RAIL_BORDER = '0 0% 100% / 0.1'
const RAIL_ACTIVE = '257 57% 76% / 0.16'
const RAIL_MUTED = '0 0% 100% / 0.55'

// ── Warm neutrals ───────────────────────────────────────────────────────────
const INK = '156 12% 8%' //   #131816
// The design's paper (#FAFAF8) is 2% off white: as the page it left the white
// cards with nothing to stand on. The sunken surface is the step down the same
// warm scale, and it is what the page is made of.
const SURFACE_SUNK = '60 12% 95%' //   #F4F4F1
const BORDER = '60 11% 91%' //   #EAEAE5
const BORDER_STRONG = '60 8% 84%' //   #D9D9D2
const TEXT_MUTED = '60 3% 35%' //   #5C5C57

export const beautyTheme: SaasTheme = {
  __kind: 'saas-theme',
  name: 'StudioControl',
  preset: 'classic_admin',
  brand: PLUM,
  shadow: 'subtle',
  font: 'dm-sans',
  sidebar: {
    background: RAIL,
    foreground: '260 20% 90%',
    border: RAIL_BORDER,
    accent: RAIL_ACTIVE,
    accentForeground: LAVENDER,
    muted: RAIL_MUTED,
  },
  content: {
    background: SURFACE_SUNK,
  },
  colors: {
    // Matches `content`: under md the framed card is suppressed and the page
    // falls back to this one.
    background: SURFACE_SUNK,
    foreground: INK,
    card: '0 0% 100%',
    cardForeground: INK,
    popover: '0 0% 100%',
    popoverForeground: INK,
    // One step below the page, not level with it: these are the quiet fills —
    // the track behind a tab strip, a table head, a secondary button — and they
    // only read as sunken while they are darker than what they sit on. Same
    // value as the hairline, one role down the same scale.
    secondary: BORDER,
    secondaryForeground: INK,
    muted: BORDER,
    mutedForeground: TEXT_MUTED,
    border: BORDER,
    // Fields carry the STRONG border — the design draws inputs a step darker
    // than card edges so a form reads as a form on a white card.
    input: BORDER_STRONG,
    ring: PLUM,
    // `accent` is the quiet hover surface, not a second brand colour. Left to
    // the brand shorthand it derives by rotating the hue ~50°, which lands on a
    // blue the design system has no place for.
    accent: PLUM_SOFT,
    accentForeground: PLUM,
  },
  // The design system's radii and elevation are real numbers, not one of the
  // sharp/soft/round presets: cards 16, buttons 12, and shadows that stay
  // gentle at every step (nothing here is ever a hard drop shadow).
  perception: {
    buttonRadius: '12px',
    cardRadius: '16px',
    inputRadius: '12px',
    modalRadius: '20px',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontFamilyMono: "'JetBrains Mono', ui-monospace, monospace",
    shadowSm: '0 1px 3px rgba(11,15,14,0.06), 0 1px 2px rgba(11,15,14,0.04)',
    shadowMd: '0 4px 12px rgba(11,15,14,0.06), 0 2px 4px rgba(11,15,14,0.04)',
    shadowLg: '0 12px 32px rgba(11,15,14,0.08), 0 4px 12px rgba(11,15,14,0.04)',
  },
}
