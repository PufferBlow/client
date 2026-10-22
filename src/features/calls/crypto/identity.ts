/**
 * This device's identity key: the P-256 key it signs calls with. The private half is created
 * non-extractable and kept in IndexedDB, so scripts on the page can ask it to sign but never read
 * it. The public half is registered with the instance (see `identityApi`) and handed to the other
 * person, who pins it.
 */

export interface PublicJwk {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
}

export interface Identity {
  keyId: string;
  publicKey: PublicJwk;
  /** Signs bytes with the private key; the key itself is not reachable from here. */
  sign(data: Uint8Array): Promise<string>;
}

/** Where a key pair lives between sessions. */
export interface KeyStore {
  get(name: string): Promise<CryptoKeyPair | null>;
  put(name: string, pair: CryptoKeyPair): Promise<void>;
}

const ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGNING = { name: "ECDSA", hash: "SHA-256" } as const;

export const toBase64Url = (bytes: Uint8Array): string => {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const fromBase64Url = (text: string): Uint8Array<ArrayBuffer> => {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

/** The id both sides compute for a key: the first 32 hex characters of SHA-256 over `x || y`. */
export async function keyIdOf(jwk: Pick<PublicJwk, "x" | "y">): Promise<string> {
  const x = fromBase64Url(jwk.x);
  const y = fromBase64Url(jwk.y);
  const joined = new Uint8Array(x.length + y.length);
  joined.set(x, 0);
  joined.set(y, x.length);
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", joined))).slice(0, 32);
}

const canonical = (jwk: JsonWebKey): PublicJwk => ({ kty: "EC", crv: "P-256", x: String(jwk.x), y: String(jwk.y) });

/** This account's key on this device, made on first use. */
export async function loadIdentity(store: KeyStore, name: string): Promise<Identity> {
  let pair = await store.get(name);
  if (!pair) {
    pair = await crypto.subtle.generateKey(ALGORITHM, false, ["sign", "verify"]);
    await store.put(name, pair);
  }
  const publicKey = canonical(await crypto.subtle.exportKey("jwk", pair.publicKey));
  const privateKey = pair.privateKey;
  return {
    keyId: await keyIdOf(publicKey),
    publicKey,
    sign: async (data) => toBase64Url(new Uint8Array(await crypto.subtle.sign(SIGNING, privateKey, data as BufferSource))),
  };
}

/** Whether `signature` is `data` signed by the owner of `publicKey`. Anything malformed is simply not valid. */
export async function verifySignature(publicKey: PublicJwk, data: Uint8Array, signature: string): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey("jwk", publicKey, ALGORITHM, false, ["verify"]);
    return await crypto.subtle.verify(SIGNING, key, fromBase64Url(signature), data as BufferSource);
  } catch {
    return false;
  }
}

/** Keeps nothing past the page: for tests and for browsers without IndexedDB. */
export function memoryKeyStore(): KeyStore {
  const pairs = new Map<string, CryptoKeyPair>();
  return { get: async (name) => pairs.get(name) ?? null, put: async (name, pair) => void pairs.set(name, pair) };
}

const DB_NAME = "pufferblow-identity";
const STORE = "keys";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Couldn't open the key store."));
  });
}

function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDatabase().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = action(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("The key store failed."));
      }),
  );
}

/** Key pairs in IndexedDB (a CryptoKey can be stored there without ever being exportable). */
export const indexedDbKeyStore: KeyStore = {
  get: async (name) => ((await run("readonly", (s) => s.get(name))) as CryptoKeyPair | undefined) ?? null,
  put: async (name, pair) => void (await run("readwrite", (s) => s.put(pair, name))),
};
