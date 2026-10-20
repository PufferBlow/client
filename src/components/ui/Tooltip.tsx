import { useId, type ReactNode } from "react";

/**
 * An inverted (white) label that appears above its trigger on hover or keyboard focus. CSS only, so
 * it costs nothing until it shows; the label is also the trigger's accessible description.
 */
export function Tooltip({ label, children, side = "top" }: { label: ReactNode; children: ReactNode; side?: "top" | "right" | "bottom" }) {
  const id = useId();
  const place = {
    top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
    bottom: "left-1/2 top-full mt-2 -translate-x-1/2",
    right: "left-full top-1/2 ml-2 -translate-y-1/2",
  }[side];
  return (
    <span className="group/tip relative inline-flex" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute z-[70] whitespace-nowrap rounded-sm bg-primary px-2.5 py-[7px] text-[12.5px] font-semibold text-on-primary opacity-0 transition-opacity duration-(--motion-fast) group-hover/tip:opacity-100 group-focus-within/tip:opacity-100 ${place}`}
      >
        {label}
      </span>
    </span>
  );
}
