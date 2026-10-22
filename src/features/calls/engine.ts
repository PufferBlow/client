import { signBinding, verifyBinding, type BindingContext, type BindingRole } from "./crypto/binding";
import { fromBase64Url, type Identity, type PublicJwk } from "./crypto/identity";
import { safetyNumber } from "./crypto/safety";
import { acceptKey, assess, type PinStore, type TrustDecision } from "./crypto/trust";
import type { CallState, IceServer } from "./types";

/** What the browser provides, so a call can be driven by fakes in tests. */
export interface CallDeps {
  createPeer(config: RTCConfiguration): RTCPeerConnection;
  getMicrophone(): Promise<MediaStream>;
  /** An element the other person's audio plays through. */
  createAudio(): HTMLAudioElement;
}

export interface CallSetup {
  callId: string;
  role: "caller" | "callee";
  self: { userId: string };
  peer: { userId: string };
  iceServers: IceServer[];
  identity: Identity;
  pins: PinStore;
  /** Pass one signal to the other person through the instance. */
  send(type: "offer" | "answer" | "candidate", payload: Record<string, unknown>): Promise<unknown>;
  /** The call changed; `patch` is the part of the state that did. */
  onState(patch: Partial<CallState>): void;
  deps: CallDeps;
}

/** How long to wait for the audio to connect before giving up. */
const CONNECT_TIMEOUT_MS = 20_000;

interface E2eePayload {
  v: 1;
  key_id: string;
  signature: string;
  public_key: PublicJwk;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

function readE2ee(payload: Record<string, unknown>): E2eePayload | null {
  const e = payload.e2ee;
  if (!isRecord(e) || typeof e.key_id !== "string" || typeof e.signature !== "string" || !isRecord(e.public_key)) return null;
  const k = e.public_key;
  if (k.kty !== "EC" || k.crv !== "P-256" || typeof k.x !== "string" || typeof k.y !== "string") return null;
  try {
    fromBase64Url(k.x);
    fromBase64Url(k.y);
  } catch {
    return null;
  }
  return { v: 1, key_id: e.key_id, signature: e.signature, public_key: { kty: "EC", crv: "P-256", x: k.x, y: k.y } };
}

/**
 * One call, from our side. The caller offers once the callee accepts; the callee answers. Each side
 * signs its SDP with its identity key and checks the other's before using it (see `crypto/binding`),
 * so what the instance relays cannot be changed without both noticing. Nothing is played or sent
 * until the other side's signed SDP has checked out and, when their key is new to us, been accepted.
 */
export class CallEngine {
  private peer: RTCPeerConnection | null = null;
  private microphone: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;
  private muted = false;
  private closed = false;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  /** Our candidates wait here until our SDP has been sent; null once it has. */
  private outgoingCandidates: RTCIceCandidateInit[] | null = [];
  /** Signals wait here until the connection exists (the microphone prompt can take a while). */
  private queue: Promise<void>;
  private release: () => void = () => undefined;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  /** A signed SDP from a key we had not pinned, waiting for the user. */
  private held: { type: "offer" | "answer"; payload: Record<string, unknown>; decision: TrustDecision } | null = null;
  /** Set when the other side signed correctly; the SDP is then used. */
  private remoteVerified = false;

