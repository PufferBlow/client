// 1:1 calls straight between two browsers: ringing, an end-to-end encrypted call, a changed key, declining.
import {
  audio,
  check,
  conversationBetween,
  failed,
  launch,
  person,
  safetyNumber,
  seen,
} from "../lib.mjs";

const browser = await launch();
const conversation = await conversationBetween("alice", "bob");
const alice = await person(browser, "alice", { goto: `/dashboard/dms/${conversation}?peer=bob` });
const bob = await person(browser, "bob", { goto: `/dashboard/dms/${conversation}?peer=alice` });

// ── a normal call ──
await alice.getByRole("button", { name: "Call bob" }).click();
await bob
  .getByRole("alertdialog", { name: /Incoming call from alice/ })
  .waitFor({ timeout: 15_000 });
await bob.getByRole("button", { name: "Accept" }).click();
await alice
  .getByText(/End-to-end encrypted/)
  .first()
  .waitFor({ timeout: 20_000 });
await bob
  .getByText(/End-to-end encrypted/)
  .first()
  .waitFor({ timeout: 20_000 });
await alice.waitForTimeout(4000);
check(
  "audio is decoded both ways",
  (await audio(alice)).in.energy > 0 && (await audio(bob)).in.energy > 0,
);
check(
  "the call goes straight between the two (no 'via server')",
  (await alice.getByText(/via server/).count()) === 0,
);

const mine = await safetyNumber(alice);
const theirs = await safetyNumber(bob);
check(
  `both show the same safety number (${mine})`,
  mine === theirs && /^(\d{5} ){11}\d{5}$/.test(mine),
);

await alice.getByRole("button", { name: "Mute", exact: true }).click();
await seen(
  "muting works",
  alice.getByRole("button", { name: "Unmute", exact: true }).waitFor({ timeout: 5000 }),
);
await alice.getByRole("button", { name: "Hang up" }).click();
await seen(
  "the other side is told the call ended",
  bob.getByText(/The call ended/).waitFor({ timeout: 10_000 }),
);
await bob.getByRole("button", { name: "Dismiss" }).click();

// ── bob's key changes (new device, cleared data): alice must be asked before trusting it ──
await bob.evaluate(
  () =>
    new Promise((resolve) => (indexedDB.deleteDatabase("pufferblow-identity").onsuccess = resolve)),
);
await bob.reload();
await bob.getByRole("button", { name: "Settings" }).waitFor({ timeout: 30_000 });
await alice.getByRole("button", { name: "Call bob" }).click();
await bob
  .getByRole("alertdialog", { name: /Incoming call from alice/ })
  .waitFor({ timeout: 15_000 });
await bob.getByRole("button", { name: "Accept" }).click();
await seen(
  "a changed key stops the call and asks",
  alice.getByRole("alertdialog", { name: "Security key changed" }).waitFor({ timeout: 20_000 }),
);
check("no audio reaches alice before she accepts the key", (await audio(alice)).in.packets === 0);
await alice.getByRole("button", { name: "Trust new key" }).click();
await seen(
  "the call goes on once the new key is accepted",
  alice
    .getByText(/End-to-end encrypted/)
    .first()
    .waitFor({ timeout: 20_000 }),
);
await alice.waitForTimeout(3000);
check("and audio flows", (await audio(alice)).in.energy > 0);
await alice.getByRole("button", { name: "Hang up" }).click();
await bob
  .getByRole("button", { name: "Dismiss" })
  .click()
  .catch(() => undefined);
await alice
  .getByRole("button", { name: "Dismiss" })
  .click()
  .catch(() => undefined);

// ── declining ──
await alice.getByRole("button", { name: "Call bob" }).click();
await bob.getByRole("alertdialog", { name: /Incoming call/ }).waitFor({ timeout: 15_000 });
await bob.getByRole("button", { name: "Decline" }).click();
await seen(
  "a decline reaches the caller",
  alice.getByText(/declined/).waitFor({ timeout: 10_000 }),
);
await alice.getByRole("button", { name: "Dismiss" }).click();

// ── closing the tab ends the call for the other side ──
await alice.waitForTimeout(5500); // the instance does not let the same person ring the same person again within 5 s
await alice.getByRole("button", { name: "Call bob" }).click();
await bob.getByRole("button", { name: "Accept" }).click({ timeout: 15_000 });
await alice
  .getByText(/End-to-end encrypted/)
  .first()
  .waitFor({ timeout: 20_000 });
await bob.close();
await seen(
  "closing a tab ends the call for the other side",
  alice.getByText(/The call ended/).waitFor({ timeout: 15_000 }),
);

await browser.close();
process.exit(failed() ? 1 : 0);
