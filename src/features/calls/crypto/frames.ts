/**
 * Frame encryption for calls that go through the media server. The server forwards RTP and must not
 * be able to hear it, so each encoded audio frame is sealed on the sender and opened on the
 * receiver, with a key only the two callers can derive.
 *
 * The key comes from an ECDH exchange whose public keys each side signs with its identity key (see
 * `binding.ts`), so the server cannot substitute its own. Each direction has its own key, which makes
 * the per-frame counter a safe nonce: a counter is never reused under one key.
 */

import type { PublicJwk } from "./identity";

export interface RelayKeyPair {
  /** The public half, as sent to the other side. */
  publicKey: PublicJwk;
  privateKey: CryptoKey;
}

export interface FrameKeys {
  /** Seals our outgoing frames. */
  send: CryptoKey;
  /** Opens the other side's frames. */
  receive: CryptoKey;
}

const ECDH = { name: "ECDH", namedCurve: "P-256" } as const;
const HEADER_BYTES = 4;
const TAG_BITS = 128;
const MAX_COUNTER = 0xffff_ffff;
/** How far behind the newest frame a late one may still arrive and be accepted. */
const REPLAY_WINDOW = 64;

const text = (value: string) => new TextEncoder().encode(value);

export async function generateRelayKeyPair(): Promise<RelayKeyPair> {
  const pair = await crypto.subtle.generateKey(ECDH, false, ["deriveBits"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { publicKey: { kty: "EC", crv: "P-256", x: String(jwk.x), y: String(jwk.y) }, privateKey: pair.privateKey };
}

async function directionKey(secret: CryptoKey, callId: string, senderId: string): Promise<CryptoKey> {
  return crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: text(callId), info: text(`pufferblow-relay-v1|${senderId}`) },
    secret,
    { name: "AES-GCM", length: 128 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Derive both directions' keys from our private key and the other side's public key. */
export async function deriveFrameKeys(input: { privateKey: CryptoKey; peerPublicKey: PublicJwk; callId: string; selfId: string; peerId: string }): Promise<FrameKeys> {
  const peer = await crypto.subtle.importKey("jwk", input.peerPublicKey, ECDH, false, []);
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: peer }, input.privateKey, 256);
  const secret = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return { send: await directionKey(secret, input.callId, input.selfId), receive: await directionKey(secret, input.callId, input.peerId) };
}

const nonceFor = (counter: number): Uint8Array<ArrayBuffer> => {
  const nonce = new Uint8Array(new ArrayBuffer(12));
  new DataView(nonce.buffer).setUint32(8, counter);
  return nonce;
};

/** Seal one frame: a 4-byte counter, then the ciphertext and tag. The counter is also authenticated. */
export async function sealFrame(key: CryptoKey, counter: number, frame: ArrayBuffer): Promise<ArrayBuffer> {
  if (!Number.isInteger(counter) || counter < 0 || counter > MAX_COUNTER) throw new Error("The frame counter ran out; the call must be restarted.");
  const header = new Uint8Array(new ArrayBuffer(HEADER_BYTES));
  new DataView(header.buffer).setUint32(0, counter);
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonceFor(counter), additionalData: header, tagLength: TAG_BITS }, key, frame));
  const out = new Uint8Array(new ArrayBuffer(HEADER_BYTES + sealed.length));
  out.set(header, 0);
  out.set(sealed, HEADER_BYTES);
  return out.buffer;
}

/** Open a frame sealed by `sealFrame`. Null for anything that is not authentic (wrong key, altered, truncated). */
export async function openFrame(key: CryptoKey, data: ArrayBuffer): Promise<{ counter: number; frame: ArrayBuffer } | null> {
  if (data.byteLength < HEADER_BYTES + TAG_BITS / 8) return null;
  const bytes = new Uint8Array(data);
  const header = bytes.slice(0, HEADER_BYTES);
  const counter = new DataView(header.buffer).getUint32(0);
  try {
    const frame = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonceFor(counter), additionalData: header, tagLength: TAG_BITS }, key, bytes.slice(HEADER_BYTES));
    return { counter, frame };
  } catch {
    return null;
  }
}

/** Remembers which counters have been accepted, so a frame replayed by the server is dropped. */
export class ReplayWindow {
  private newest = -1;
  private seen = new Set<number>();

  /** True the first time a counter is offered (and recent enough), false for repeats and stale ones. */
  accept(counter: number): boolean {
    if (counter > this.newest) {
      this.newest = counter;
      for (const old of this.seen) if (old <= counter - REPLAY_WINDOW) this.seen.delete(old);
      this.seen.add(counter);
      return true;
    }
    if (counter <= this.newest - REPLAY_WINDOW || this.seen.has(counter)) return false;
    this.seen.add(counter);
    return true;
  }
}

/** Seal outgoing frames and open incoming ones with whatever keys are current; frames wait for no one. */
export interface FrameCipher {
  setKeys(keys: FrameKeys): void;
  /** A transform for outgoing encoded frames. Until keys exist the frames are dropped: audio must never leave unsealed. */
  seal(): TransformStream<{ data: ArrayBuffer }, { data: ArrayBuffer }>;
  /** A transform for incoming encoded frames; anything that does not open is dropped. */
  open(): TransformStream<{ data: ArrayBuffer }, { data: ArrayBuffer }>;
}

export function createFrameCipher(): FrameCipher {
  let keys: FrameKeys | null = null;
  let counter = 0;
  const window = new ReplayWindow();
  return {
    setKeys: (next) => void (keys = next),
    seal: () =>
      new TransformStream({
        async transform(frame, controller) {
          if (!keys) return;
          try {
            frame.data = await sealFrame(keys.send, counter++, frame.data);
            controller.enqueue(frame);
          } catch {
            // A frame that cannot be sealed is not sent.
          }
        },
      }),
    open: () =>
      new TransformStream({
        async transform(frame, controller) {
          if (!keys) return;
          const opened = await openFrame(keys.receive, frame.data);
          if (!opened || !window.accept(opened.counter)) return;
          frame.data = opened.frame;
          controller.enqueue(frame);
        },
      }),
  };
}

/** The statement a relay key is signed with: bound to this call, this direction and these two people. */
export function relayStatement(input: { callId: string; from: string; to: string; publicKey: PublicJwk }): Uint8Array {
  return text(["pufferblow-call-relay-v1", input.callId, input.from, input.to, input.publicKey.x, input.publicKey.y].join("\n"));
}
