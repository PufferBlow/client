/**
 * A safety number: 60 digits both people compute from the two people's ids and keys. If they read
 * the same digits to each other (in person, over another app), nobody swapped a key in between.
 */

export interface SafetyParty {
  userId: string;
  keyId: string;
}

/** The same digits on both sides: the two parties are ordered by id before hashing. */
export async function safetyNumber(a: SafetyParty, b: SafetyParty): Promise<string> {
  const [first, second] = [a, b].sort((p, q) => (p.userId < q.userId ? -1 : p.userId > q.userId ? 1 : 0));
  const text = `pufferblow-safety-v1\n${first!.userId}\n${first!.keyId}\n${second!.userId}\n${second!.keyId}`;
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-512", new TextEncoder().encode(text)));
  const groups: string[] = [];
  for (let i = 0; i < 12; i++) {
    let value = 0;
    for (let j = 0; j < 5; j++) value = value * 256 + hash[i * 5 + j]!;
    groups.push(String(value % 100_000).padStart(5, "0"));
  }
  return groups.join(" ");
}
