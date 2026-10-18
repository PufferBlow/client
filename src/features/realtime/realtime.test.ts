import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { channelKeys } from "../channels/hooks";
import type { UnreadCounts } from "../channels/types";
import { friendKeys } from "../friends/hooks";
import type { Friend } from "../friends/types";
import { messageKeys, type MessageCache } from "../messages/cache";
import type { Message } from "../messages/types";
import { userKeys } from "../users/hooks";
import type { UserProfile } from "../users/types";
import { applyEvent } from "./applyEvent";
import { RealtimeClient, type ConnectionStatus } from "./client";
import type { RealtimeEvent } from "./events";
import type { ServerFrame } from "./protocol";

const message = (overrides: Partial<Message> = {}): Message => ({
  id: "m1",
  channelId: "c1",
  authorId: "other",
  authorName: "grace",
  authorAvatarUrl: null,
  text: "hi",
  sentAt: "t",
  attachments: [],
  reactions: [],
  editCount: 0,
  editedAt: null,
  ...overrides,
});

describe("applyEvent", () => {
  let client: QueryClient;
  beforeEach(() => {
    client = new QueryClient();
  });

  const seedMessages = (channelId = "c1", messages: Message[] = []) =>
    client.setQueryData<MessageCache>(messageKeys.channel(channelId), { pageParams: [null], pages: [{ messages, nextCursor: null }] });
  const cachedIds = (channelId = "c1") => client.getQueryData<MessageCache>(messageKeys.channel(channelId))!.pages[0]!.messages.map((m) => m.id);
  const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
    user_id: "me",
    username: "ada",
    about: null,
    status: "online",
    accent_color: null,
    avatar_url: null,
    origin_server: "x",
    ...overrides,
  });

  it("adds a message to a cached channel exactly once", () => {
    seedMessages();
    const event: RealtimeEvent = { kind: "message", message: message() };
    applyEvent(client, event, { activeChannelId: "c1" });
    applyEvent(client, event, { activeChannelId: "c1" });
    expect(cachedIds()).toEqual(["m1"]);
  });

  it("does not create a cache for a channel that was never opened", () => {
    applyEvent(client, { kind: "message", message: message() }, { activeChannelId: "other" });
    expect(client.getQueryData(messageKeys.channel("c1"))).toBeUndefined();
  });

  it("counts unread for messages in other channels", () => {
    client.setQueryData<UnreadCounts>(channelKeys.unread, { c1: 1 });
    applyEvent(client, { kind: "message", message: message() }, { activeChannelId: "c2" });
    applyEvent(client, { kind: "message", message: message({ id: "m2" }) }, { activeChannelId: "c2" });
    expect(client.getQueryData<UnreadCounts>(channelKeys.unread)).toEqual({ c1: 3 });
  });

  it("starts an unread count for a channel that had none", () => {
    applyEvent(client, { kind: "message", message: message({ channelId: "new" }) }, { activeChannelId: undefined });
    expect(client.getQueryData<UnreadCounts>(channelKeys.unread)).toEqual({ new: 1 });
  });

  it("does not count the open channel or your own messages", () => {
    client.setQueryData(userKeys.profile, profile());
    client.setQueryData<UnreadCounts>(channelKeys.unread, { c1: 0 });

    applyEvent(client, { kind: "message", message: message() }, { activeChannelId: "c1" });
    applyEvent(client, { kind: "message", message: message({ id: "m2", authorId: "me" }) }, { activeChannelId: "c2" });

    expect(client.getQueryData<UnreadCounts>(channelKeys.unread)).toEqual({ c1: 0 });
  });

  it("applies edits and reactions to the cached message", () => {
    seedMessages("c1", [message()]);
    applyEvent(client, { kind: "message_edited", channelId: "c1", messageId: "m1", text: "edited", editCount: 1, editedAt: "t2" }, { activeChannelId: "c1" });
    applyEvent(client, { kind: "reactions", channelId: "c1", messageId: "m1", reactions: [{ emoji: "👍", count: 1, userIds: ["x"] }] }, { activeChannelId: "c1" });

    const cached = client.getQueryData<MessageCache>(messageKeys.channel("c1"))!.pages[0]!.messages[0]!;
    expect(cached).toMatchObject({ text: "edited", editCount: 1, editedAt: "t2" });
    expect(cached.reactions).toHaveLength(1);
  });

  it("updates presence across the user list, your profile and friends", () => {
    client.setQueryData<UserProfile[]>(userKeys.list, [profile({ user_id: "u1" }), profile({ user_id: "u2" })]);
    client.setQueryData(userKeys.profile, profile({ user_id: "u1" }));
    client.setQueryData<Friend[]>(friendKeys.list, [
      { friendshipId: "f", userId: "u1", username: "a", host: "", avatarUrl: null, status: "online" },
    ]);

    applyEvent(client, { kind: "presence", userId: "u1", status: "offline" }, { activeChannelId: undefined });

    expect(client.getQueryData<UserProfile[]>(userKeys.list)!.map((u) => u.status)).toEqual(["offline", "online"]);
    expect(client.getQueryData<UserProfile>(userKeys.profile)!.status).toBe("offline");
    expect(client.getQueryData<Friend[]>(friendKeys.list)![0]!.status).toBe("offline");
  });

  it("ignores presence for data that isn't cached", () => {
    expect(() => applyEvent(client, { kind: "presence", userId: "u1", status: "idle" }, { activeChannelId: undefined })).not.toThrow();
    expect(client.getQueryData(userKeys.list)).toBeUndefined();
  });

  it("removes a deleted message", () => {
    seedMessages("c1", [message({ id: "m1" }), message({ id: "m2" })]);
    applyEvent(client, { kind: "message_deleted", channelId: "c1", messageId: "m1" }, { activeChannelId: "c1" });
    expect(cachedIds()).toEqual(["m2"]);
  });

  it("drops a channel's cached messages when it is deleted or access is revoked, and refreshes the list", () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    for (const change of ["deleted", "revoked"] as const) {
      seedMessages("c1", [message()]);
      applyEvent(client, { kind: "channel", channelId: "c1", change }, { activeChannelId: undefined });
      expect(client.getQueryData(messageKeys.channel("c1"))).toBeUndefined();
    }
    expect(invalidate).toHaveBeenCalledWith({ queryKey: channelKeys.list });
  });

  it("keeps messages when a channel is merely updated", () => {
    seedMessages("c1", [message()]);
    applyEvent(client, { kind: "channel", channelId: "c1", change: "updated" }, { activeChannelId: undefined });
    expect(cachedIds()).toEqual(["m1"]);
  });

  it("refreshes the channel list when a channel is created or shared", () => {
    const invalidate = vi.spyOn(client, "invalidateQueries");
    for (const change of ["created", "granted"] as const) {
      applyEvent(client, { kind: "channel", channelId: "c2", change }, { activeChannelId: undefined });
    }
    expect(invalidate).toHaveBeenCalledTimes(2);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: channelKeys.list });
  });
});

