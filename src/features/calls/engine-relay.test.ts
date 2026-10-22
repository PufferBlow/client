import { describe, expect, it } from "vitest";
import { generateRelayKeyPair, openFrame, sealFrame, type FrameKeys } from "./crypto/frames";
import { loadIdentity, memoryKeyStore } from "./crypto/identity";
import { assess, memoryPinStore, type PinStore } from "./crypto/trust";
import { CallEngine, type RelaySetup } from "./engine";
import type { FrameEncryption } from "./frameEncryption";
import type { CallState } from "./types";

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 80));
const bytes = (...values: number[]) => new Uint8Array(values).buffer as ArrayBuffer;

class FakeStream {
  track = { enabled: true, stop: () => undefined };
  getAudioTracks() {
    return [this.track];
  }
  getTracks() {
    return [this.track];
  }
}

class FakePeer {
  remoteDescription = null;
  onicecandidate = null;
  ontrack = null;
  onconnectionstatechange = null;
  addTrack() {}
  close() {}
}

class FakeEncryption implements FrameEncryption {
  keys: FrameKeys | null = null;
  disposed = false;
  configuration = {};
  protectSender() {}
  protectReceiver() {}
  setKeys(keys: FrameKeys) {
    this.keys = keys;
  }
  dispose() {
    this.disposed = true;
  }
}

type Sent = { type: string; payload: Record<string, unknown> };

const base = (): CallState => ({ phase: "connecting", callId: "c1", peerId: null, peerName: "", direction: null, muted: false, error: null, encryption: { status: "pending" }, connectedAt: null, route: "direct" });

/** A relay whose media server never answers: enough to exercise the key exchange. */
const relayWith = (encryption: FrameEncryption | null, extra: Partial<RelaySetup> = {}): RelaySetup => ({
  grant: () => new Promise(() => undefined),
  leave: async () => undefined,
  voiceDeps: {} as RelaySetup["voiceDeps"],
  encryption: () => encryption,
  ...extra,
});

async function side(role: "caller" | "callee", userId: string, peerId: string, encryption: FrameEncryption | null, options: { pins?: PinStore; relay?: Partial<RelaySetup> } = {}) {
  const identity = await loadIdentity(memoryKeyStore(), userId);
  const sent: Sent[] = [];
  const state = { current: base() };
  const engine = new CallEngine({
    callId: "c1",
    role,
    self: { userId, username: userId },
    peer: { userId: peerId },
    iceServers: [],
    identity,
    pins: options.pins ?? memoryPinStore(),
    send: async (type, payload) => void sent.push({ type, payload }),
    onState: (patch) => void (state.current = { ...state.current, ...patch }),
    deps: { createPeer: () => new FakePeer() as unknown as RTCPeerConnection, getMicrophone: async () => new FakeStream() as unknown as MediaStream, createAudio: () => ({}) as HTMLAudioElement },
    relay: relayWith(encryption, { forceRelay: true, ...options.relay }),
  });
  return { engine, sent, state, identity };
}

/** A caller starts, then relays only once the callee has accepted (`beginOffer`). */
async function begin(s: { engine: CallEngine }) {
  await s.engine.start();
  await s.engine.beginOffer();
}

