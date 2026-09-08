import React from 'react'

/**
 * StudioControl — the shears, drawn rather than loaded.
 *
 * What was here before was `<img src="…/glow-studio/logo.png">`: a 400×400
 * raster of a woman's profile on a mauve tile, left over from when this app was
 * called Glow Studio. Three problems, and only the last is cosmetic. It carried
 * its own background, so the mark showed as a coloured chip on the ink rail and
 * again on the white login card, agreeing with neither. It was a network fetch
 * before the first paint of the shell. And the family's other marks
 * (ChefControl's hat, TicketControl's stub) are inline paths in `currentColor`
 * — the surface decides the colour, the way it decides for the word beside it.
 *
 * Upright rather than Lucide's diagonal `Scissors`: standing on its rings the
 * pair is symmetrical about the vertical, which is what lets it sit in a square
 * tile — a favicon, an AppSwitcher chip — without a diagonal object leaving two
 * empty corners. The blades cross at the grid's centre, so the pivot is where
 * the eye already is at 16px.
 *
 * Contour at 1.8 on the 24 grid, so in a rail of Lucide icons it stands as one
 * of them rather than as a blot of ink.
 */
export function StudioMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* The finger rings. */}
      <circle cx="8.5" cy="18.3" r="2.5" />
      <circle cx="15.5" cy="18.3" r="2.5" />
      {/* The blades, leaving each ring's edge and crossing at (12, 11.05). */}
      <path d="M9.59 16.05 15.4 4" />
      <path d="M14.41 16.05 8.6 4" />
    </svg>
  )
}

/**
 * `collapsed` leaves only the mark — in a 4rem rail the word has nowhere to go,
 * and shrinking it until it fits stops being legible.
 *
 * `full` adds the family suffix at half strength, for the surfaces that
 * introduce the product by its whole name — login, public pages.
 */
export function Logo({ collapsed, full }: { collapsed?: boolean; full?: boolean }) {
  return (
    <span className="flex items-center gap-2.5" role="img" aria-label="StudioControl">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center">
        <StudioMark className="h-[26px] w-[26px]" />
      </span>
      {!collapsed && (
        <span className="text-base font-bold leading-none tracking-tight">
          Studio
          {full && <span className="font-semibold opacity-60">Control</span>}
        </span>
      )}
    </span>
  )
}