class FakeSocket {
  static instances: FakeSocket[] = [];
  static readonly OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closeArgs: unknown[] | null = null;

  constructor(
    public url: string,
    public protocols: string[] = [],
  ) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(...args: unknown[]) {
    this.closeArgs = args;
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  receive(data: unknown) {
    this.onmessage?.({ data: typeof data === "string" ? data : JSON.stringify(data) } as MessageEvent);
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
}

describe("RealtimeClient", () => {
  let frames: ServerFrame[];
  let statuses: ConnectionStatus[];
  let reconnects: number;
  let url: string | null;

  let clients: RealtimeClient[];
  const make = (extra: Partial<ConstructorParameters<typeof RealtimeClient>[0]> = {}) => {
    const client = new RealtimeClient({
      buildUrl: () => url,
      onFrame: (f) => frames.push(f),
      onStatus: (s) => statuses.push(s),
      onReconnect: () => reconnects++,
      ...extra,
    });
    clients.push(client);
    return client;
  };
  const latest = () => FakeSocket.instances.at(-1)!;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5); // jitter factor 1.0
    vi.stubGlobal("WebSocket", FakeSocket);
    FakeSocket.instances = [];
    clients = [];
    frames = [];
    statuses = [];
    reconnects = 0;
    url = "ws://localhost:7575/ws?protocol=1&auth_token=t";
  });
  afterEach(() => {
    // Stop everything so `online` listeners don't leak into later tests.
    for (const client of clients) client.stop();
    vi.useRealTimers();
  });

  it("connects to the URL it is given and reports status", async () => {
    const client = make();
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    // The token rides in a subprotocol, not the URL.
    expect(latest().url).toBe("ws://localhost:7575/ws?protocol=1");
    expect(latest().protocols).toEqual(["pufferblow.v1", "bearer.t"]);

    latest().open();
    expect(statuses).toEqual(["connecting", "connected"]);
    client.stop();
  });

  it("delivers decoded v1 frames, hides pongs and ignores garbage", async () => {
    const client = make();
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    latest().open();

    latest().receive({ type: "pong" });
    latest().receive({ type: "hello", version: 1, supported: [1], session_id: "s", epoch: "e" });
    latest().receive({ type: "user_status_changed", user_id: "u1", status: "idle" }); // legacy frame: no longer understood
    latest().receive("garbage");

    expect(frames).toEqual([{ type: "hello", supported: [1], sessionId: "s", epoch: "e" }]);
    client.stop();
  });

