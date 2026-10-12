import { describe, expect, it } from "vitest";
import { removeMessage, upsertMessage, type MessageCache } from "./cache";
import { continuesGroup, GROUP_WINDOW_MS, groupMessages } from "./grouping";
import type { Message } from "./types";

let counter = 0;
const msg = (overrides: Partial<Message> & { at?: string } = {}): Message => {
  const { at, ...rest } = overrides;
  counter += 1;
  return {
    id: `m${counter}`,
    channelId: "c1",
    authorId: "alice",
    authorName: "Alice",
    authorAvatarUrl: null,
    text: "hi",
    sentAt: `2030-01-01T${at ?? "14:32:00"}Z`,
    attachments: [],
    reactions: [],
    editCount: 0,
    editedAt: null,
    ...rest,
  };
};

const UTC = { timeZone: "UTC" };
const starts = (messages: Message[], options = UTC) => groupMessages(messages, options).map((r) => r.startsGroup);

describe("continuesGroup", () => {
  it("groups the same author inside the window", () => {
    expect(continuesGroup(msg({ at: "14:32:00" }), msg({ at: "14:32:10" }), UTC)).toBe(true);
  });

  it("groups a gap just under the threshold", () => {
    expect(continuesGroup(msg({ at: "14:00:00" }), msg({ at: "14:04:59" }), UTC)).toBe(true);
  });

  it("starts a new group when the gap equals the threshold", () => {
    expect(continuesGroup(msg({ at: "14:00:00" }), msg({ at: "14:05:00" }), UTC)).toBe(false);
  });

  it("starts a new group when the gap exceeds the threshold", () => {
    expect(continuesGroup(msg({ at: "14:00:00" }), msg({ at: "14:40:00" }), UTC)).toBe(false);
  });

  it("honours a custom window", () => {
    const a = msg({ at: "14:00:00" });
    const b = msg({ at: "14:00:30" });
    expect(continuesGroup(a, b, { ...UTC, windowMs: 10_000 })).toBe(false);
    expect(continuesGroup(a, b, { ...UTC, windowMs: 60_000 })).toBe(true);
  });

  it("exposes the default threshold as five minutes", () => {
    expect(GROUP_WINDOW_MS).toBe(5 * 60 * 1000);
  });

  it("never continues when there is no previous message", () => {
    expect(continuesGroup(undefined, msg(), UTC)).toBe(false);
  });

  it("splits different authors", () => {
    expect(continuesGroup(msg(), msg({ authorId: "bob" }), UTC)).toBe(false);
  });

  it("does not group messages with no author id", () => {
    expect(continuesGroup(msg({ authorId: "" }), msg({ authorId: "" }), UTC)).toBe(false);
  });

  it("splits different channels", () => {
    expect(continuesGroup(msg(), msg({ channelId: "c2" }), UTC)).toBe(false);
  });

  it("splits when the later message is older than the earlier one", () => {
    expect(continuesGroup(msg({ at: "14:32:10" }), msg({ at: "14:32:00" }), UTC)).toBe(false);
  });

  it("groups messages with identical timestamps", () => {
    expect(continuesGroup(msg({ at: "14:32:00" }), msg({ at: "14:32:00" }), UTC)).toBe(true);
  });

  it("splits across a calendar-day boundary even inside the window", () => {
    const before = msg({ sentAt: "2030-01-01T23:59:00Z" });
    const after = msg({ sentAt: "2030-01-02T00:01:00Z" });
    expect(continuesGroup(before, after, UTC)).toBe(false);
  });

  it("decides the day in the given time zone", () => {
    const before = msg({ sentAt: "2030-01-01T23:59:00Z" });
    const after = msg({ sentAt: "2030-01-02T00:01:00Z" });
    // Both fall on 2 January in Tokyo (UTC+9), so they group there but not in UTC.
    expect(continuesGroup(before, after, { timeZone: "Asia/Tokyo" })).toBe(true);
    expect(continuesGroup(before, after, UTC)).toBe(false);
  });

  it("treats system messages as boundaries on either side", () => {
    const user = msg();
    const system = msg({ kind: "system" });
    expect(continuesGroup(user, system, UTC)).toBe(false);
    expect(continuesGroup(system, user, UTC)).toBe(false);
  });

  it("splits on unparseable timestamps rather than guessing", () => {
    expect(continuesGroup(msg({ sentAt: "nope" }), msg(), UTC)).toBe(false);
  });
});

