import type { PresenceStatus } from "../users/types";

export const PRESENCE: Record<PresenceStatus, { label: string; color: string }> = {
  online: { label: "Online", color: "#9fd487" },
  idle: { label: "Idle", color: "#e3ae4f" },
  dnd: { label: "Do not disturb", color: "#e2654f" },
  afk: { label: "Away", color: "#a99e8b" },
  offline: { label: "Offline", color: "#5f574b" },
};

export const isOnline = (status: PresenceStatus): boolean => status !== "offline";

/** The backend may add statuses later; anything unknown renders as offline. */
export function asPresence(value: string | null | undefined): PresenceStatus {
  return value && value in PRESENCE ? (value as PresenceStatus) : "offline";
}
