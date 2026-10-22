import { describe, expect, it } from "vitest";
import { createFrameCipher, deriveFrameKeys, generateRelayKeyPair, openFrame, relayStatement, ReplayWindow, sealFrame } from "./frames";

const bytes = (...values: number[]) => new Uint8Array(values).buffer as ArrayBuffer;
const same = (a: ArrayBuffer, b: ArrayBuffer) => expect([...new Uint8Array(a)]).toEqual([...new Uint8Array(b)]);

async function pair() {
  const ada = await generateRelayKeyPair();
  const grace = await generateRelayKeyPair();
  const forAda = await deriveFrameKeys({ privateKey: ada.privateKey, peerPublicKey: grace.publicKey, callId: "call-1", selfId: "ada", peerId: "grace" });
  const forGrace = await deriveFrameKeys({ privateKey: grace.privateKey, peerPublicKey: ada.publicKey, callId: "call-1", selfId: "grace", peerId: "ada" });
  return { ada, grace, forAda, forGrace };
}

describe("relay keys", () => {
  it("gives both sides matching keys: what one seals the other opens, in each direction", async () => {
    const { forAda, forGrace } = await pair();

    const toGrace = await sealFrame(forAda.send, 0, bytes(1, 2, 3));
    const opened = await openFrame(forGrace.receive, toGrace);
    same(opened!.frame, bytes(1, 2, 3));

    const toAda = await sealFrame(forGrace.send, 0, bytes(9, 9));
    same((await openFrame(forAda.receive, toAda))!.frame, bytes(9, 9));
  });

  it("uses a different key for each direction, so a frame cannot be reflected back at its sender", async () => {
    const { forAda } = await pair();
    const sealed = await sealFrame(forAda.send, 0, bytes(1));
    expect(await openFrame(forAda.receive, sealed)).toBeNull();
  });

  it("does not open for someone who does not hold the keys (the server, a third party)", async () => {
    const { forAda } = await pair();
    const server = await generateRelayKeyPair();
    const other = await generateRelayKeyPair();
    const guessed = await deriveFrameKeys({ privateKey: server.privateKey, peerPublicKey: other.publicKey, callId: "call-1", selfId: "grace", peerId: "ada" });
    const sealed = await sealFrame(forAda.send, 0, bytes(1, 2, 3));
    expect(await openFrame(guessed.receive, sealed)).toBeNull();
  });

  it("does not carry over to another call", async () => {
    const ada = await generateRelayKeyPair();
    const grace = await generateRelayKeyPair();
    const a = await deriveFrameKeys({ privateKey: ada.privateKey, peerPublicKey: grace.publicKey, callId: "call-1", selfId: "ada", peerId: "grace" });
    const b = await deriveFrameKeys({ privateKey: grace.privateKey, peerPublicKey: ada.publicKey, callId: "call-2", selfId: "grace", peerId: "ada" });
    expect(await openFrame(b.receive, await sealFrame(a.send, 0, bytes(1)))).toBeNull();
  });
});

describe("sealed frames", () => {
  it("hide the audio: the plaintext does not appear in what is sent, and it grows by the counter and tag", async () => {
    const { forAda } = await pair();
    const plain = new Uint8Array(40).fill(0xab);
    const sealed = new Uint8Array(await sealFrame(forAda.send, 7, plain.buffer as ArrayBuffer));

    expect(sealed.length).toBe(4 + 40 + 16);
    expect(new DataView(sealed.buffer).getUint32(0)).toBe(7);
    expect(sealed.slice(4, 8)).not.toEqual(plain.slice(0, 4));
  });

  it("are refused when altered anywhere, including the counter", async () => {
    const { forAda, forGrace } = await pair();
    const sealed = new Uint8Array(await sealFrame(forAda.send, 5, bytes(1, 2, 3, 4)));
    for (const index of [0, 3, 4, sealed.length - 1]) {
      const altered = sealed.slice();
      altered[index]! ^= 0x01;
      expect(await openFrame(forGrace.receive, altered.buffer as ArrayBuffer)).toBeNull();
    }
  });

  it("are refused when truncated or empty", async () => {
    const { forGrace } = await pair();
    expect(await openFrame(forGrace.receive, bytes())).toBeNull();
    expect(await openFrame(forGrace.receive, bytes(1, 2, 3))).toBeNull();
  });

  it("will not seal once the counter would repeat", async () => {
    const { forAda } = await pair();
    await expect(sealFrame(forAda.send, 0x1_0000_0000, bytes(1))).rejects.toThrow(/counter/);
    await expect(sealFrame(forAda.send, -1, bytes(1))).rejects.toThrow(/counter/);
  });
});

