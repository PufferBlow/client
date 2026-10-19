const GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ["#f2f2f2", "#3a3a3a"],
  ["#cfcfcf", "#3d3d3d"],
  ["#bdbdbd", "#333333"],
  ["#d6d6d6", "#353535"],
  ["#c4c4c4", "#404040"],
  ["#e0e0e0", "#383838"],
  ["#dadada", "#3a3a3a"],
  ["#a9a9a9", "#2e2e2e"],
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable placeholder gradient for anything with a string id (used when there's no avatar image). */
export function gradientFor(seed: string): string {
  const [from, to] = GRADIENTS[hash(seed) % GRADIENTS.length]!;
  return `linear-gradient(135deg, ${from}, ${to})`;
}

export function initialsFor(name: string): string {
  return (
    name
      .split(/\s+/)
      .map((word) => word[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}