describe("relay through the media server", () => {
  it("exchanges signed keys and ends up with matching frame keys on both sides, which only they can use", async () => {
    const ae = new FakeEncryption();
    const be = new FakeEncryption();
    const a = await side("caller", "ada", "grace", ae);
    const b = await side("callee", "grace", "ada", be);
    await begin(a);
    await b.engine.start();
    expect(a.sent.map((s) => s.type)).toEqual(["relay"]);
    expect(a.state.current.route).toBe("relay");

    b.engine.handleSignal("relay", a.sent[0]!.payload);
    a.engine.handleSignal("relay", b.sent[0]!.payload);
    await flush();

    expect(ae.keys).not.toBeNull();
    expect(be.keys).not.toBeNull();
    const pa = a.state.current.encryption as Extract<CallState["encryption"], { status: "protected" }>;
    const pb = b.state.current.encryption as Extract<CallState["encryption"], { status: "protected" }>;
    expect(pa.status).toBe("protected");
    expect(pa.safetyNumber).toBe(pb.safetyNumber);

    // What ada seals, grace opens; whoever lacks the key (the server) cannot.
    const opened = await openFrame(be.keys!.receive, await sealFrame(ae.keys!.send, 0, bytes(7, 7, 7)));
    expect([...new Uint8Array(opened!.frame)]).toEqual([7, 7, 7]);
    expect(await openFrame(ae.keys!.receive, await sealFrame(ae.keys!.send, 1, bytes(7)))).toBeNull();
  });

  it("is not up until the media server is connected as well as the keys being in place", async () => {
    const a = await side("caller", "ada", "grace", new FakeEncryption());
    const b = await side("callee", "grace", "ada", new FakeEncryption());
    await begin(a);
    await b.engine.start();
    a.engine.handleSignal("relay", b.sent[0]!.payload);
    await flush();
    expect(a.state.current.encryption.status).toBe("protected");
    expect(a.state.current.phase).toBe("connecting"); // keys alone do not make a call
  });

  it("follows the other side onto the relay when it gives up on the direct path first", async () => {
    const a = await side("caller", "ada", "grace", new FakeEncryption());
    const encryption = new FakeEncryption();
    const graceSent: Sent[] = [];
    const grace = new CallEngine({
      callId: "c1",
      role: "callee",
      self: { userId: "grace", username: "grace" },
      peer: { userId: "ada" },
      iceServers: [],
      identity: await loadIdentity(memoryKeyStore(), "grace"),
      pins: memoryPinStore(),
      send: async (type, payload) => void graceSent.push({ type, payload }),
      onState: () => undefined,
      deps: { createPeer: () => new FakePeer() as unknown as RTCPeerConnection, getMicrophone: async () => new FakeStream() as unknown as MediaStream, createAudio: () => ({}) as HTMLAudioElement },
      relay: relayWith(encryption), // not forced: she starts on the direct path
    });
    await grace.start();
    expect(grace.route).toBe("direct");
    await begin(a);

    grace.handleSignal("relay", a.sent[0]!.payload);
    await flush();

    expect(grace.route).toBe("relay");
    expect(graceSent.map((s) => s.type)).toContain("relay"); // she answers with her own key
    expect(encryption.keys).not.toBeNull();
  });

  it("refuses a relay key that is unsigned, or whose key exchange was swapped by the server", async () => {
    const a = await side("caller", "ada", "grace", new FakeEncryption());
    await begin(a);
    const good = a.sent[0]!.payload;
    const fresh = async () => {
      const b = await side("callee", "grace", "ada", new FakeEncryption());
      await b.engine.start();
      return b;
    };

    const unsigned = await fresh();
    unsigned.engine.handleSignal("relay", { relay_key: good.relay_key });
    await flush();
    expect(unsigned.state.current.phase).toBe("failed");
    expect(unsigned.state.current.error).toMatch(/without signing/);

    const swapped = await fresh(); // the server puts its own ECDH key in but keeps ada's signature
    const evil = await generateRelayKeyPair();
    swapped.engine.handleSignal("relay", { ...good, relay_key: { v: 1, public_key: evil.publicKey } });
    await flush();
    expect(swapped.state.current.phase).toBe("failed");
    expect(swapped.state.current.error).toMatch(/security check failed/i);
  });

  it("holds a relay key signed by an unpinned identity key until the user decides", async () => {
    const original = await loadIdentity(memoryKeyStore(), "ada-laptop");
    const pins = memoryPinStore();
    await assess(pins, "ada", original.keyId, original.publicKey);
    const a = await side("caller", "ada", "grace", new FakeEncryption());
    const encryption = new FakeEncryption();
    const b = await side("callee", "grace", "ada", encryption, { pins });
    await begin(a);
    await b.engine.start();

    b.engine.handleSignal("relay", a.sent[0]!.payload);
    await flush();
    expect(b.state.current.encryption.status).toBe("key_changed");
    expect(encryption.keys).toBeNull();

    b.engine.resolveKeyChange(true);
    await flush();
    expect(encryption.keys).not.toBeNull();
  });

  it("does not relay at all when the browser cannot encrypt frames", async () => {
    const a = await side("caller", "ada", "grace", null);
    await a.engine.start();
    await expect(a.engine.beginOffer()).rejects.toThrow(/cannot encrypt a relayed call/);
    expect(a.sent).toHaveLength(0); // nothing was offered, nothing leaves unprotected
    expect(a.state.current.phase).toBe("failed");
  });

  it("reports a media server that cannot be reached, and releases the encryption", async () => {
    const encryption = new FakeEncryption();
    const a = await side("caller", "ada", "grace", encryption, { relay: { grant: async () => Promise.reject(new Error("no media server")) } });
    await begin(a);
    await flush();
    expect(a.state.current.phase).toBe("failed");
    expect(a.state.current.error).toBe("no media server");
    expect(encryption.disposed).toBe(true);
  });
});
