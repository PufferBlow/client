import type { CSSProperties } from "react";

/** A role on a person: its identity colour at 14% fill with full-strength text. */
export function RoleTag({ name, colour, dot = true }: { name: string; colour: string; dot?: boolean }) {
  return (
    <span className="pb-role-tag inline-flex items-center gap-1.5" style={{ ["--role-colour" as string]: colour } as CSSProperties}>
      {dot && <span className="size-1.5 rounded-full" style={{ background: colour }} />}
      {name}
    </span>
  );
}
