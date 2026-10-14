import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../messages/types";
import type { RealtimeEvent } from "./events";
import { RealtimeSession, type SessionOptions } from "./session";

class FakeSocket {
  static instances: FakeSocket[] = [];
  static readonly OPEN = 1;
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = FakeSocket.OPEN;
    this.onopen?.();
  }
  receive(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
  commands() {
    return this.sent.filter((f) => f.type === "command");
  }
}

const hello = (epoch = "ep_1") => ({ type: "hello", version: 1, supported: [1], session_id: "s", epoch });
const view = (id: string, channel = "c1", text = "hi") => ({
  id,
  channel_id: channel,
  author_id: "u1",
  author_name: "ada",
  author_avatar_url: null,
  content: text,
  attachments: [],
  reactions: [],
  created_at: "2030-01-01T10:00:00+00:00",
  edit_count: 0,
  last_edited_at: null,
});
let eventCounter = 0;
const created = (id: string, seq: number, channel = "c1", eventId = `evt_${++eventCounter}`) => ({
  type: "event",
  version: 1,
  id: eventId,
  name: "message.created",
  channel_id: channel,
  seq,
  epoch: "ep_1",
  data: view(id, channel),
});
const ackFor = (command: Record<string, unknown>, result: Record<string, unknown>) => ({
  type: "ack",
  version: 1,
  id: command.id,
  data: { status: "completed", result },
});

