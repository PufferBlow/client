import {
  autoUpdate,
  FloatingPortal,
  offset,
  shift,
  useDismiss,
  useFloating,
  useFocus,
  useHover,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { useState, type ReactNode } from "react";

/**
 * Render one entry in the server rail.
 *
 * Visual structure:
 *
 *   | pill |   ( avatar )   |   < tooltip on hover, portaled to body
 *
 * The pill is a sibling of the avatar (not a wrapper) so hover and
 * selection visuals never animate across the avatar's own pixels —
 * the avatar shape stays stable, the pill changes height to
 * communicate state. Three pill states:
 *
 *   - selected:  full-height (h-9), persistent. The active server.
 *   - unread:    short (h-2), persistent. There's new activity here
 *                you haven't seen.
 *   - hovering:  mid-height (h-7), only while the pointer is over
 *                the row. Suppressed on selected rows so the pill
 *                doesn't shrink under the pointer.
 *
 * The avatar itself is a stable `rounded-lg` rectangle on every
 * state — no radius morph on hover. The color of the avatar
 * communicates selected vs. resting; the pill communicates "where
 * you are in the list."
 *
 * Tooltip:
 *
 *   The server name floats to the right of the avatar on hover or
 *   keyboard focus, using @floating-ui/react's portal so it escapes
 *   the rail's `overflow-y-auto` clip. Native `title` is
 *   intentionally NOT set — the OS's unstyled yellow tooltip would
 *   race with this one and contradict the rest of the design.
 */
export interface ServerRailItemProps {
  /** Slot label shown in the tooltip and used as aria-label. */
  label: string;
  /** Children render inside the 48×48 avatar surface (typically an <img> or a letter). */
  children: ReactNode;
  /** True for the currently-active server. Pinned pill, white avatar bg. */
  selected?: boolean;
  /** True when there's unread activity for this server. Short persistent pill. */
  unread?: boolean;
  /** Optional presence-dot color class (e.g. `bg-[var(--color-success)]`). */
  presenceClassName?: string;
  /** Click handler — switch active server. */
  onClick?: () => void;
  /**
   * Lock the avatar's palette to its resting (dark) surface, even
   * when hovered OR selected. The pill on the left still functions
   * as the selection indicator. Used for slots whose avatar carries
   * its own visual identity — the fixed Direct-Messages slot uses
   * the Pufferblow brand mark, drawn in white strokes via
   * currentColor, and putting white strokes on a white selected /
   * hover bg makes the logo disappear at every state transition.
   * Keeping the surface dark means the mark stays visible across
   * resting, hover, and selected.
   */
  lockRestingPalette?: boolean;
  /**
   * When true, render an "offline" indicator on the avatar — small
   * red dot in the bottom-right corner. Also dims the avatar so the
   * eye picks it up at a glance. The caller derives this from
   * ``useInstanceHealth(hostPort)`` so per-instance rails light up
   * independently — a remote being down doesn't touch the local
   * server's rail item.
   *
   * Mutually exclusive with ``presenceClassName`` visually — if
   * both are set, ``offline`` wins because "this server is down"
   * is the more important signal.
   */
  offline?: boolean;
}

export function ServerRailItem({
  label,
  children,
  selected = false,
  unread = false,
  presenceClassName,
  onClick,
  lockRestingPalette = false,
  offline = false,
}: ServerRailItemProps) {
  // Pill height in two parts:
  //   - `pillStatic`  — the height the pill sits at when not being
  //                     hovered. Selected wins over unread; unread
  //                     wins over nothing.
  //   - `pillHover`   — grow-on-hover variant. Only meaningful when
  //                     the static height is short (unread or none);
  //                     suppressed on selected because the pill is
  //                     already at its max and shouldn't animate.
  const pillStatic = selected ? "h-9" : unread ? "h-2" : "h-0";
  const pillHover = selected ? "" : "group-hover:h-7";

  // Avatar palette. Three branches:
  //
  //   - lockRestingPalette: never flip. Stays on the dark resting
  //     surface across hover and selected. Selection is communicated
  //     by the pill alone.
  //   - selected (default behavior): bg-primary + on-primary text.
  //     The white surface IS the selection cue, complementing the
  //     full-height pill.
  //   - unselected: resting palette + "preview selected look on
  //     hover" — bg flips to primary, text flips to on-primary
  //     while the pointer is over the row.
  const restingPalette =
    "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]";
  const selectedPalette =
    "bg-[var(--color-primary)] text-[var(--color-on-primary)]";
  const hoverFlipPalette =
    "group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-on-primary)]";

  const avatarColors = lockRestingPalette
    ? restingPalette
    : selected
      ? selectedPalette
      : `${restingPalette} ${hoverFlipPalette}`;

  // Tooltip plumbing. `useFloating` returns a `floatingStyles` object
  // we spread onto the tooltip; positioning is handled by
  // floating-ui via `placement: 'right'` + a small offset so the
  // tooltip sits in the gutter to the right of the rail.
  // `autoUpdate` keeps the position correct as the user scrolls the
  // rail body (the button's viewport coordinates change).
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const { refs, floatingStyles, context } = useFloating({
    open: tooltipOpen,
    onOpenChange: setTooltipOpen,
    placement: "right",
    middleware: [offset(12), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });
  // Hover (`restMs` = brief delay so a fast pass over the rail
  // doesn't flicker tooltips for every adjacent row) + keyboard
  // focus + Escape-to-dismiss + correct ARIA role.
  const hover = useHover(context, { restMs: 60 });
  const focus = useFocus(context);
  const dismiss = useDismiss(context);
  const role = useRole(context, { role: "tooltip" });
  const { getReferenceProps, getFloatingProps } = useInteractions([
    hover,
    focus,
    dismiss,
    role,
  ]);

  return (
    <>
      <button
        ref={refs.setReference}
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={selected ? "true" : undefined}
        className="group pb-focus-ring relative flex h-12 w-16 items-center justify-center cursor-pointer"
        {...getReferenceProps()}
      >
        <span
          aria-hidden
          className={`absolute left-0 w-1 rounded-r-full bg-[var(--color-text)] transition-all duration-200 ${pillStatic} ${pillHover}`}
        />
        <div
          className={`relative flex h-12 w-12 items-center justify-center rounded-lg text-lg font-semibold transition-colors duration-200 ${avatarColors} ${
            // Dim the whole avatar when the instance is offline so the
            // eye picks it up before reading the dot. Subtle (60%
            // opacity, grayscale on the content) — not so faded that
            // the icon disappears, just enough to read as "this one
            // isn't healthy right now."
            offline ? "opacity-60 grayscale" : ""
          }`}
        >
          {children}
          {offline ? (
            // Offline dot supersedes the presence dot. Red ringed
            // with the surface color so it pops on every theme.
            // aria-label so screen readers get the signal without
            // needing the visual.
            <span
              aria-label="Offline"
              role="img"
              className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-error)]"
            />
          ) : (
            presenceClassName && (
              <span
                aria-hidden
                className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[var(--color-surface)] ${presenceClassName}`}
              />
            )
          )}
        </div>
      </button>

      {tooltipOpen && (
        <FloatingPortal>
          <div
            ref={refs.setFloating}
            style={floatingStyles}
            className="pointer-events-none z-50 whitespace-nowrap rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface)] px-2.5 py-1 text-sm font-medium text-[var(--color-text)] shadow-[var(--shadow-popover)]"
            {...getFloatingProps()}
          >
            {label}
          </div>
        </FloatingPortal>
      )}
    </>
  );
}
