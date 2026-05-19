import type { ReactNode } from "react";

/**
 * Vertical rail that hosts the DM affordance + every joined-server
 * avatar.
 *
 * Scroll behavior:
 *   - `overflow-y-auto` is kept so a future multi-server scenario
 *     (many joined instances stacked beyond the viewport) doesn't
 *     clip avatars at the bottom.
 *   - The visible scrollbar is hidden via the WebKit/Firefox
 *     vendor properties. With v1.0's content (DM slot + home
 *     server + add button) the rail never overflows in practice;
 *     showing a scrollbar in that case is pure visual noise on a
 *     narrow 64 px column. Users with overflow can still scroll
 *     via wheel / trackpad / keyboard — the gesture surface is
 *     intact, only the visual chrome is gone.
 */
export function ServerRail({ children }: { children: ReactNode }) {
  return (
    <div className="w-16 shrink-0 overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}