  constructor(private readonly setup: CallSetup) {
    this.queue = new Promise<void>((resolve) => (this.release = resolve));
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Open the microphone and the connection. The caller then offers (`beginOffer`); the callee waits for an offer. */
  async start(): Promise<void> {
    const { deps, iceServers } = this.setup;
    try {
      this.microphone = await deps.getMicrophone();
    } catch (error) {
      throw this.fail(microphoneMessage(error));
    }
    if (this.closed) {
      this.stopMicrophone();
      return;
    }
    this.microphone.getAudioTracks().forEach((track) => (track.enabled = !this.muted));

    const peer = deps.createPeer({ iceServers: iceServers.map(({ urls, username, credential }) => ({ urls, ...(username && { username }), ...(credential && { credential }) })) });
    this.peer = peer;
    for (const track of this.microphone.getAudioTracks()) peer.addTrack(track, this.microphone);

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      const init = event.candidate.toJSON();
      if (this.outgoingCandidates) this.outgoingCandidates.push(init);
      else void this.setup.send("candidate", { candidate: init }).catch(() => undefined);
    };
    peer.ontrack = (event) => {
      if (event.track.kind !== "audio") return;
      const audio = this.audio ?? this.setup.deps.createAudio();
      this.audio = audio;
      audio.srcObject = event.streams[0] ?? new MediaStream([event.track]);
      audio.autoplay = true;
      void audio.play?.().catch(() => undefined);
    };
    peer.onconnectionstatechange = () => {
      if (this.closed) return;
      if (peer.connectionState === "connected") {
        if (this.connectTimer) clearTimeout(this.connectTimer);
        this.connectTimer = null;
        this.setup.onState({ phase: "connected", connectedAt: Date.now(), error: null });
      } else if (peer.connectionState === "failed") {
        this.fail("The audio connection failed.");
      }
    };
    this.release();
  }

  /** The caller, once the callee has accepted: send the signed offer. */
  async beginOffer(): Promise<void> {
    if (this.setup.role !== "caller" || this.closed) return;
    await this.queue;
    await this.makeOffer();
  }

  /** A signal from the other person. Signals are applied one after another. */
  handleSignal(type: "offer" | "answer" | "candidate", payload: Record<string, unknown>): void {
    this.queue = this.queue.then(() => this.apply(type, payload)).catch((error) => void this.fail(error instanceof Error ? error.message : "The call could not be set up."));
  }

  /** The user accepted (or declined) the key that had changed. */
  resolveKeyChange(accept: boolean): void {
    const held = this.held;
    if (!held) return;
    this.held = null;
    if (!accept) {
      this.fail("You declined the changed security key.");
      return;
    }
    acceptKey(this.setup.pins, this.setup.peer.userId, held.decision.keyId, held.decision.key);
    this.queue = this.queue
      .then(() => this.proceed(held.type, held.payload, { ...held.decision, trust: "pinned" }))
      .catch((error) => void this.fail(error instanceof Error ? error.message : "The call could not be set up."));
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const track of this.microphone?.getAudioTracks() ?? []) track.enabled = !muted;
    this.setup.onState({ muted });
  }

  /** Release everything. Safe to call more than once. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.teardown();
  }

  // ── negotiation ─────────────────────────────────────────────

  /** An offer is always the caller's and an answer the callee's, whichever side we are. */
  private context(role: BindingRole): BindingContext {
    const { callId, self, peer } = this.setup;
    const [caller, callee] = this.setup.role === "caller" ? [self.userId, peer.userId] : [peer.userId, self.userId];
    return role === "offer" ? { callId, from: caller, to: callee, role } : { callId, from: callee, to: caller, role };
  }

  private async makeOffer(): Promise<void> {
    const peer = this.peer;
    if (!peer) return;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    await this.sendSigned("offer", offer);
    this.armConnectTimer();
  }

  private async sendSigned(type: "offer" | "answer", description: RTCSessionDescriptionInit): Promise<void> {
    const binding = await signBinding(this.setup.identity, this.context(type), description.sdp ?? "");
    const e2ee: E2eePayload = { v: 1, key_id: binding.keyId, signature: binding.signature, public_key: this.setup.identity.publicKey };
    await this.setup.send(type, { sdp: { type: description.type, sdp: description.sdp }, e2ee });
    const queued = this.outgoingCandidates ?? [];
    this.outgoingCandidates = null;
    for (const candidate of queued) await this.setup.send("candidate", { candidate }).catch(() => undefined);
  }

