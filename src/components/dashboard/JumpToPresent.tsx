import { ArrowDown } from "lucide-react";

/** Floating pill over the bottom of a chat log while the reader is scrolled up. */
export function JumpToPresent({ unseen, onClick }: { unseen: number; onClick: () => void }) {
  const label = unseen > 0 ? `${unseen} new message${unseen === 1 ? "" : "s"}` : "Jump to present";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-medium shadow-popover transition-colors focus-visible:outline-2 focus-visible:outline-focus ${
        unseen > 0
          ? "border-transparent bg-primary text-on-primary hover:bg-primary-hover"
          : "border-border-secondary bg-surface-secondary text-text-secondary hover:text-text"
      }`}
    >
      <ArrowDown size={14} aria-hidden="true" />
      {label}
    </button>
  );
}
