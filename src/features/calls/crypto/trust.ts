import { keyIdOf, type PublicJwk } from "./identity";

/**
 * Whose key is whose. The first key seen for a person is pinned (trust on first use); a call signed by
 * a key that is not pinned is held until the user says it is fine, because it is either a new device
 * of theirs or an instance handing out a key that is not theirs, and nothing here can tell which.
 * Comparing safety numbers in person (or on another channel) is how a pin becomes "verified".
 */

export type Trust =
  /** Compared with the other person, and the key is the one that was compared. */
  | "verified"
  /** Pinned from an earlier call; not compared. */
  | "pinned"
  /** First time: pinned now. */
  | "new"
  /** A key we have not pinned, for someone we have pinned others for. Hold the call and ask. */
  | "changed";

export interface PinnedKey {
  keyId: string;
  publicKey: PublicJwk;
  firstSeen: string;
  verified: boolean;
}

export interface PinStore {
  read(): Record<string, PinnedKey[]>;
  write(pins: Record<string, PinnedKey[]>): void;
}

/** Pins in `localStorage`, one record per account on this device. */
export function localPinStore(accountId: string): PinStore {
  const key = `pb_call_pins:${accountId}`;
  return {
    read: () => {
      try {
        const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "{}");
        return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, PinnedKey[]>) : {};
      } catch {
        return {};
      }
    },
    write: (pins) => {
      try {
        localStorage.setItem(key, JSON.stringify(pins));
      } catch {
        // Storage can be unavailable; the call still works, the pin just will not survive.
      }
    },
  };
}

export function memoryPinStore(): PinStore {
  let pins: Record<string, PinnedKey[]> = {};
  return { read: () => pins, write: (next) => void (pins = next) };
}

export interface TrustDecision {
  trust: Trust;
  /** The key to verify the call's signature with. */
  key: PublicJwk;
  keyId: string;
}

/**
 * Decide how far to trust `candidate` as `peerId`'s key and, when it is the first, pin it. The key a
 * call arrives signed with is only believed if its id is the hash of its own coordinates, so a server
 * cannot attach someone else's id to a different key.
 */
export async function assess(pins: PinStore, peerId: string, claimedKeyId: string, candidate: PublicJwk): Promise<TrustDecision | null> {
  if ((await keyIdOf(candidate)) !== claimedKeyId) return null;
  const all = pins.read();
  const known = all[peerId] ?? [];
  const match = known.find((k) => k.keyId === claimedKeyId);
  if (match) return { trust: match.verified ? "verified" : "pinned", key: match.publicKey, keyId: claimedKeyId };
  if (known.length === 0) {
    pins.write({ ...all, [peerId]: [{ keyId: claimedKeyId, publicKey: candidate, firstSeen: new Date().toISOString(), verified: false }] });
    return { trust: "new", key: candidate, keyId: claimedKeyId };
  }
  return { trust: "changed", key: candidate, keyId: claimedKeyId };
}

/** The user accepted a key that had changed: it is pinned beside the others, unverified. */
export function acceptKey(pins: PinStore, peerId: string, keyId: string, publicKey: PublicJwk): void {
  const all = pins.read();
  const known = all[peerId] ?? [];
  if (known.some((k) => k.keyId === keyId)) return;
  pins.write({ ...all, [peerId]: [...known, { keyId, publicKey, firstSeen: new Date().toISOString(), verified: false }] });
}

/** The user compared safety numbers and they matched. */
export function markVerified(pins: PinStore, peerId: string, keyId: string): void {
  const all = pins.read();
  pins.write({ ...all, [peerId]: (all[peerId] ?? []).map((k) => (k.keyId === keyId ? { ...k, verified: true } : k)) });
}
