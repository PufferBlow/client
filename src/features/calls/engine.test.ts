import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadIdentity, memoryKeyStore, type Identity } from "./crypto/identity";
import { assess, memoryPinStore, type PinStore } from "./crypto/trust";
import { CallEngine, type CallDeps } from "./engine";
import type { CallState } from "./types";

/** WebCrypto finishes on another thread, so waiting for microtasks is not enough: give it a moment. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 60));

class FakeTrack {
  enabled = true;
  stopped = false;
  kind = "audio";
  stop() {
    this.stopped = true;
  }
}

class FakeStream {
  readonly track = new FakeTrack();
  getAudioTracks() {
    return [this.track];
  }
  getTracks() {
    return [this.track];
  }
}

let fingerprintCounter = 0;

class FakePeer {
  static all: FakePeer[] = [];
  fingerprint = `${(++fingerprintCounter).toString(16).padStart(2, "0").toUpperCase()}:AA:BB`;
  localDescription: RTCSessionDescriptionInit | null = null;
  remoteDescription: RTCSessionDescriptionInit | null = null;
  candidates: RTCIceCandidateInit[] = [];
  closed = false;
  connectionState: RTCPeerConnectionState = "new";
  onicecandidate: ((e: RTCPeerConnectionIceEvent) => void) | null = null;
  ontrack: unknown = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor() {
    FakePeer.all.push(this);
  }
  addTrack() {}
  async createOffer() {
    return { type: "offer" as const, sdp: `v=0\r\na=fingerprint:sha-256 ${this.fingerprint}\r\n` };
  }
  async createAnswer() {
    return { type: "answer" as const, sdp: `v=0\r\na=fingerprint:sha-256 ${this.fingerprint}\r\n` };
  }
  async setLocalDescription(d: RTCSessionDescriptionInit) {
    this.localDescription = d;
  }
  async setRemoteDescription(d: RTCSessionDescriptionInit) {
    this.remoteDescription = d;
  }
  async addIceCandidate(c: RTCIceCandidateInit) {
    this.candidates.push(c);
  }
  gather(candidate: string) {
    this.onicecandidate?.({ candidate: { toJSON: () => ({ candidate }) } } as unknown as RTCPeerConnectionIceEvent);
  }
  connect() {
    this.connectionState = "connected";
    this.onconnectionstatechange?.();
  }
  fail() {
    this.connectionState = "failed";
    this.onconnectionstatechange?.();
  }
  close() {
    this.closed = true;
  }
}

type Signal = { type: "offer" | "answer" | "candidate" | "relay"; payload: Record<string, unknown> };

interface Side {
  engine: CallEngine;
  state: CallState;
  sent: Signal[];
  stream: FakeStream;
  peer: () => FakePeer;
  pins: PinStore;
  identity: Identity;
}

const baseState = (): CallState => ({ phase: "connecting", callId: "c1", peerId: null, peerName: "", direction: null, muted: false, error: null, encryption: { status: "pending" }, connectedAt: null, route: "direct" });

async function makeSide(role: "caller" | "callee", userId: string, peerId: string, options: { identity?: Identity; pins?: PinStore } = {}): Promise<Side> {
  const identity = options.identity ?? (await loadIdentity(memoryKeyStore(), userId));
  const pins = options.pins ?? memoryPinStore();
  const stream = new FakeStream();
  const sent: Signal[] = [];
  const side = { state: baseState(), sent, stream } as Side;
  let fake: FakePeer | null = null;
  const deps: CallDeps = {
    createPeer: () => (fake = new FakePeer()) as unknown as RTCPeerConnection,
    getMicrophone: async () => stream as unknown as MediaStream,
    createAudio: () => ({ play: async () => undefined, pause: () => undefined, srcObject: null }) as unknown as HTMLAudioElement,
  };
  side.engine = new CallEngine({
    callId: "c1",
    role,
    self: { userId, username: userId },
    peer: { userId: peerId },
    iceServers: [],
    identity,
    pins,
    send: async (type, payload) => void sent.push({ type, payload }),
    onState: (patch) => void (side.state = { ...side.state, ...patch }),
    deps,
  });
  side.peer = () => fake!;
  side.pins = pins;
  side.identity = identity;
  return side;
}

/** Deliver what one side sent to the other, optionally changing it on the way (a hostile instance). */
function relay(from: Side, to: Side, tamper?: (s: Signal) => Signal) {
  const queued = from.sent.splice(0);
  for (const s of queued) {
    const out = tamper ? tamper(s) : s;
    to.engine.handleSignal(out.type, out.payload);
  }
}

let caller: Side;
let callee: Side;

beforeEach(async () => {
  FakePeer.all = [];
  caller = await makeSide("caller", "ada", "grace");
  callee = await makeSide("callee", "grace", "ada");
});

async function startBoth() {
  await caller.engine.start();
  await callee.engine.start();
  await caller.engine.beginOffer();
}

