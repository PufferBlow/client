/** Table styling shared by the channel and member lists. */
export const tableClasses = {
  table: "w-full border-collapse text-left text-sm",
  head: "border-b border-border-secondary px-5 py-2.5 font-heading text-[11.5px] font-semibold uppercase tracking-[0.12em] text-text-muted",
  cell: "border-b border-border-secondary px-5 py-3 align-middle",
  row: "last:[&>td]:border-b-0 hover:bg-text/[0.03]",
} as const;