  private async apply(type: "offer" | "answer" | "candidate", payload: Record<string, unknown>): Promise<void> {
    if (this.closed) return;
    if (type === "candidate") {
      const candidate = isRecord(payload.candidate) ? (payload.candidate as RTCIceCandidateInit) : null;
      if (!candidate) return;
      if (this.peer?.remoteDescription) await this.peer.addIceCandidate(candidate);
      else this.pendingCandidates.push(candidate);
      return;
    }

    // The right direction only: a caller waits for an answer, a callee for an offer.
    if ((type === "offer") !== (this.setup.role === "callee")) return;
    if (this.remoteVerified || this.held) return; // one SDP per call; a second is ignored

    const e2ee = readE2ee(payload);
    if (!e2ee || !isRecord(payload.sdp) || typeof payload.sdp.sdp !== "string") {
      throw new Error("The other side did not sign this call, so it cannot be protected. It may be on an older version.");
    }
    const decision = await assess(this.setup.pins, this.setup.peer.userId, e2ee.key_id, e2ee.public_key);
    if (!decision) throw new Error("The other side's key does not match its id. The call was refused.");

    if (decision.trust === "changed") {
      this.held = { type, payload, decision };
      this.setup.onState({ encryption: { status: "key_changed", keyId: decision.keyId } });
      return;
    }
    await this.proceed(type, payload, decision);
  }

  /** The other side's key is acceptable: check its signature, then use its SDP. */
  private async proceed(type: "offer" | "answer", payload: Record<string, unknown>, decision: TrustDecision): Promise<void> {
    const peer = this.peer;
    const e2ee = readE2ee(payload);
    if (this.closed || !peer || !e2ee) return;
    const description = payload.sdp as RTCSessionDescriptionInit;

    const check = await verifyBinding(decision.key, this.context(type), description.sdp ?? "", { keyId: e2ee.key_id, signature: e2ee.signature });
    if (!check.ok) {
      this.setup.onState({ encryption: { status: "failed", reason: "The other side's proof did not check out." } });
      throw new Error("The call's security check failed: what arrived is not what the other side signed. The call was ended.");
    }
    this.remoteVerified = true;
    this.setup.onState({
      encryption: {
        status: "protected",
        trust: decision.trust,
        keyId: decision.keyId,
        safetyNumber: await safetyNumber({ userId: this.setup.self.userId, keyId: this.setup.identity.keyId }, { userId: this.setup.peer.userId, keyId: decision.keyId }),
      },
    });

    await peer.setRemoteDescription({ type: description.type, sdp: description.sdp });
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) await peer.addIceCandidate(candidate);

    if (type === "offer") {
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await this.sendSigned("answer", answer);
      this.armConnectTimer();
    }
  }

  // ── plumbing ────────────────────────────────────────────────

  private armConnectTimer(): void {
    if (this.connectTimer) return;
    this.connectTimer = setTimeout(() => void this.fail("Couldn't connect the audio. The other side may be behind a strict firewall."), CONNECT_TIMEOUT_MS);
  }

  private fail(message: string): Error {
    if (!this.closed) {
      this.closed = true;
      this.teardown();
      this.setup.onState({ phase: "failed", error: message });
    }
    return new Error(message);
  }

  private stopMicrophone(): void {
    for (const track of this.microphone?.getTracks() ?? []) track.stop();
    this.microphone = null;
  }

  private teardown(): void {
    if (this.connectTimer) clearTimeout(this.connectTimer);
    this.connectTimer = null;
    if (this.peer) {
      this.peer.onicecandidate = null;
      this.peer.ontrack = null;
      this.peer.onconnectionstatechange = null;
      this.peer.close();
      this.peer = null;
    }
    if (this.audio) {
      this.audio.pause?.();
      this.audio.srcObject = null;
      this.audio = null;
    }
    this.stopMicrophone();
    this.pendingCandidates = [];
    this.held = null;
  }
}

function microphoneMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access was blocked. Allow it in your browser or system settings and try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found.";
  return "Couldn't start your microphone.";
}

export const browserCallDeps: CallDeps = {
  createPeer: (config) => new RTCPeerConnection(config),
  getMicrophone: () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }),
  createAudio: () => {
    const audio = new Audio();
    audio.autoplay = true;
    return audio;
  },
};
