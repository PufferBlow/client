import { describe, expect, it } from "vitest";
import { fingerprintsOf, signBinding, verifyBinding, type BindingContext } from "./binding";
import { keyIdOf, loadIdentity, memoryKeyStore, verifySignature } from "./identity";
import { safetyNumber } from "./safety";
import { acceptKey, assess, markVerified, memoryPinStore } from "./trust";

const SDP = (fingerprint: string) => `v=0\r\na=group:BUNDLE 0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\na=fingerprint:sha-256 ${fingerprint}\r\na=setup:actpass\r\n`;
const FP_A = "AA:BB:CC:DD";
const FP_B = "11:22:33:44";
const context: BindingContext = { callId: "call-1", from: "ada", to: "grace", role: "offer" };

describe("identity keys", () => {
  it("computes the key id the server computes (first 32 hex of SHA-256 over x then y)", async () => {
    // The same vector the backend asserts against: x = bytes 0..31, y = bytes 32..63.
    const id = await keyIdOf({ x: "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8", y: "ICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8" });
    expect(id).toBe("fdeab9acf3710362bd2658cdc9a29e8f");
  });

  it("makes a key once per account and gives the same one back", async () => {
    const store = memoryKeyStore();
    const first = await loadIdentity(store, "ada@x");
    const again = await loadIdentity(store, "ada@x");
    const other = await loadIdentity(store, "grace@x");

    expect(again.keyId).toBe(first.keyId);
    expect(other.keyId).not.toBe(first.keyId);
    expect(first.publicKey).toMatchObject({ kty: "EC", crv: "P-256" });
    expect(await keyIdOf(first.publicKey)).toBe(first.keyId);
  });

  it("never exposes the private key", async () => {
    const identity = await loadIdentity(memoryKeyStore(), "ada@x");
    expect(JSON.stringify(identity)).not.toContain('"d"');
    expect(Object.keys(identity).sort()).toEqual(["keyId", "publicKey", "sign"]);
  });

  it("verifies its own signatures and nobody else's", async () => {
    const ada = await loadIdentity(memoryKeyStore(), "ada");
    const grace = await loadIdentity(memoryKeyStore(), "grace");
    const data = new TextEncoder().encode("hello");
    const signature = await ada.sign(data);

    expect(await verifySignature(ada.publicKey, data, signature)).toBe(true);
    expect(await verifySignature(grace.publicKey, data, signature)).toBe(false);
    expect(await verifySignature(ada.publicKey, new TextEncoder().encode("hellp"), signature)).toBe(false);
    expect(await verifySignature(ada.publicKey, data, "not a signature")).toBe(false);
  });
});

