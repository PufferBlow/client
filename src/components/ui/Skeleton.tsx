import type { CSSProperties } from "react";

/** A resting placeholder: the pulse stops for people who ask for less motion. */
const BASE = "animate-pulse rounded-sm bg-surface-tertiary motion-reduce:animate-none";

export interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  /** A round placeholder (an avatar). */
  circle?: boolean;
}

/** One placeholder block. Size it with classes: `<Skeleton className="h-3 w-24" />`. */
export function Skeleton({ className = "", style, circle }: SkeletonProps) {
  return <div aria-hidden="true" className={`${BASE} ${circle ? "rounded-full" : ""} ${className}`} style={style} />;
}

/** Widths cycled through so stacked lines do not form a block. */
const WIDTHS = ["w-3/4", "w-1/2", "w-2/3", "w-5/6", "w-2/5", "w-3/5"];
const at = (i: number) => WIDTHS[i % WIDTHS.length]!;

/** An avatar with two lines beside it: a person, a channel, a conversation. */
export function SkeletonRow({ index = 0, avatar = 36 }: { index?: number; avatar?: number }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <Skeleton circle className="shrink-0" style={{ width: avatar, height: avatar }} />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className={`h-3 ${at(index)}`} />
        <Skeleton className={`h-2.5 ${at(index + 2)} opacity-70`} />
      </div>
    </div>
  );
}

/** A chat message: avatar, a name and time, then one to three lines of text. */
export function SkeletonMessage({ index = 0 }: { index?: number }) {
  const lines = 1 + (index % 3);
  return (
    <div className="flex gap-3 px-4 py-2.5">
      <Skeleton circle className="size-10 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <div className="flex items-center gap-2">
          <Skeleton className={`h-3 ${index % 2 ? "w-20" : "w-28"}`} />
          <Skeleton className="h-2.5 w-12 opacity-60" />
        </div>
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton key={i} className={`h-3 ${i === lines - 1 ? at(index + i) : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

/** Table rows: a few cells of different widths. */
export function SkeletonTable({ rows = 6, columns = 3 }: { rows?: number; columns?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-border-secondary px-5 py-3.5 last:border-b-0">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className={`h-3 ${c === 0 ? "w-28" : c === columns - 1 ? "w-40 flex-1" : at(r + c)}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** A form: a label over a field, repeated. */
export function SkeletonForm({ fields = 4 }: { fields?: number }) {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
    </div>
  );
}

/** Cards in a grid: a picture over two lines. */
export function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-lg bg-surface-secondary p-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className={`h-3 ${at(i)}`} />
          <Skeleton className="h-2.5 w-1/3 opacity-70" />
        </div>
      ))}
    </div>
  );
}