describe("CallEngine negotiation", () => {
  it("negotiates a signed call: each side proves its fingerprints and both end up protected with the same safety number", async () => {
    await startBoth();
    relay(caller, callee);
    await flush();
    relay(callee, caller);
    await flush();

    for (const side of [caller, callee]) expect(side.state.encryption.status).toBe("protected");
    const a = caller.state.encryption as Extract<CallState["encryption"], { status: "protected" }>;
    const b = callee.state.encryption as Extract<CallState["encryption"], { status: "protected" }>;
    expect(a.safetyNumber).toBe(b.safetyNumber);
    expect(a.trust).toBe("new");
    expect(caller.peer().remoteDescription?.type).toBe("answer");
    expect(callee.peer().remoteDescription?.type).toBe("offer");
  });

  it("says the call is connected when the audio connection is", async () => {
    await startBoth();
    relay(caller, callee);
    await flush();
    callee.peer().connect();
    expect(callee.state.phase).toBe("connected");
    expect(callee.state.connectedAt).not.toBeNull();
  });

  it("refuses a call whose SDP was changed on the way (a swapped fingerprint)", async () => {
    await startBoth();
    relay(caller, callee, (s) => {
      if (s.type !== "offer") return s;
      const sdp = s.payload.sdp as { type: string; sdp: string };
      return { ...s, payload: { ...s.payload, sdp: { ...sdp, sdp: sdp.sdp.replace(/fingerprint:sha-256 \S+/, "fingerprint:sha-256 DE:AD:BE:EF") } } };
    });
    await flush();

    expect(callee.state.phase).toBe("failed");
    expect(callee.state.error).toMatch(/security check failed/i);
    expect(callee.peer().remoteDescription).toBeNull(); // the forged SDP was never used
    expect(callee.sent.filter((s) => s.type === "answer")).toHaveLength(0);
  });

  it("refuses an offer that was not signed at all", async () => {
    await startBoth();
    relay(caller, callee, (s) => (s.type === "offer" ? { ...s, payload: { sdp: s.payload.sdp } } : s));
    await flush();
    expect(callee.state.phase).toBe("failed");
    expect(callee.state.error).toMatch(/did not sign/i);
  });

  it("refuses a signature from a key that is not the one claimed", async () => {
    const mallory = await loadIdentity(memoryKeyStore(), "mallory");
    await startBoth();
    relay(caller, callee, (s) => {
      if (s.type !== "offer") return s;
      const e2ee = s.payload.e2ee as Record<string, unknown>;
      return { ...s, payload: { ...s.payload, e2ee: { ...e2ee, public_key: mallory.publicKey } } }; // key id no longer matches the key
    });
    await flush();
    expect(callee.state.phase).toBe("failed");
    expect(callee.state.error).toMatch(/does not match its id/i);
  });

  it("will not accept a signature made over a different call's context", async () => {
    // The relay replays an offer that grace's engine would accept for a different caller.
    const other = await makeSide("callee", "grace", "linus");
    await other.engine.start();
    await caller.engine.start();
    await caller.engine.beginOffer();
    relay(caller, other);
    await flush();
    expect(other.state.phase).toBe("failed");
  });

  it("holds the call for a key it has not seen, and goes ahead only when told to", async () => {
    const original = await loadIdentity(memoryKeyStore(), "ada-laptop");
    const pins = memoryPinStore();
    await assess(pins, "ada", original.keyId, original.publicKey); // grace already knows ada's laptop
    callee = await makeSide("callee", "grace", "ada", { pins });
    await startBoth();

    relay(caller, callee); // ada is calling from a different key
    await flush();
    expect(callee.state.encryption.status).toBe("key_changed");
    expect(callee.peer().remoteDescription).toBeNull();
    expect(callee.sent.filter((s) => s.type === "answer")).toHaveLength(0);

    callee.engine.resolveKeyChange(true);
    await flush();
    expect(callee.state.encryption.status).toBe("protected");
    expect(callee.sent.some((s) => s.type === "answer")).toBe(true);
    expect(pins.read().ada).toHaveLength(2);
  });

  it("ends the call when the user declines a changed key", async () => {
    const original = await loadIdentity(memoryKeyStore(), "ada-laptop");
    const pins = memoryPinStore();
    await assess(pins, "ada", original.keyId, original.publicKey);
    callee = await makeSide("callee", "grace", "ada", { pins });
    await startBoth();
    relay(caller, callee);
    await flush();

    callee.engine.resolveKeyChange(false);
    expect(callee.state.phase).toBe("failed");
    expect(callee.peer().closed).toBe(true);
    expect(callee.stream.track.stopped).toBe(true);
  });

  it("ignores a second offer once one was taken", async () => {
    await startBoth();
    const [offer] = caller.sent;
    relay(caller, callee);
    callee.engine.handleSignal("offer", offer!.payload);
    await flush();
    expect(callee.sent.filter((s) => s.type === "answer")).toHaveLength(1);
  });

  it("only takes an offer if it is the callee, and an answer if it is the caller", async () => {
    await startBoth();
    const offer = caller.sent.find((s) => s.type === "offer")!;
    caller.engine.handleSignal("offer", offer.payload); // a caller is never offered to
    await flush();
    expect(caller.state.encryption.status).toBe("pending");
    expect(caller.peer().remoteDescription).toBeNull();
  });
});

