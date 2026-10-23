import { useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown } from "lucide-react";
import { FloatingPanel } from "./FloatingPanel";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  /** Names the control for screen readers. */
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  className?: string;
}

/**
 * A dropdown in the app's own look: a raised field with a chevron, opening a list where the
 * current choice carries a check. Arrow keys move, Enter chooses, Escape closes.
 */
export function Select({ label, value, options, onChange, className = "" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const button = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);

  const show = () => {
    setActive(Math.max(0, options.findIndex((o) => o.value === value)));
    setOpen(true);
  };
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    button.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        show();
      }
      return;
    }
    if (e.key === "ArrowDown") setActive((i) => Math.min(options.length - 1, i + 1));
    else if (e.key === "ArrowUp") setActive((i) => Math.max(0, i - 1));
    else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(options.length - 1);
    else if (e.key === "Enter" || e.key === " ") {
      const option = options[active];
      if (option) choose(option.value);
    } else if (e.key === "Tab") setOpen(false);
    else return;
    e.preventDefault();
  };

  return (
    <>
      <button
        ref={button}
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
        className={`inline-flex h-9 min-w-0 cursor-pointer items-center justify-between gap-2.5 rounded-md border-0 bg-surface-secondary px-3 text-left text-[13px] text-text outline-none hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_4px_var(--color-text)] ${className}`}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronDown size={14} aria-hidden="true" className={`shrink-0 text-text-tertiary transition-transform duration-(--motion-fast) ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <FloatingPanel anchor={button} onClose={() => setOpen(false)} matchWidth role="presentation" className="max-h-72 overflow-y-auto p-1.5">
          <div id={listId} role="listbox" aria-label={label} onKeyDown={onKeyDown} className="flex flex-col gap-px">
            {options.map((option, i) => {
              const isSelected = option.value === value;
              return (
                <div
                  key={option.value}
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={() => setActive(i)}
                  onClick={() => choose(option.value)}
                  className={`flex cursor-pointer items-center justify-between gap-3 whitespace-nowrap rounded-sm px-2.5 py-2 text-[13px] ${i === active ? "bg-active text-text" : "text-text-body"} ${isSelected ? "font-semibold" : ""}`}
                >
                  {option.label}
                  {isSelected && <Check size={13} aria-hidden="true" />}
                </div>
              );
            })}
          </div>
        </FloatingPanel>
      )}
    </>
  );
}