  it("sends text frames only while the socket is open", async () => {
    const client = make();
    expect(client.send("x")).toBe(false);
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(client.send("x")).toBe(false);
    latest().open();
    expect(client.send("x")).toBe(true);
    expect(latest().sent).toContain("x");
    client.stop();
  });

  it("reports each close so in-flight commands can be failed", async () => {
    const onClose = vi.fn();
    const client = make({ onClose });
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    latest().open();
    latest().drop();
    expect(onClose).toHaveBeenCalledTimes(1);
    client.stop();
    expect(onClose).toHaveBeenCalledTimes(1); // an explicit stop is not a drop
  });

  it("does not connect when signed out", async () => {
    url = null;
    make().start();
    await vi.advanceTimersByTimeAsync(0);
    expect(FakeSocket.instances).toHaveLength(0);
    expect(statuses.at(-1)).toBe("disconnected");
  });

  it("pings every 30 seconds", async () => {
    const client = make();
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    latest().open();

    await vi.advanceTimersByTimeAsync(30_000);
    expect(latest().sent).toEqual([JSON.stringify({ type: "ping" })]);
    client.stop();
  });

  it("closes a link that never answers a ping, then reconnects", async () => {
    const client = make();
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    const first = latest();
    first.open();

    await vi.advanceTimersByTimeAsync(30_000); // ping sent, no reply
    await vi.advanceTimersByTimeAsync(9_999);
    expect(first.readyState).toBe(1);
    await vi.advanceTimersByTimeAsync(1); // 10 s without an answer
    expect(first.readyState).toBe(3);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeSocket.instances).toHaveLength(2);
    client.stop();
  });

  it("treats any inbound frame as proof of life", async () => {
    const client = make();
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    const socket = latest();
    socket.open();

    await vi.advanceTimersByTimeAsync(30_000); // ping sent
    await vi.advanceTimersByTimeAsync(5_000);
    socket.receive({ type: "pong" }); // answered inside the 10 s deadline
    await vi.advanceTimersByTimeAsync(10_000); // past where the deadline would have been

    expect(socket.readyState).toBe(1);
    client.stop();
  });

  it("reconnects with exponential backoff and never gives up", async () => {
    const client = make();
    client.start();
    await vi.advanceTimersByTimeAsync(0);

    for (const expectedDelay of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000, 30_000]) {
      const before = FakeSocket.instances.length;
      latest().drop();
      await vi.advanceTimersByTimeAsync(expectedDelay - 1);
      expect(FakeSocket.instances).toHaveLength(before);
      await vi.advanceTimersByTimeAsync(1);
      expect(FakeSocket.instances).toHaveLength(before + 1);
    }
    client.stop();
  });

  it("reports a reconnect only after the first successful connection", async () => {
    const client = make();
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    latest().open();
    expect(reconnects).toBe(0);

    latest().drop();
    await vi.advanceTimersByTimeAsync(1_000);
    latest().open();
    expect(reconnects).toBe(1);
    client.stop();
  });

  it("resets the backoff after a successful connection", async () => {
    const client = make();
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    latest().drop();
    await vi.advanceTimersByTimeAsync(1_000);
    latest().drop();
    await vi.advanceTimersByTimeAsync(2_000);
    latest().open();

    latest().drop();
    const before = FakeSocket.instances.length;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeSocket.instances).toHaveLength(before + 1);
    client.stop();
  });

  it("asks for fresh credentials from the third attempt on", async () => {
    const refresh = vi.fn().mockResolvedValue(true);
    const client = make({ refreshCredentials: refresh });
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(refresh).not.toHaveBeenCalled();

    latest().drop();
    await vi.advanceTimersByTimeAsync(1_000);
    latest().drop();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(refresh).toHaveBeenCalledTimes(1);
    client.stop();
  });

  it("tries one refresh when the token has gone missing", async () => {
    url = null;
    const refresh = vi.fn().mockImplementation(async () => {
      url = "ws://localhost:7575/ws?auth_token=fresh";
    });
    make({ refreshCredentials: refresh }).start();
    await vi.advanceTimersByTimeAsync(0);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(latest().protocols).toContain("bearer.fresh");
  });

  it("stops cleanly: closes the socket and never reconnects", async () => {
    const client = make();
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    const socket = latest();
    socket.open();

    client.stop();
    await vi.advanceTimersByTimeAsync(120_000);

    expect(socket.closeArgs).toEqual([1000, "client closing"]);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(statuses.at(-1)).toBe("disconnected");
  });

  it("reconnects right away when the browser comes back online", async () => {
    const client = make();
    client.start();
    await vi.advanceTimersByTimeAsync(0);
    latest().drop();

    window.dispatchEvent(new Event("online"));
    await vi.advanceTimersByTimeAsync(0);

    expect(FakeSocket.instances).toHaveLength(2);
    client.stop();
  });
});
