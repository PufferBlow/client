import { describe, expect, it } from "vitest";
import { toRealtimeEvent } from "./events";
import { buildCommand, parseFrameObject, parseServerFrame, type EventFrame } from "./protocol";

interface Fixture {
  direction: "server_to_client" | "client_to_server";
  frame: Record<string, unknown>;
}

// The server's shared contract: every fixture it publishes must be understood here.
const modules = import.meta.glob<Fixture>("./__fixtures__/*.json", { eager: true, import: "default" });
const fixtures = Object.entries(modules).map(([path, fixture]) => ({ name: path.replace(/^.*\/|\.json$/g, ""), ...fixture }));
const byName = (name: string) => fixtures.find((f) => f.name === name)!.frame;

describe("shared protocol fixtures", () => {
  it("are present", () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(19);
  });

  it.each(fixtures.filter((f) => f.direction === "server_to_client").map((f) => [f.name, f.frame] as const))(
    "%s parses as a server frame",
    (_name, frame) => {
      expect(parseFrameObject(frame)).not.toBeNull();
    },
  );

  it.each(fixtures.filter((f) => f.direction === "client_to_server").map((f) => [f.name, f.frame] as const))(
    "%s is what the client builds",
    (_name, frame) => {
      expect(buildCommand(frame.id as string, frame.name as string, frame.data as Record<string, unknown>)).toEqual(frame);
    },
  );
});

describe("parseServerFrame", () => {
  it("reads hello", () => {
    expect(parseFrameObject(byName("hello"))).toEqual({ type: "hello", supported: [1], sessionId: "ses_abc123", epoch: "ep_1" });
  });

  it("reads acks, including the duplicate flag", () => {
    const ack = parseFrameObject(byName("ack_message_create"));
    expect(ack).toMatchObject({ type: "ack", id: "cmd_1", duplicate: false, result: { message: { id: "m_8f2a" } } });
    expect(parseFrameObject(byName("ack_message_create_duplicate"))).toMatchObject({ type: "ack", id: "cmd_9", duplicate: true });
  });

  it("reads errors with and without a command id", () => {
    expect(parseFrameObject(byName("error_rate_limited"))).toEqual({
      type: "error",
      id: "cmd_1",
      code: "RATE_LIMITED",
      message: "You are sending commands too quickly.",
      retryable: true,
      retryAfter: 0.4,
    });
    expect(parseFrameObject(byName("error_malformed_no_id"))).toMatchObject({ id: null, code: "MALFORMED", retryable: false });
  });

  it("reads events with channel, sequence and epoch", () => {
    expect(parseFrameObject(byName("event_message_created"))).toMatchObject({
      type: "event",
      id: "evt_01",
      name: "message.created",
      channelId: "c_general",
      seq: 41,
      epoch: "ep_1",
    });
    expect(parseFrameObject(byName("event_presence_changed"))).toMatchObject({ channelId: null, seq: null });
  });

  it("accepts a pong, which has no version", () => {
    expect(parseServerFrame(JSON.stringify({ type: "pong" }))).toEqual({ type: "pong" });
  });

  it.each([
    ["not json"],
    [JSON.stringify([1, 2])],
    [JSON.stringify({ type: "event", version: 2, id: "e", name: "x", data: {} })],
    [JSON.stringify({ type: "event", version: 1, name: "x", data: {} })],
    [JSON.stringify({ type: "ack", version: 1, id: "cmd_1" })],
    [JSON.stringify({ type: "something_new", version: 1 })],
    [new ArrayBuffer(4)],
    [null],
  ])("ignores unknown or malformed frames (%j)", (input) => {
    expect(parseServerFrame(input)).toBeNull();
  });
});

describe("toRealtimeEvent", () => {
  const event = (name: string) => parseFrameObject(byName(name)) as EventFrame;

  it("maps message.created to a message", () => {
    expect(toRealtimeEvent(event("event_message_created"))).toEqual({
      kind: "message",
      message: {
        id: "m_8f2a",
        channelId: "c_general",
        authorId: "u_ada",
        authorName: "ada",
        authorAvatarUrl: null,
        text: "Hello!",
        sentAt: "2030-01-01T10:00:00+00:00",
        attachments: [],
        reactions: [],
        editCount: 0,
        editedAt: null,
      },
    });
  });

  it("maps message.updated, message.deleted and reaction.added", () => {
    expect(toRealtimeEvent(event("event_message_updated"))).toEqual({
      kind: "message_edited",
      channelId: "c_general",
      messageId: "m_8f2a",
      text: "Hello, world!",
      editCount: 1,
      editedAt: "2030-01-01T10:05:00+00:00",
    });
    expect(toRealtimeEvent(event("event_message_deleted"))).toEqual({ kind: "message_deleted", channelId: "c_general", messageId: "m_8f2a" });
    expect(toRealtimeEvent(event("event_reaction_added"))).toEqual({
      kind: "reactions",
      channelId: "c_general",
      messageId: "m_8f2a",
      reactions: [{ emoji: "👍", count: 1, userIds: ["u_ada"] }],
    });
  });

  it("maps presence and channel changes", () => {
    expect(toRealtimeEvent(event("event_presence_changed"))).toEqual({ kind: "presence", userId: "u_ada", status: "idle" });
    expect(toRealtimeEvent(event("event_channel_updated"))).toEqual({ kind: "channel", channelId: "c_general", change: "updated" });
  });

  it("recognises a deleted channel and revoked access", () => {
    const base = event("event_channel_updated");
    expect(toRealtimeEvent({ ...base, data: { channel_id: "c1", deleted: true } })).toMatchObject({ change: "deleted" });
    expect(toRealtimeEvent({ ...base, data: { channel_id: "c1", access: "revoked" } })).toMatchObject({ change: "revoked" });
  });

  it("recognises a new channel and granted access", () => {
    const base = event("event_channel_updated");
    expect(toRealtimeEvent({ ...base, name: "channel.created", data: { channel_id: "c1" } })).toEqual({ kind: "channel", channelId: "c1", change: "created" });
    expect(toRealtimeEvent({ ...base, data: { channel_id: "c1", access: "granted" } })).toMatchObject({ change: "granted" });
  });

  it("recognises a pin or an unpin, and a topic change as an ordinary update", () => {
    const base = event("event_channel_updated");
    expect(toRealtimeEvent({ ...base, data: { channel_id: "c1", pin: { message_id: "m1", pinned: true } } })).toEqual({ kind: "pins", channelId: "c1" });
    expect(toRealtimeEvent({ ...base, data: { channel_id: "c1", pin: { message_id: "m1", pinned: false } } })).toEqual({ kind: "pins", channelId: "c1" });
    expect(toRealtimeEvent({ ...base, data: { channel_id: "c1", topic: "Patch talk", category_id: "cat" } })).toEqual({ kind: "channel", channelId: "c1", change: "updated" });
  });

  it("maps unknown presence statuses to offline and ignores unknown events", () => {
    const presence = event("event_presence_changed");
    expect(toRealtimeEvent({ ...presence, data: { user_id: "u", status: "mystery" } })).toMatchObject({ status: "offline" });
    expect(toRealtimeEvent({ ...presence, name: "something.new" })).toBeNull();
  });

  it("drops a message.created without an id or timestamp rather than guessing", () => {
    expect(toRealtimeEvent({ ...event("event_message_created"), data: { content: "x" } })).toBeNull();
  });
});