describe("RealtimeSession", () => {
  let events: RealtimeEvent[];
  let resyncs: { channelId: string; messages: Message[] }[];
  let reconnects: number;
  let open: string[];
  let sessions: RealtimeSession[];

  const make = (extra: Partial<SessionOptions> = {}) => {
    const session = new RealtimeSession({
      buildUrl: () => "ws://localhost/ws?protocol=1&auth_token=t",
      onStatus: () => undefined,
      onEvent: (e) => events.push(e),
      onResync: (channelId, messages) => resyncs.push({ channelId, messages }),
      openChannelIds: () => open,
      onReconnect: () => reconnects++,
      commandTimeoutMs: 1000,
      ...extra,
    });
    sessions.push(session);
    return session;
  };
  const socket = () => FakeSocket.instances.at(-1)!;
  const connect = async (session: RealtimeSession) => {
    session.start();
    await vi.advanceTimersByTimeAsync(0);
    socket().open();
    socket().receive(hello());
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    vi.stubGlobal("WebSocket", FakeSocket);
    FakeSocket.instances = [];
    events = [];
    resyncs = [];
    reconnects = 0;
    open = [];
    sessions = [];
  });
  afterEach(() => {
    for (const session of sessions) session.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("applies an event once even if the server repeats it", async () => {
    await connect(make());
    const frame = created("m1", 1);
    socket().receive(frame);
    socket().receive(frame);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: "message", message: { id: "m1" } });
  });

  it("does not resync when events arrive in order", async () => {
    await connect(make());
    socket().receive(created("m1", 1));
    socket().receive(created("m2", 2));
    expect(socket().commands()).toHaveLength(0);
  });

  it("applies the event that revealed a gap, then resyncs that channel and reports the window", async () => {
    await connect(make());
    socket().receive(created("m1", 1));
    socket().receive(created("m4", 4)); // 2 and 3 never arrived

    expect(events).toHaveLength(2);
    const [command] = socket().commands();
    expect(command).toMatchObject({ name: "events.resync", data: { channel_id: "c1" } });

    socket().receive(ackFor(command!, { channel_id: "c1", messages: [view("m1"), view("m2"), view("m3"), view("m4")], seq: 4, epoch: "ep_1" }));
    await vi.advanceTimersByTimeAsync(0);

    expect(resyncs).toHaveLength(1);
    expect(resyncs[0]!.channelId).toBe("c1");
    expect(resyncs[0]!.messages.map((m) => m.id)).toEqual(["m1", "m2", "m3", "m4"]);

    socket().receive(created("m5", 5)); // the baseline moved to 4, so this is in order
    expect(socket().commands()).toHaveLength(1);
  });

  it("resyncs one channel at a time", async () => {
    await connect(make());
    socket().receive(created("a1", 1, "a"));
    socket().receive(created("a3", 3, "a"));
    socket().receive(created("b1", 1, "b"));
    socket().receive(created("b3", 3, "b"));

    expect(socket().commands()).toHaveLength(1);
    socket().receive(ackFor(socket().commands()[0]!, { channel_id: "a", messages: [], seq: 3, epoch: "ep_1" }));
    await vi.advanceTimersByTimeAsync(0);
    expect(socket().commands()).toHaveLength(2);
    expect(socket().commands()[1]).toMatchObject({ data: { channel_id: "b" } });
  });

  it("catches up open channels after a reconnect, not on the first connection", async () => {
    open = ["c1", "c2"];
    const session = make();
    await connect(session);
    expect(reconnects).toBe(0);
    expect(socket().commands()).toHaveLength(0);

    socket().drop();
    await vi.advanceTimersByTimeAsync(2000);
    socket().open();
    socket().receive(hello());

    expect(reconnects).toBe(1);
    expect(socket().commands()).toHaveLength(1);
    expect(socket().commands()[0]).toMatchObject({ name: "events.resync", data: { channel_id: "c1" } });
  });

  it("treats a changed epoch as a restart and refetches too", async () => {
    open = ["c1"];
    const session = make();
    await connect(session);
    socket().drop();
    await vi.advanceTimersByTimeAsync(2000);
    socket().open();
    socket().receive(hello("ep_2"));
    expect(reconnects).toBe(1);
    expect(socket().commands()).toHaveLength(1);
  });

  it("resyncs a channel whose event carries a new epoch", async () => {
    await connect(make());
    socket().receive(created("m1", 1));
    socket().receive({ ...created("m2", 1), epoch: "ep_2" });
    expect(socket().commands()).toHaveLength(1);
  });

  it("fails commands that were in flight when the socket dropped", async () => {
    const session = make();
    await connect(session);
    const pending = session.commands.createMessage({ channelId: "c1", content: "hi", nonce: "n1" });
    const assertion = expect(pending).rejects.toMatchObject({ code: "DISCONNECTED", retryable: true });
    socket().drop();
    await assertion;
  });

  it("creates a message through message.create and returns the server's message", async () => {
    const session = make();
    await connect(session);
    const pending = session.commands.createMessage({ channelId: "c1", content: "hi", nonce: "n1" });
    const [command] = socket().commands();
    expect(command).toMatchObject({ name: "message.create", data: { channel_id: "c1", content: "hi", nonce: "n1" } });
    socket().receive(ackFor(command!, { message: view("m1") }));
    await expect(pending).resolves.toMatchObject({ id: "m1", text: "hi", authorName: "ada" });
  });

  it("surfaces a refused command as an error with the server's code", async () => {
    const session = make();
    await connect(session);
    const pending = session.commands.deleteMessage("c1", "m1");
    const [command] = socket().commands();
    socket().receive({ type: "error", version: 1, id: command!.id, error: { code: "PERMISSION_DENIED", message: "no", retryable: false } });
    await expect(pending).rejects.toMatchObject({ code: "PERMISSION_DENIED", retryable: false });
  });

  it("rejects commands immediately while disconnected", async () => {
    const session = make();
    await expect(session.commands.createMessage({ channelId: "c1", content: "x", nonce: "n" })).rejects.toMatchObject({ code: "NOT_CONNECTED" });
  });

  describe("subscriptions", () => {
    it("assumes the first channel list is what the server subscribed at connect", async () => {
      const session = make();
      await connect(session);
      session.syncChannels(["a", "b"]);
      expect(socket().commands()).toHaveLength(0);
    });

    it("subscribes to channels that appear later, once each", async () => {
      const session = make();
      await connect(session);
      session.syncChannels(["a"]);
      session.syncChannels(["a", "new"]);
      session.syncChannels(["a", "new"]);
      expect(socket().commands()).toHaveLength(1);
      expect(socket().commands()[0]).toMatchObject({ name: "channel.subscribe", data: { channel_id: "new" } });
    });

    it("tries again after a refused subscribe", async () => {
      const session = make();
      await connect(session);
      session.syncChannels(["a"]);
      session.syncChannels(["a", "new"]);
      socket().receive({ type: "error", version: 1, id: socket().commands()[0]!.id, error: { code: "NOT_FOUND", message: "x", retryable: false } });
      await vi.advanceTimersByTimeAsync(0);
      session.syncChannels(["a", "new"]);
      expect(socket().commands()).toHaveLength(2);
    });

    it("starts over on a new connection", async () => {
      const session = make();
      await connect(session);
      session.syncChannels(["a"]);
      socket().drop();
      await vi.advanceTimersByTimeAsync(2000);
      socket().open();
      socket().receive(hello());
      session.syncChannels(["a", "b"]); // the new connection's baseline: covered by the server
      expect(socket().commands().filter((c) => c.name === "channel.subscribe")).toHaveLength(0);
    });

    it("does not subscribe to a channel the server already subscribed it to", async () => {
      const session = make();
      await connect(session);
      session.syncChannels(["a"]);
      socket().receive({ type: "event", version: 1, id: "evt_new", name: "channel.created", channel_id: "new", data: { channel_id: "new" } });
      socket().receive({ type: "event", version: 1, id: "evt_grant", name: "channel.updated", channel_id: "shared", data: { channel_id: "shared", access: "granted" } });
      session.syncChannels(["a", "new", "shared"]);
      expect(socket().commands()).toHaveLength(0);
    });

    it("does nothing while disconnected", () => {
      const session = make();
      expect(() => session.syncChannels(["a"])).not.toThrow();
    });
  });

  it("forwards channel deletion and revoked access, and stops tracking that channel", async () => {
    await connect(make());
    socket().receive(created("m1", 1));
    socket().receive({ type: "event", version: 1, id: "evt_rev", name: "channel.updated", channel_id: "c1", data: { channel_id: "c1", access: "revoked" } });
    expect(events.at(-1)).toEqual({ kind: "channel", channelId: "c1", change: "revoked" });
    socket().receive(created("m9", 50)); // no baseline any more, so no gap
    expect(socket().commands()).toHaveLength(0);
  });
});
