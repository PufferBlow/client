import { useCallback, useSyncExternalStore } from "react";

/**
 * Who is typing where. A scope is a channel id or a DM conversation id (the same ids the message
 * cache uses). Entries come from `typing.started` events and expire on their own: the server has no
 * "stopped typing" event, so someone who stops simply isn't renewed.
 */
const typing = new Map<string, Map<string, number>>();
const listeners = new Set<() => void>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
/** Stable snapshots per scope, so `useSyncExternalStore` only re-renders on a real change. */
const snapshots = new Map<string, readonly string[]>();
const EMPTY: readonly string[] = [];

function emit(scope: string): void {
  const users = typing.get(scope);
  if (users && users.size > 0) snapshots.set(scope, [...users.keys()]);
  else {
    typing.delete(scope);
    snapshots.delete(scope);
  }
  listeners.forEach((listener) => listener());
}

function timerKey(scope: string, userId: string): string {
  return `${scope}\u0000${userId}`;
}

/** Show `userId` as typing in `scope` for `expiresInMs`, renewing any earlier announcement. */
export function noteTyping(scope: string, userId: string, expiresInMs: number): void {
  if (!scope || !userId) return;
  const key = timerKey(scope, userId);
  clearTimeout(timers.get(key));
  timers.set(
    key,
    setTimeout(() => clearTyping(scope, userId), expiresInMs),
  );

  let users = typing.get(scope);
  if (!users) typing.set(scope, (users = new Map()));
  const isNew = !users.has(userId);
  users.set(userId, Date.now() + expiresInMs);
  if (isNew) emit(scope);
}

/** Stop showing `userId` as typing in `scope`, e.g. because their message just arrived. */
export function clearTyping(scope: string, userId: string): void {
  const key = timerKey(scope, userId);
  clearTimeout(timers.get(key));
  timers.delete(key);
  if (typing.get(scope)?.delete(userId)) emit(scope);
}

/** Forget everyone, e.g. between tests or on sign-out. */
export function resetTyping(): void {
  timers.forEach((timer) => clearTimeout(timer));
  timers.clear();
  const scopes = [...typing.keys()];
  typing.clear();
  scopes.forEach(emit);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The ids of the people typing in `scope`, in the order they started. */
export function useTypingUsers(scope: string): readonly string[] {
  const getSnapshot = useCallback(() => snapshots.get(scope) ?? EMPTY, [scope]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