describe("groupMessages", () => {
  it("renders the documented example", () => {
    const rows = [
      msg({ at: "14:32:00" }),
      msg({ at: "14:32:10" }),
      msg({ at: "14:33:00" }),
      msg({ at: "14:33:05", authorId: "bob" }),
      msg({ at: "14:33:10" }),
      msg({ at: "14:40:00" }),
    ];
    expect(starts(rows)).toEqual([true, false, false, true, true, true]);
  });

  it("compares each message with the one before it, not the first in the group", () => {
    // Each step is 4 minutes; the last is 12 minutes after the first yet still grouped.
    const rows = [msg({ at: "14:00:00" }), msg({ at: "14:04:00" }), msg({ at: "14:08:00" }), msg({ at: "14:12:00" })];
    expect(starts(rows)).toEqual([true, false, false, false]);
  });

  it("sorts out-of-order input chronologically before grouping", () => {
    const late = msg({ at: "14:32:20" });
    const early = msg({ at: "14:32:00" });
    const middle = msg({ at: "14:32:10" });
    const rows = groupMessages([late, early, middle], UTC);
    expect(rows.map((r) => r.message)).toEqual([early, middle, late]);
    expect(rows.map((r) => r.startsGroup)).toEqual([true, false, false]);
  });

  it("keeps arrival order for identical timestamps", () => {
    const first = msg({ at: "14:32:00" });
    const second = msg({ at: "14:32:00" });
    expect(groupMessages([first, second]).map((r) => r.message)).toEqual([first, second]);
  });

  it("keeps channels separate", () => {
    expect(starts([msg(), msg({ channelId: "c2" }), msg({ channelId: "c2" })])).toEqual([true, true, false]);
  });

  it("starts a new group on both sides of a system message", () => {
    const rows = [msg({ at: "14:00:00" }), msg({ at: "14:00:10", kind: "system", authorId: "" }), msg({ at: "14:00:20" })];
    expect(starts(rows)).toEqual([true, true, true]);
  });

  it("does not regroup when a message is edited", () => {
    const rows = [msg({ at: "14:00:00" }), msg({ at: "14:00:10", editCount: 3, editedAt: "2030-01-01T15:00:00Z" })];
    expect(starts(rows)).toEqual([true, false]);
  });

  it("returns the original message objects", () => {
    const a = msg();
    expect(groupMessages([a])[0]?.message).toBe(a);
  });

  it("handles empty and single inputs", () => {
    expect(groupMessages([])).toEqual([]);
    expect(starts([msg()])).toEqual([true]);
  });

  describe("as the message cache changes", () => {
    const cacheOf = (...pages: Message[][]): MessageCache => ({
      pageParams: pages.map(() => null),
      pages: pages.map((messages) => ({ messages, nextCursor: null })),
    });
    const flat = (cache: MessageCache | undefined) => cache?.pages.flatMap((p) => p.messages) ?? [];

    it("groups a new real-time message with the one before it", () => {
      const next = upsertMessage(cacheOf([msg({ at: "14:32:00" })]), msg({ at: "14:32:10" }));
      expect(starts(flat(next))).toEqual([true, false]);
    });

    it("starts a new group for a real-time message from someone else", () => {
      const next = upsertMessage(cacheOf([msg({ at: "14:32:00" })]), msg({ at: "14:32:10", authorId: "bob" }));
      expect(starts(flat(next))).toEqual([true, true]);
    });

    it("regroups when a message in the middle is deleted", () => {
      const b = msg({ at: "14:00:10", authorId: "bob" });
      const cache = cacheOf([msg({ at: "14:00:00" }), b, msg({ at: "14:00:20" })]);
      expect(starts(flat(cache))).toEqual([true, true, true]);
      expect(starts(flat(removeMessage(cache, b.id)))).toEqual([true, false]);
    });

    it("promotes the next message to a group start when the first is deleted", () => {
      const first = msg({ at: "14:00:00" });
      const cache = cacheOf([first, msg({ at: "14:00:10" })]);
      expect(starts(flat(removeMessage(cache, first.id)))).toEqual([true]);
    });
  });

  describe("across page boundaries", () => {
    it("groups across the seam between an older and a newer page", () => {
      const older = [msg({ at: "13:58:00" }), msg({ at: "13:59:00" })];
      const newer = [msg({ at: "14:00:00" }), msg({ at: "14:00:30" })];
      expect(starts([...older, ...newer])).toEqual([true, false, false, false]);
    });

    it("still splits at the seam when the author differs", () => {
      const older = [msg({ at: "13:00:00", authorId: "bob" })];
      const newer = [msg({ at: "13:00:30" })];
      expect(starts([...older, ...newer])).toEqual([true, true]);
    });

    it("decides by data, so a virtualised list rendering one row still knows its group", () => {
      const all = [msg({ at: "14:00:00" }), msg({ at: "14:00:10" }), msg({ at: "14:00:20" })];
      const rows = groupMessages(all, UTC);
      expect(rows.slice(2).map((r) => r.startsGroup)).toEqual([false]);
    });
  });
});
