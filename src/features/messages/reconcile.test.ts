import { describe, expect, it } from "vitest";
import { failPending, flattenMessages, overlapsCache, reconcileWindow, restartPending, settlePending, type MessageCache } from "./cache";
import type { Message } from "./types";

const at = (minute: number) => `2030-01-01T10:${String(minute).padStart(2, "0")}:00+00:00`;
const msg = (id: string, minute: number, overrides: Partial<Message> = {}): Message => ({
  id,
  channelId: "c1",
  authorId: "u1",
  authorName: "ada",
  authorAvatarUrl: null,
  text: `text ${id}`,
  sentAt: at(minute),
  attachments: [],
  reactions: [],
  editCount: 0,
  editedAt: null,
  ...overrides,
});
const cache = (...messages: Message[]): MessageCache => ({ pageParams: [null], pages: [{ messages, nextCursor: null }] });
const ids = (c: MessageCache | undefined) => flattenMessages(c).map((m) => m.id);

describe("reconcileWindow", () => {
  it("adds messages that were missed", () => {
    expect(ids(reconcileWindow(cache(msg("a", 1)), [msg("a", 1), msg("b", 2), msg("c", 3)]))).toEqual(["a", "b", "c"]);
  });

  it("takes the server's copy of a message that changed while away", () => {
    const result = reconcileWindow(cache(msg("a", 1, { text: "old" })), [msg("a", 1, { text: "new", editCount: 1 })]);
    expect(flattenMessages(result)[0]).toMatchObject({ text: "new", editCount: 1 });
  });

  it("drops cached messages inside the window that the server no longer has", () => {
    const result = reconcileWindow(cache(msg("a", 1), msg("gone", 2), msg("c", 3)), [msg("a", 1), msg("c", 3)]);
    expect(ids(result)).toEqual(["a", "c"]);
  });

  it("keeps messages older than the window, which the resync says nothing about", () => {
    const result = reconcileWindow(cache(msg("old", 0), msg("a", 5)), [msg("a", 5), msg("b", 6)]);
    expect(ids(result)).toEqual(["old", "a", "b"]);
  });

  it("never drops a message that is still being sent or failed to send", () => {
    const pending = msg("local_1", 9, { status: "pending", nonce: "n1" });
    const failed = msg("local_2", 9, { status: "failed", nonce: "n2" });
    const result = reconcileWindow(cache(msg("a", 5), pending, failed), [msg("a", 5)]);
    expect(ids(result)).toEqual(["a", "local_1", "local_2"]);
  });

  it("does nothing for an empty window or an uncached channel", () => {
    const c = cache(msg("a", 1));
    expect(reconcileWindow(c, [])).toBe(c);
    expect(reconcileWindow(undefined, [msg("a", 1)])).toBeUndefined();
  });

  it("does not mutate its input", () => {
    const c = cache(msg("a", 1), msg("gone", 2));
    const snapshot = JSON.stringify(c);
    reconcileWindow(c, [msg("a", 1)]);
    expect(JSON.stringify(c)).toBe(snapshot);
  });
});

describe("overlapsCache", () => {
  it("is true when any resynced message is already cached", () => {
    expect(overlapsCache(cache(msg("a", 1)), [msg("a", 1), msg("b", 2)])).toBe(true);
  });
  it("is false for disjoint windows or no cache", () => {
    expect(overlapsCache(cache(msg("a", 1)), [msg("x", 8)])).toBe(false);
    expect(overlapsCache(undefined, [msg("x", 8)])).toBe(false);
  });
});

describe("pending messages", () => {
  const pending = msg("local_n", 9, { status: "pending", nonce: "n" });

  it("settling swaps the local row for the server's", () => {
    const result = settlePending(cache(msg("a", 1), pending), "local_n", msg("m9", 9));
    expect(ids(result)).toEqual(["a", "m9"]);
  });

  it("settling after the event already added the server copy leaves one row", () => {
    const result = settlePending(cache(msg("a", 1), pending, msg("m9", 9)), "local_n", msg("m9", 9));
    expect(ids(result)).toEqual(["a", "m9"]);
  });

  it("marks failure and restarts", () => {
    const failed = failPending(cache(pending), "local_n", { message: "no", retryable: true });
    expect(flattenMessages(failed)[0]).toMatchObject({ status: "failed", failure: { message: "no", retryable: true } });
    const again = restartPending(failed, "local_n");
    expect(flattenMessages(again)[0]).toMatchObject({ status: "pending" });
    expect(flattenMessages(again)[0]!.failure).toBeUndefined();
  });
});