describe("call bindings", () => {
  it("reads every DTLS fingerprint out of an SDP, in a fixed order", () => {
    const sdp = `${SDP(FP_A)}a=fingerprint:sha-512 ff:ee\r\n`;
    expect(fingerprintsOf(sdp)).toEqual(["sha-256 AA:BB:CC:DD", "sha-512 FF:EE"]);
    expect(fingerprintsOf("v=0\r\n")).toEqual([]);
  });

  it("accepts the SDP that was signed", async () => {
    const ada = await loadIdentity(memoryKeyStore(), "ada");
    const binding = await signBinding(ada, context, SDP(FP_A));
    expect(binding.keyId).toBe(ada.keyId);
    expect(await verifyBinding(ada.publicKey, context, SDP(FP_A), binding)).toEqual({ ok: true });
  });

  it("rejects an SDP whose fingerprint was swapped on the way", async () => {
    const ada = await loadIdentity(memoryKeyStore(), "ada");
    const binding = await signBinding(ada, context, SDP(FP_A));
    expect(await verifyBinding(ada.publicKey, context, SDP(FP_B), binding)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects the same signature used for another call, direction or person", async () => {
    const ada = await loadIdentity(memoryKeyStore(), "ada");
    const binding = await signBinding(ada, context, SDP(FP_A));
    for (const other of [{ callId: "call-2" }, { role: "answer" as const }, { from: "mallory" }, { to: "mallory" }]) {
      expect((await verifyBinding(ada.publicKey, { ...context, ...other }, SDP(FP_A), binding)).ok).toBe(false);
    }
  });

  it("rejects a binding made by someone else's key", async () => {
    const ada = await loadIdentity(memoryKeyStore(), "ada");
    const mallory = await loadIdentity(memoryKeyStore(), "mallory");
    const forged = await signBinding(mallory, context, SDP(FP_B));
    expect((await verifyBinding(ada.publicKey, context, SDP(FP_B), forged)).ok).toBe(false);
  });

  it("will not sign, or accept, an SDP with nothing to protect", async () => {
    const ada = await loadIdentity(memoryKeyStore(), "ada");
    await expect(signBinding(ada, context, "v=0\r\n")).rejects.toThrow(/fingerprint/);
    const binding = await signBinding(ada, context, SDP(FP_A));
    expect(await verifyBinding(ada.publicKey, context, "v=0\r\n", binding)).toEqual({ ok: false, reason: "no_fingerprint" });
  });
});

describe("trust on first use", () => {
  it("pins the first key it sees, then recognises it", async () => {
    const pins = memoryPinStore();
    const grace = await loadIdentity(memoryKeyStore(), "grace");

    expect((await assess(pins, "grace", grace.keyId, grace.publicKey))?.trust).toBe("new");
    expect((await assess(pins, "grace", grace.keyId, grace.publicKey))?.trust).toBe("pinned");
    markVerified(pins, "grace", grace.keyId);
    expect((await assess(pins, "grace", grace.keyId, grace.publicKey))?.trust).toBe("verified");
  });

  it("holds a different key for someone already pinned, until it is accepted", async () => {
    const pins = memoryPinStore();
    const first = await loadIdentity(memoryKeyStore(), "grace-laptop");
    const second = await loadIdentity(memoryKeyStore(), "grace-phone");
    await assess(pins, "grace", first.keyId, first.publicKey);

    expect((await assess(pins, "grace", second.keyId, second.publicKey))?.trust).toBe("changed");
    expect(pins.read().grace).toHaveLength(1); // nothing was pinned by asking

    acceptKey(pins, "grace", second.keyId, second.publicKey);
    expect((await assess(pins, "grace", second.keyId, second.publicKey))?.trust).toBe("pinned");
  });

  it("does not believe a key id that is not the hash of the key", async () => {
    const grace = await loadIdentity(memoryKeyStore(), "grace");
    const mallory = await loadIdentity(memoryKeyStore(), "mallory");
    expect(await assess(memoryPinStore(), "grace", grace.keyId, mallory.publicKey)).toBeNull();
  });

  it("keeps one person's pins apart from another's", async () => {
    const pins = memoryPinStore();
    const key = await loadIdentity(memoryKeyStore(), "k");
    await assess(pins, "grace", key.keyId, key.publicKey);
    expect((await assess(pins, "linus", key.keyId, key.publicKey))?.trust).toBe("new");
  });
});

describe("safety numbers", () => {
  const ada = { userId: "ada", keyId: "a".repeat(32) };
  const grace = { userId: "grace", keyId: "b".repeat(32) };

  it("is 60 digits in twelve groups, and the same from either side", async () => {
    const mine = await safetyNumber(ada, grace);
    expect(mine).toMatch(/^(\d{5} ){11}\d{5}$/);
    expect(await safetyNumber(grace, ada)).toBe(mine);
  });

  it("changes when either key does", async () => {
    const mine = await safetyNumber(ada, grace);
    expect(await safetyNumber(ada, { ...grace, keyId: "c".repeat(32) })).not.toBe(mine);
    expect(await safetyNumber({ ...ada, keyId: "d".repeat(32) }, grace)).not.toBe(mine);
  });
});
