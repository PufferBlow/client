import { describe, expect, it } from "vitest";
import { normalizeMessage } from "../messages/normalize";
import type { Attachment } from "../messages/types";
import { callLogOf, describeCall, formatCallLength, type CallLog } from "./log";

const entry = (over: Record<string, unknown> = {}): Attachment =>
  ({
    url: "call:c1",
    type: "call",
    filename: "",
    call: { call_id: "c1", caller_id: "ada", callee_id: "grace", caller_name: "ada", callee_name: "grace", outcome: "completed", duration_seconds: 4350, ...over },
  }) as unknown as Attachment;

describe("callLogOf", () => {
  it("reads a call out of a message's attachments", () => {
    expect(callLogOf([entry()])).toEqual({ callId: "c1", callerId: "ada", calleeId: "grace", callerName: "ada", calleeName: "grace", outcome: "completed", durationSeconds: 4350 });
  });

  it("is null for ordinary attachments, a malformed call, or an outcome it does not know", () => {
    expect(callLogOf(undefined)).toBeNull();
    expect(callLogOf([{ url: "/a.png", filename: "a.png", type: "image/png" }])).toBeNull();
    expect(callLogOf([{ url: "call:x", filename: "", type: "call" }])).toBeNull();
    expect(callLogOf([entry({ outcome: "exploded" })])).toBeNull();
  });

  it("never shows a negative or odd length", () => {
    expect(callLogOf([entry({ duration_seconds: -5 })])?.durationSeconds).toBe(0);
    expect(callLogOf([entry({ duration_seconds: "long" })])?.durationSeconds).toBe(0);
  });
});

describe("formatCallLength", () => {
  it("says hours and minutes, minutes and seconds, or seconds", () => {
    expect(formatCallLength(4350)).toBe("1 hr 12 min");
    expect(formatCallLength(3600)).toBe("1 hr");
    expect(formatCallLength(7322)).toBe("2 hr 2 min");
    expect(formatCallLength(200)).toBe("3 min 20 sec");
    expect(formatCallLength(180)).toBe("3 min");
    expect(formatCallLength(45)).toBe("45 sec");
    expect(formatCallLength(0)).toBe("0 sec");
  });
});

const log = (outcome: CallLog["outcome"], durationSeconds = 0): CallLog => ({ callId: "c1", callerId: "ada", calleeId: "grace", callerName: "ada", calleeName: "grace", outcome, durationSeconds });

describe("describeCall", () => {
  it("words a call that was picked up the same way for both, with how long it lasted", () => {
    expect(describeCall(log("completed", 4350), "ada")).toMatchObject({ title: "You called grace", detail: "Lasted 1 hr 12 min", tone: "ok", icon: "outgoing" });
    expect(describeCall(log("completed", 4350), "grace")).toMatchObject({ title: "ada called you", detail: "Lasted 1 hr 12 min", icon: "incoming" });
  });

  it("tells the caller no one answered, and the callee they missed it", () => {
    expect(describeCall(log("missed"), "ada")).toMatchObject({ title: "You called grace", detail: "No answer", tone: "quiet" });
    expect(describeCall(log("missed"), "grace")).toMatchObject({ title: "Missed call from ada", tone: "missed", icon: "missed" });
  });

  it("words a hang-up before the answer, and a decline, for each side", () => {
    expect(describeCall(log("cancelled"), "ada").detail).toBe("You hung up before they answered");
    expect(describeCall(log("cancelled"), "grace")).toMatchObject({ title: "Missed call from ada", tone: "missed" });
    expect(describeCall(log("declined"), "ada")).toMatchObject({ detail: "grace declined", icon: "declined" });
    expect(describeCall(log("declined"), "grace").title).toBe("You declined a call from ada");
  });
});

describe("a call line as a message", () => {
  it("is a notice, so it never joins a group of someone's messages", () => {
    const message = normalizeMessage({ message_id: "m1", conversation_id: "dm", sender_user_id: "ada", username: "ada", message: "", sent_at: "2030-01-01T00:00:00Z", attachments: [entry()] } as never, "dm");
    expect(message.kind).toBe("system");
    const plain = normalizeMessage({ message_id: "m2", conversation_id: "dm", sender_user_id: "ada", username: "ada", message: "hi", sent_at: "2030-01-01T00:00:00Z" } as never, "dm");
    expect(plain.kind).toBeUndefined();
  });
});
