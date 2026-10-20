import type { PresenceStatus } from "../users/types";

/**
 * How each status looks. Online is white, idle and away are a hollow grey dot, offline has no dot
 * and a dimmed avatar. Red is kept for "do not disturb" because it means something. The sage dot is
 * not a status: it is "in a call or a game", which {@link Avatar} takes as `activity`.
 */
export type PresenceDot = "solid" | "hollow" | "none";

export const PRESENCE: Record<PresenceStatus, { label: string; color: string; dot: PresenceDot }> = {
  online: { label: "Online", color: "#f2f2f2", dot: "solid" },
  idle: { label: "Idle", color: "#9a9a9a", dot: "hollow" },
  dnd: { label: "Do not disturb", color: "#e2654f", dot: "solid" },
  afk: { label: "Away", color: "#9a9a9a", dot: "hollow" },
  offline: { label: "Offline", color: "#555555", dot: "none" },
};

/** The colour of the "in a call / in a game" dot. */
export const ACTIVITY_COLOR = "#9fd487";

export const isOnline = (status: PresenceStatus): boolean => status !== "offline";

/** The backend may add statuses later; anything unknown renders as offline. */
export function asPresence(value: string | null | undefined): PresenceStatus {
  return value && value in PRESENCE ? (value as PresenceStatus) : "offline";
}
