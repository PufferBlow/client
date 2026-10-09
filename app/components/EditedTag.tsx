/**
 * Tiny "edited" marker rendered next to a message body when the
 * sender has edited it at least once.
 *
 * Two states:
 *   * Edited once → just "edited" (Discord/Slack convention —
 *     don't show "edited 1 time", that's awkward).
 *   * Edited N>1 times → "edited 3 times".
 *
 * Used in both channel chat and DMs so the visual language is
 * identical regardless of surface. The component itself is
 * deliberately stateless — call sites pass `count` and (optionally)
 * the `at` timestamp; the timestamp shows up in a tooltip on
 * hover for operators who want to know exactly when.
 */
interface EditedTagProps {
  count: number;
  /** ISO 8601 last-edited timestamp. When provided, surfaced via
   *  the native `title` so a hover reveals it without burning
   *  inline pixels. */
  at?: string | null;
}

export function EditedTag({ count, at }: EditedTagProps) {
  if (!count || count <= 0) return null;

  const label = count === 1 ? "edited" : `edited ${count} times`;
  const tooltip = at
    ? `${label} · ${new Date(at).toLocaleString()}`
    : label;

  return (
    <span
      className="ml-1 inline-block align-baseline text-[10px] italic text-[var(--color-text-muted)]"
      title={tooltip}
    >
      ({label})
    </span>
  );
}
