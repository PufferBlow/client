/**
 * How a typing line reads, as parts so names can be emphasised: "Ada is typing…",
 * "Ada and Bob are typing…", "Ada, Bob and Cy are typing…", then "Several people are typing…".
 */
export function typingLabel(names: readonly string[]): { names: string[]; rest: string } {
  if (names.length === 0) return { names: [], rest: "" };
  if (names.length > 3) return { names: [], rest: "Several people are typing…" };
  return { names: [...names], rest: names.length === 1 ? " is typing…" : " are typing…" };
}
