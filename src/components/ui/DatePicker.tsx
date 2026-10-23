import { useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { FloatingPanel } from "./FloatingPanel";

export interface DatePickerProps {
  /** Names the control for screen readers. */
  label: string;
  /** `YYYY-MM-DD`, or "" for no day. */
  value: string;
  onChange: (value: string) => void;
  /** Earliest and latest day that can be chosen, as `YYYY-MM-DD`. */
  min?: string;
  max?: string;
  /** The `YYYY-MM-DD` whose month opens when no day is chosen yet; today when left out. */
  initialMonth?: string;
  placeholder?: string;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");
const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** A day at local midnight; noon would survive daylight saving, but the keys are compared as strings. */
const fromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

/** The weeks of a month, as day keys, padded with the days around it so every row is full. */
function weeksOf(month: Date): string[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(start);
      day.setDate(start.getDate() + w * 7 + d);
      week.push(toKey(day));
    }
    weeks.push(week);
  }
  return weeks;
}

const fieldDate = (key: string) => fromKey(key).toLocaleDateString([], { dateStyle: "medium" });
const longDate = (key: string) => fromKey(key).toLocaleDateString([], { dateStyle: "long" });

/**
 * A day chooser in the app's look: a field showing the day, opening a month to pick from. Days outside
 * `min`/`max` are dimmed and cannot be chosen; Clear empties the field and Today jumps to today.
 */
export function DatePicker({ label, value, onChange, min, max, initialMonth, placeholder = "Any day", className = "" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const opening = () => (value ? fromKey(value) : initialMonth ? fromKey(initialMonth) : new Date());
  const [month, setMonth] = useState(opening);
  const button = useRef<HTMLButtonElement>(null);
  const today = toKey(new Date());
  const weeks = useMemo(() => weeksOf(month), [month]);

  const step = (by: number) => setMonth((m) => new Date(m.getFullYear(), m.getMonth() + by, 1));
  const disabled = (key: string) => (min !== undefined && min !== "" && key < min) || (max !== undefined && max !== "" && key > max);
  const choose = (key: string) => {
    onChange(key);
    setOpen(false);
    button.current?.focus();
  };

  return (
    <>
      <span className={`relative inline-flex ${className}`}>
        <button
          ref={button}
          type="button"
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            if (!open) setMonth(opening());
            setOpen((o) => !o);
          }}
          className={`inline-flex h-9 min-w-36 cursor-pointer items-center gap-2 rounded-md border-0 bg-surface-secondary pl-3 text-left text-[13px] outline-none hover:bg-hover focus-visible:shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_4px_var(--color-text)] ${value ? "pr-9 text-text" : "pr-3 text-text-muted"}`}
        >
          <CalendarDays size={14} aria-hidden="true" className="shrink-0 text-text-tertiary" />
          <span className="truncate">{value ? fieldDate(value) : placeholder}</span>
        </button>
        {value && (
          <button
            type="button"
            aria-label={`Clear ${label}`}
            onClick={() => onChange("")}
            className="absolute right-1.5 top-1/2 grid size-6 -translate-y-1/2 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-text-tertiary hover:bg-active hover:text-text"
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </span>

      {open && (
        <FloatingPanel anchor={button} onClose={() => setOpen(false)} label={`Choose ${label.toLowerCase()}`} className="w-[280px] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="pb-label-button text-[13px] text-text" aria-live="polite">
              {month.toLocaleDateString([], { month: "long", year: "numeric" })}
            </span>
            <div className="flex gap-1">
              <button type="button" aria-label="Previous month" onClick={() => step(-1)} className="grid size-7 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-text-secondary hover:bg-active hover:text-text">
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
              <button type="button" aria-label="Next month" onClick={() => step(1)} className="grid size-7 cursor-pointer place-items-center rounded-sm border-0 bg-transparent p-0 text-text-secondary hover:bg-active hover:text-text">
                <ChevronRight size={15} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div role="grid" aria-label={month.toLocaleDateString([], { month: "long", year: "numeric" })} className="flex flex-col gap-0.5">
            <div role="row" className="grid grid-cols-7">
              {WEEKDAYS.map((d) => (
                <span key={d} role="columnheader" className="pb-section-label py-1 text-center text-[10.5px] text-text-muted">
                  {d}
                </span>
              ))}
            </div>
            {weeks.map((week) => (
              <div key={week[0]} role="row" className="grid grid-cols-7">
                {week.map((key) => {
                  const outside = fromKey(key).getMonth() !== month.getMonth();
                  const isSelected = key === value;
                  const off = disabled(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      role="gridcell"
                      aria-label={longDate(key)}
                      aria-selected={isSelected}
                      aria-current={key === today ? "date" : undefined}
                      disabled={off}
                      onClick={() => choose(key)}
                      className={`grid h-8 cursor-pointer place-items-center rounded-sm border-0 p-0 text-[13px] tabular-nums transition-colors duration-(--motion-fast) disabled:cursor-not-allowed disabled:opacity-30 ${
                        isSelected
                          ? "bg-text font-semibold text-on-primary"
                          : `bg-transparent hover:bg-active ${outside ? "text-text-muted" : "text-text-body"} ${key === today ? "shadow-[inset_0_0_0_1px_var(--color-border)]" : ""}`
                      }`}
                    >
                      {fromKey(key).getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border-secondary pt-2">
            <button type="button" onClick={() => choose("")} className="pb-label-button cursor-pointer border-0 bg-transparent px-1 py-1 text-[11.5px] text-text-tertiary hover:text-text">
              Clear
            </button>
            <button type="button" disabled={disabled(today)} onClick={() => choose(today)} className="pb-label-button cursor-pointer border-0 bg-transparent px-1 py-1 text-[11.5px] text-text hover:underline disabled:cursor-not-allowed disabled:opacity-40">
              Today
            </button>
          </div>
        </FloatingPanel>
      )}
    </>
  );
}
