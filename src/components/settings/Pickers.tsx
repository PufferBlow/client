import type { ReactNode } from "react";
import { type Tone, TONE_HEX, TONES } from "@pufferblow/spines";

/** The ring that sets a picked swatch apart is cut out of whatever surface it sits on. */
const RING = "aria-pressed:shadow-[0_0_0_3px_var(--ground,var(--color-surface-secondary)),0_0_0_5px_var(--color-text)]";

/** A titled set of choices: a section label over the picks. */
export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="flex flex-col gap-2.5">
      <span className="pb-section-label text-text-tertiary">{label}</span>
      {children}
    </div>
  );
}

/** One pick from a short list: white when chosen. */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`pb-label-button inline-flex h-8 items-center gap-1.5 rounded-sm border-0 px-3 text-[11.5px] transition-colors duration-(--motion-fast) ${
        selected ? "bg-text text-on-primary" : "bg-surface-tertiary text-text-body hover:bg-active"
      }`}
    >
      {children}
    </button>
  );
}

/** The six identity colours. `ground` is the colour of the surface behind, for the ring around the picked one. */
export function Swatches({ label, value, onChange, ground }: { label: string; value: string | null; onChange: (tone: Tone) => void; ground?: string }) {
  return (
    <div className="flex flex-wrap gap-2.5" style={ground ? ({ ["--ground" as string]: ground } as React.CSSProperties) : undefined}>
      {TONES.map((tone) => (
        <button
          key={tone}
          type="button"
          aria-label={`${label}: ${tone}`}
          aria-pressed={value === tone}
          title={tone}
          onClick={() => onChange(tone)}
          className={`size-[30px] cursor-pointer rounded-full border-0 transition-shadow ${RING}`}
          style={{ background: TONE_HEX[tone] }}
        />
      ))}
    </div>
  );
}
