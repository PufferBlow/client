import { useSyncExternalStore } from "react";
import { createLogger } from "./logger";

const log = createLogger("reactions");

/**
 * Which emoji this person reacts with most, kept on this device, so the quick-reaction slots
 * offer their own favourites. Until there is any history the defaults fill in.
 */

const KEY = "pb_reaction_usage";
export const DEFAULT_REACTIONS = ["👍", "❤️", "😂", "🎉"];

type Usage = Record<string, { count: number; last: number }>;

function read(): Usage {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Usage) : {};
  } catch (error) {
    log.warn("stored reaction history is unreadable, starting over", error);
    return {};
  }
}

let usage: Usage = read();
let version = 0;
const listeners = new Set<() => void>();

/** Counts one use of `emoji` as a reaction. */
export function recordReaction(emoji: string): void {
  const entry = usage[emoji] ?? { count: 0, last: 0 };
  usage = { ...usage, [emoji]: { count: entry.count + 1, last: Date.now() } };
  try {
    localStorage.setItem(KEY, JSON.stringify(usage));
  } catch (error) {
    // Private mode or full storage: it still counts for this session.
    log.warn("couldn't save reaction history", error);
  }
  version += 1;
  listeners.forEach((listener) => listener());
}

/** The `n` most used, most recent first among ties, padded with the defaults. */
export function topReactions(n: number): string[] {
  const used = Object.entries(usage)
    .sort(([, a], [, b]) => b.count - a.count || b.last - a.last)
    .map(([emoji]) => emoji);
  const picks = [...used, ...DEFAULT_REACTIONS.filter((emoji) => !used.includes(emoji))];
  return picks.slice(0, n);
}

const snapshots = new Map<number, { version: number; value: string[] }>();

function snapshot(n: number): string[] {
  const cached = snapshots.get(n);
  if (cached && cached.version === version) return cached.value;
  const value = topReactions(n);
  snapshots.set(n, { version, value });
  return value;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** `topReactions(n)`, kept current as reactions are used. */
export function useTopReactions(n: number): string[] {
  return useSyncExternalStore(subscribe, () => snapshot(n), () => snapshot(n));
}

/** For tests: forget everything. */
export function resetReactionUsage(): void {
  usage = {};
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  version += 1;
  listeners.forEach((listener) => listener());
}
