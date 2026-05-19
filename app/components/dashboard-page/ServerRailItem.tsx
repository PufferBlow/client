import type { ReactNode } from "react";

/**
 * Render one entry in the server rail.
 *
 * Visual structure:
 *
 *   | pill |   ( avatar )   |
 *
 * The pill is a sibling of the avatar (not a wrapper) so hover and
 * selection visuals never animate across the avatar's own pixels —
 * the avatar shape stays stable, the pill changes height to
 * communicate state. Three pill states:
 *
 *   - selected:  full-height (h-9), persistent. The active server.
 *   - unread:    short (h-2), persistent. There's new activity
 *                here you haven't seen.
 *   - hovering:  mid-height (h-7), only while the pointer is over
 *                the row. Suppressed on selected rows so the pill
 *                doesn't shrink under the pointer.
 *
 * The avatar itself is a stable `rounded-lg` rectangle on every
 * state — no radius morph on hover. The color of the avatar
 * communicates selected vs. resting; the pill communicates
 * "where you are in the list."
 */
export interface ServerRailItemProps {
  /** Slot label / tooltip. */
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
}

export function ServerRailItem({
  label,
  children,
  selected = false,
  unread = false,
  presenceClassName,
  onClick,
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

  const avatarColors = selected
    ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]"
    : "bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)] group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-on-primary)]";

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-current={selected ? "true" : undefined}
      className="group pb-focus-ring relative flex h-12 w-16 items-center justify-center cursor-pointer"
    >
      <span
        aria-hidden
        className={`absolute left-0 w-1 rounded-r-full bg-[var(--color-text)] transition-all duration-200 ${pillStatic} ${pillHover}`}
      />
      <div
        className={`relative flex h-12 w-12 items-center justify-center rounded-lg text-lg font-semibold transition-colors duration-200 ${avatarColors}`}
      >
        {children}
        {presenceClassName && (
          <span
            aria-hidden
            className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[var(--color-surface)] ${presenceClassName}`}
          />
        )}
      </div>
    </button>
  );
}
