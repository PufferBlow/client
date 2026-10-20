import type { ReactNode } from "react";

export type HostState = "verified" | "unverified" | "blocked";

/**
 * The instance a remote person or space belongs to. Local ones show nothing, so the difference
 * reads at a glance: render this only when the host is not your own. Unverified instances get a
 * dashed outline; blocked instances are struck through, reddened and dimmed.
 */
export function HostPill({ host, state = "verified", children }: { host: string; state?: HostState; children?: ReactNode }) {
  const style =
    state === "blocked"
      ? "bg-error/12 text-error-text line-through"
      : state === "unverified"
        ? "bg-transparent text-text-tertiary shadow-[inset_0_0_0_1px_rgba(242,242,242,0.25)]"
        : "bg-surface-secondary text-text-tertiary";
  return (
    <span
      title={state === "unverified" ? "This instance has not been verified" : state === "blocked" ? "This instance is blocked" : undefined}
      className={`inline-flex h-5 items-center rounded-pill px-2 text-[11.5px] leading-none ${style}`}
    >
      @{host}
      {children}
    </span>
  );
}
