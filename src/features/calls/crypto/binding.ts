import { verifySignature, type Identity, type PublicJwk } from "./identity";

/**
 * The signed statement that makes a call end-to-end encrypted. A call's audio is encrypted by DTLS
 * between the two browsers, keyed by certificates whose fingerprints travel in the SDP, and the SDP
 * travels through the instance. If the instance changed a fingerprint it could sit in the middle. So
 * each side signs "in this call, between these two people, my fingerprints are these" with its
 * identity key, and the other side checks that signature against the key it has pinned for that
 * person and against the SDP it actually received. A changed fingerprint fails the check.
 */

export type BindingRole = "offer" | "answer";

export interface Binding {
  /** The key that signed. */
  keyId: string;
  signature: string;
}

export interface BindingContext {
  callId: string;
  /** The person who made this SDP. */
  from: string;
  /** The person it is for. */
  to: string;
  role: BindingRole;
}

const VERSION = "pufferblow-call-v1";

/** The `a=fingerprint:` values of an SDP, normalised and sorted (a call can offer more than one hash). */
export function fingerprintsOf(sdp: string): string[] {
  const found = new Set<string>();
  for (const line of sdp.split(/\r?\n/)) {
    const match = /^a=fingerprint:(\S+)\s+([0-9A-Fa-f:]+)\s*$/.exec(line.trim());
    if (match) found.add(`${match[1]!.toLowerCase()} ${match[2]!.toUpperCase()}`);
  }
  return [...found].sort();
}

/** What is signed. Fields are joined with a separator none of them can contain. */
export function statementOf(context: BindingContext, fingerprints: readonly string[]): Uint8Array {
  return new TextEncoder().encode([VERSION, context.callId, context.from, context.to, context.role, ...fingerprints].join("\n"));
}

/** Sign our SDP. An SDP with no fingerprint cannot be bound to anything, so it is refused. */
export async function signBinding(identity: Identity, context: BindingContext, sdp: string): Promise<Binding> {
  const fingerprints = fingerprintsOf(sdp);
  if (fingerprints.length === 0) throw new Error("The call has no DTLS fingerprint to protect.");
  return { keyId: identity.keyId, signature: await identity.sign(statementOf(context, fingerprints)) };
}

export type BindingCheck = { ok: true } | { ok: false; reason: "no_fingerprint" | "bad_signature" };

/** Whether `binding` is `signer`'s signature over the fingerprints in `sdp`, for this call. */
export async function verifyBinding(signer: PublicJwk, context: BindingContext, sdp: string, binding: Binding): Promise<BindingCheck> {
  const fingerprints = fingerprintsOf(sdp);
  if (fingerprints.length === 0) return { ok: false, reason: "no_fingerprint" };
  return (await verifySignature(signer, statementOf(context, fingerprints), binding.signature)) ? { ok: true } : { ok: false, reason: "bad_signature" };
}
