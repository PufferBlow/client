const GRADIENTS: ReadonlyArray<readonly [string, string]> = [
  ["#efbf63", "#9a5b2a"],
  ["#c9a3f0", "#5b3c8f"],
  ["#9fd487", "#3c6b33"],
  ["#f0a061", "#8a3d1c"],
  ["#8cc9d6", "#2f5866"],
  ["#ef8a75", "#7a2a20"],
  ["#e6d8b3", "#6b5d3f"],
  ["#a9b3e6", "#3b4378"],
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
