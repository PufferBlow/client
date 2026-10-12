import type { Message } from "./types";

/** Messages closer together than this (from the same author) share a group. */
export const GROUP_WINDOW_MS = 5 * 60_000;

export interface GroupingOptions {
  /** Threshold in milliseconds; a gap equal to it starts a new group. */
  windowMs?: number;
  /** IANA zone used to decide what "the same day" means. Defaults to the viewer's zone. */
  timeZone?: string;
}

export interface GroupedMessage {
  message: Message;
  /** True when this row shows the avatar/name header; false when it continues the row above. */
  startsGroup: boolean;
}

const dayFormatters = new Map<string, Intl.DateTimeFormat>();

function dayKey(time: number, timeZone: string | undefined): string {
  const cacheKey = timeZone ?? "";
  let formatter = dayFormatters.get(cacheKey);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
    dayFormatters.set(cacheKey, formatter);
  }
  return formatter.format(time);
}

/**
 * Whether `current` continues the group that `previous` belongs to. Only the adjacent pair is
 * compared, so a long run of quick replies stays one group however long it gets.
 */
export function continuesGroup(
  previous: Message | undefined,
  current: Message,
  { windowMs = GROUP_WINDOW_MS, timeZone }: GroupingOptions = {},
): boolean {
  if (!previous) return false;
  if (previous.channelId !== current.channelId) return false;
  if (!current.authorId || previous.authorId !== current.authorId) return false;
  if (previous.kind === "system" || current.kind === "system") return false;

  const before = Date.parse(previous.sentAt);
  const after = Date.parse(current.sentAt);
  if (Number.isNaN(before) || Number.isNaN(after)) return false;

  const gap = after - before;
  if (gap < 0 || gap >= windowMs) return false;

  return dayKey(before, timeZone) === dayKey(after, timeZone);
}

/**
 * Derives group boundaries for a channel's messages. The input is sorted chronologically first
 * (stable, so equal timestamps keep their order) and compared by data, never by DOM position,
 * so page seams and later virtualisation behave the same as the middle of a page.
 */
export function groupMessages(messages: readonly Message[], options: GroupingOptions = {}): GroupedMessage[] {
  const ordered = messages
    .map((message, index) => ({ message, index, time: Date.parse(message.sentAt) }))
    .sort((a, b) => {
      if (Number.isNaN(a.time) || Number.isNaN(b.time)) return a.index - b.index;
      return a.time - b.time || a.index - b.index;
    });

  return ordered.map(({ message }, i) => ({
    message,
    startsGroup: !continuesGroup(ordered[i - 1]?.message, message, options),
  }));
}
