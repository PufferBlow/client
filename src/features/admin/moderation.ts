/** One row of the instance audit log, as `POST /system/recent-activity` returns it. */
export interface AuditEntry {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  user: { id: string; username: string } | null;
  metadata: Record<string, unknown>;
}

export interface ModerationState {
  banned: boolean;
  /** When the person can speak again, if a timeout is still running. */
  timeoutUntil: Date | null;
}

const TARGETED = new Set(["user_banned", "user_unbanned", "user_timed_out", "user_timeout_cleared"]);

/**
 * Who is banned or timed out right now, worked out from the audit log: the instance records each
 * action there and keeps no separate list. The newest entry for a person wins, and a timeout that
 * has run out counts as over. `entries` are in any order.
 */
export function moderationStates(entries: readonly AuditEntry[], now: Date = new Date()): Map<string, ModerationState> {
  const ordered = entries.filter((e) => TARGETED.has(e.type)).sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const states = new Map<string, ModerationState>();
  for (const entry of ordered) {
    const id = entry.metadata.target_user_id;
    if (typeof id !== "string") continue;
    const state = states.get(id) ?? { banned: false, timeoutUntil: null };
    if (entry.type === "user_banned") state.banned = true;
    else if (entry.type === "user_unbanned") state.banned = false;
    else if (entry.type === "user_timeout_cleared") state.timeoutUntil = null;
    else {
      const until = typeof entry.metadata.expires_at === "string" ? new Date(entry.metadata.expires_at) : null;
      state.timeoutUntil = until && !Number.isNaN(until.getTime()) ? until : null;
    }
    states.set(id, state);
  }
  for (const state of states.values()) if (state.timeoutUntil && state.timeoutUntil <= now) state.timeoutUntil = null;
  return states;
}

/** "5 minutes", "2 hours", "3 days": a timeout length, in the largest unit that fits whole. */
export function durationLabel(minutes: number): string {
  const unit = (n: number, name: string) => `${n} ${name}${n === 1 ? "" : "s"}`;
  if (minutes % 1440 === 0) return unit(minutes / 1440, "day");
  if (minutes % 60 === 0) return unit(minutes / 60, "hour");
  return unit(minutes, "minute");
}

/** The timeout lengths the screen offers, in minutes (the server allows 1 minute to 28 days). */
export const TIMEOUT_CHOICES = [5, 60, 1440, 10080] as const;

/** A readable name for an audit type: `user_roles_updated` becomes "User roles updated". */
export function actionLabel(type: string): string {
  const words = type.replace(/_/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