describe("replay window", () => {
  it("accepts each counter once, tolerates reordering, and rejects stale frames", () => {
    const window = new ReplayWindow();
    expect(window.accept(10)).toBe(true);
    expect(window.accept(10)).toBe(false); // a repeat
    expect(window.accept(8)).toBe(true); // late but inside the window
    expect(window.accept(8)).toBe(false);
    expect(window.accept(200)).toBe(true);
    expect(window.accept(10)).toBe(false); // now far behind
  });
});

describe("frame cipher", () => {
  const run = async (stream: TransformStream<{ data: ArrayBuffer }, { data: ArrayBuffer }>, frames: ArrayBuffer[]) => {
    const writer = stream.writable.getWriter();
    const reader = stream.readable.getReader();
    const out: ArrayBuffer[] = [];
    const reading = (async () => {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        out.push(value.data);
      }
    })();
    for (const data of frames) await writer.write({ data });
    await writer.close();
    await reading;
    return out;
  };

  it("drops outgoing audio until it has keys: nothing leaves unsealed", async () => {
    const cipher = createFrameCipher();
    expect(await run(cipher.seal(), [bytes(1, 2, 3)])).toHaveLength(0);
  });

  it("seals and opens a stream of frames, numbering them", async () => {
    const { forAda, forGrace } = await pair();
    const sender = createFrameCipher();
    const receiver = createFrameCipher();
    sender.setKeys(forAda);
    receiver.setKeys(forGrace);

    const sealed = await run(sender.seal(), [bytes(1), bytes(2), bytes(3)]);
    expect(sealed).toHaveLength(3);
    expect(sealed.map((s) => new DataView(s).getUint32(0))).toEqual([0, 1, 2]);

    const opened = await run(receiver.open(), sealed);
    expect(opened.map((o) => [...new Uint8Array(o)])).toEqual([[1], [2], [3]]);
  });

  it("drops frames that are replayed, forged or sealed under another key", async () => {
    const { forAda, forGrace } = await pair();
    const stranger = await pair();
    const sender = createFrameCipher();
    const receiver = createFrameCipher();
    sender.setKeys(forAda);
    receiver.setKeys(forGrace);
    const [first, second] = await run(sender.seal(), [bytes(1), bytes(2)]);
    const forged = await sealFrame(stranger.forAda.send, 9, bytes(66));

    const opened = await run(receiver.open(), [first!, first!, forged, second!]);

    expect(opened.map((o) => [...new Uint8Array(o)])).toEqual([[1], [2]]);
  });
});

describe("relay key statement", () => {
  it("names the call, the direction and the key, so a signature cannot be reused for anything else", async () => {
    const { ada } = await pair();
    const base = { callId: "c1", from: "ada", to: "grace", publicKey: ada.publicKey };
    const text = (s: Uint8Array) => new TextDecoder().decode(s);
    expect(text(relayStatement(base))).toBe(`pufferblow-call-relay-v1\nc1\nada\ngrace\n${ada.publicKey.x}\n${ada.publicKey.y}`);
    for (const change of [{ callId: "c2" }, { from: "grace", to: "ada" }]) {
      expect(text(relayStatement({ ...base, ...change }))).not.toBe(text(relayStatement(base)));
    }
  });
});