describe("ICE candidates", () => {
  it("sends none before the offer, then sends the ones gathered meanwhile", async () => {
    await caller.engine.start();
    caller.peer().gather("early");
    expect(caller.sent).toHaveLength(0);
    await caller.engine.beginOffer();
    expect(caller.sent.map((s) => s.type)).toEqual(["offer", "candidate"]);
    caller.peer().gather("late");
    await flush();
    expect(caller.sent.at(-1)).toEqual({ type: "candidate", payload: { candidate: { candidate: "late" } } });
  });

  it("holds the other side's candidates until its SDP is in, then applies them", async () => {
    await startBoth();
    callee.engine.handleSignal("candidate", { candidate: { candidate: "c1" } });
    await flush();
    expect(callee.peer().candidates).toHaveLength(0);
    relay(caller, callee);
    await flush();
    expect(callee.peer().candidates[0]).toEqual({ candidate: "c1" });
  });

  it("takes signals that arrive while the microphone prompt is still open", async () => {
    let allow!: (stream: MediaStream) => void;
    const slow: CallDeps = {
      createPeer: () => new FakePeer() as unknown as RTCPeerConnection,
      getMicrophone: () => new Promise<MediaStream>((resolve) => (allow = resolve)),
      createAudio: () => ({}) as HTMLAudioElement,
    };
    const states: Partial<CallState>[] = [];
    const sent: Signal[] = [];
    const engine = new CallEngine({
      callId: "c1",
      role: "callee",
      self: { userId: "grace", username: "grace" },
      peer: { userId: "ada" },
      iceServers: [],
      identity: callee.identity,
      pins: memoryPinStore(),
      send: async (type, payload) => void sent.push({ type, payload }),
      onState: (p) => void states.push(p),
      deps: slow,
    });
    const starting = engine.start();
    await caller.engine.start();
    await caller.engine.beginOffer();
    for (const s of caller.sent) engine.handleSignal(s.type, s.payload); // the offer arrives before the mic is ready
    await flush();
    expect(sent).toHaveLength(0);

    allow(new FakeStream() as unknown as MediaStream);
    await starting;
    await flush();
    expect(sent.some((s) => s.type === "answer")).toBe(true);
  });
});

describe("controls and teardown", () => {
  it("mutes by disabling the microphone track", async () => {
    await caller.engine.start();
    caller.engine.setMuted(true);
    expect(caller.stream.track.enabled).toBe(false);
    expect(caller.state.muted).toBe(true);
    caller.engine.setMuted(false);
    expect(caller.stream.track.enabled).toBe(true);
  });

  it("releases the microphone and the connection on close, once", async () => {
    await caller.engine.start();
    caller.engine.close();
    caller.engine.close();
    expect(caller.peer().closed).toBe(true);
    expect(caller.stream.track.stopped).toBe(true);
  });

  it("fails with a reason when the microphone is blocked", async () => {
    const denied: CallDeps = {
      createPeer: () => new FakePeer() as unknown as RTCPeerConnection,
      getMicrophone: async () => {
        throw new DOMException("no", "NotAllowedError");
      },
      createAudio: () => ({}) as HTMLAudioElement,
    };
    const patches: Partial<CallState>[] = [];
    const engine = new CallEngine({ callId: "c", role: "caller", self: { userId: "a", username: "a" }, peer: { userId: "b" }, iceServers: [], identity: caller.identity, pins: memoryPinStore(), send: async () => undefined, onState: (p) => void patches.push(p), deps: denied });
    await expect(engine.start()).rejects.toThrow(/Microphone access was blocked/);
    expect(patches.at(-1)).toMatchObject({ phase: "failed" });
  });

  it("fails the call when the audio connection fails, and when it never connects", async () => {
    await startBoth();
    caller.peer().fail();
    await flush();
    expect(caller.state.phase).toBe("failed");
    expect(caller.state.error).toMatch(/cannot encrypt a relayed call/i); // no relay here, so no downgrade

    vi.useFakeTimers();
    try {
      const slow = await makeSide("caller", "ada", "grace");
      await slow.engine.start();
      await slow.engine.beginOffer();
      await vi.advanceTimersByTimeAsync(20_001);
      expect(slow.state.phase).toBe("failed");
      expect(slow.state.error).toMatch(/cannot encrypt a relayed call/i);
    } finally {
      vi.useRealTimers();
    }
  });
});
