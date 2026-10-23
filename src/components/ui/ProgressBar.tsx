/**
 * A transfer's progress. With a known total it fills as bytes arrive; without one (a server that did
 * not say how big the file is) it is an indeterminate bar. The track is the raised surface and the
 * fill is white: progress is not an identity colour.
 */
export function ProgressBar({ loaded, total, label, className = "" }: { loaded: number; total: number; label: string; className?: string }) {
  const known = total > 0;
  const percent = known ? Math.min(100, Math.round((loaded / total) * 100)) : undefined;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={`h-1.5 w-full overflow-hidden rounded-pill bg-surface-tertiary ${className}`}
    >
      <div
        className={`h-full rounded-pill bg-text ${known ? "transition-[width] duration-(--motion-base) ease-(--motion-ease-out)" : "animate-pulse"}`}
        style={{ width: known ? `${percent}%` : "40%" }}
      />
    </div>
  );
}
