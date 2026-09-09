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
 * Diagonal, not upright. Standing the pair on its rings is symmetrical about
 * the vertical and fills a square tile better — and it reads as a headstone:
 * two round feet under an arch is a grave before it is a tool. Turned on the
 * diagonal the silhouette is unambiguous, because the two rings sit side by
 * side on ONE side and the blades open away from them, which is the shape a
 * pair of scissors has when it is being held.
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
      {/* The finger rings, stacked on the left. */}
      <circle cx="6.9" cy="6.2" r="2.6" />
      <circle cx="6.9" cy="17.8" r="2.6" />
      {/* Each blade leaves its own ring's edge, runs through the pivot at
          (12.5, 12) and out to the tip on the far side. */}
      <path d="M8.74 8.04 19.7 19" />
      <path d="M8.74 15.96 19.7 5" />
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
