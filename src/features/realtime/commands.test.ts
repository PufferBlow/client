import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CommandClient, CommandError, type CommandTransport } from "./commands";
import type { AckFrame, ErrorFrame } from "./protocol";

class FakeTransport implements CommandTransport {
  open = true;
  sent: Record<string, unknown>[] = [];
  send(text: string) {
    if (!this.open) return false;
    this.sent.push(JSON.parse(text));
    return true;
  }
}

const ack = (id: string, result: Record<string, unknown> = {}, duplicate = false): AckFrame => ({ type: "ack", id, result, duplicate });
const error = (id: string | null, code: string, retryable = false, retryAfter: number | null = null): ErrorFrame => ({
  type: "error",
  id,
  code,
  message: `${code} happened`,
  retryable,
  retryAfter,
});

describe("CommandClient", () => {
  let transport: FakeTransport;
  let client: CommandClient;

  beforeEach(() => {
    vi.useFakeTimers();
    transport = new FakeTransport();
    client = new CommandClient(transport, 1000);
  });
  afterEach(() => vi.useRealTimers());

  it("sends a v1 command frame with a unique id", () => {
    void client.send("message.create", { channel_id: "c", content: "hi", nonce: "n" });
    void client.send("message.delete", { channel_id: "c", message_id: "m" });
    expect(transport.sent[0]).toEqual({ type: "command", version: 1, id: "cmd_1", name: "message.create", data: { channel_id: "c", content: "hi", nonce: "n" } });
    expect(transport.sent[1]).toMatchObject({ id: "cmd_2", name: "message.delete" });
  });

  it("resolves with the ack result, matched by id even when answers arrive out of order", async () => {
    const first = client.send("a", {});
    const second = client.send("b", {});
    client.handleFrame(ack("cmd_2", { which: "second" }));
    client.handleFrame(ack("cmd_1", { which: "first" }));
    await expect(first).resolves.toEqual({ which: "first" });
    await expect(second).resolves.toEqual({ which: "second" });
    expect(client.inFlight).toBe(0);
  });

  it("exposes the duplicate flag through request()", async () => {
    const pending = client.request("message.create", {});
    client.handleFrame(ack("cmd_1", { message: {} }, true));
    await expect(pending).resolves.toMatchObject({ duplicate: true });
  });

  it("rejects with the server's error code, message and retry hints", async () => {
    const pending = client.send("message.create", {});
    client.handleFrame(error("cmd_1", "RATE_LIMITED", true, 0.4));
    await expect(pending).rejects.toMatchObject({ name: "CommandError", code: "RATE_LIMITED", retryable: true, retryAfter: 0.4, message: "RATE_LIMITED happened" });
  });

  it("rejects at once when the socket is not open and never queues the command", async () => {
    transport.open = false;
    await expect(client.send("message.create", {})).rejects.toMatchObject({ code: "NOT_CONNECTED", retryable: true });
    expect(client.inFlight).toBe(0);
    transport.open = true;
    expect(transport.sent).toHaveLength(0);
  });

  it("times out when the server never answers", async () => {
    const pending = client.send("message.create", {});
    const assertion = expect(pending).rejects.toMatchObject({ code: "TIMEOUT", retryable: true });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(client.inFlight).toBe(0);
  });

  it("honours a per-command timeout", async () => {
    const pending = client.send("events.resync", {}, { timeoutMs: 50 });
    const assertion = expect(pending).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
  });

  it("rejects everything in flight when the connection drops", async () => {
    const a = client.send("a", {});
    const b = client.send("b", {});
    const assertions = [expect(a).rejects.toMatchObject({ code: "DISCONNECTED", retryable: true }), expect(b).rejects.toBeInstanceOf(CommandError)];
    client.rejectAll();
    await Promise.all(assertions);
    expect(client.inFlight).toBe(0);
  });

  it("ignores a late answer for a command that already timed out", async () => {
    const pending = client.send("a", {});
    const assertion = expect(pending).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    expect(client.handleFrame(ack("cmd_1"))).toBe(false);
  });

  it("does not claim frames that are not answers to its commands", () => {
    expect(client.handleFrame(ack("cmd_99"))).toBe(false);
    expect(client.handleFrame(error(null, "MALFORMED"))).toBe(false);
    expect(client.handleFrame({ type: "pong" })).toBe(false);
  });
});
