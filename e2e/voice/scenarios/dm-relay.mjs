// 1:1 calls through the media server (the relay), with the direct attempt skipped by the developer switch.
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
const alice = await person(browser, "alice", {
  goto: `/dashboard/dms/${conversation}?peer=bob`,
  forceRelay: true,
});
const bob = await person(browser, "bob", {
  goto: `/dashboard/dms/${conversation}?peer=alice`,
  forceRelay: true,
});

await alice.getByRole("button", { name: "Call bob" }).click();
await bob
  .getByRole("alertdialog", { name: /Incoming call from alice/ })
  .waitFor({ timeout: 15_000 });
await bob.getByRole("button", { name: "Accept" }).click();
await seen(
  "alice is connected through the server and says it is encrypted",
  alice
    .getByText(/End-to-end encrypted.*via server/)
    .first()
    .waitFor({ timeout: 25_000 }),
);
await seen(
  "so is bob",
  bob
    .getByText(/End-to-end encrypted.*via server/)
    .first()
    .waitFor({ timeout: 25_000 }),
);
await alice.waitForTimeout(5000);

// If a frame could not be opened the decoder would get noise and report no energy: energy means the
// sealed frames were opened with the keys from the signed exchange.
const a = await audio(alice);
const b = await audio(bob);
check("alice hears bob through the sealed relay", a.in.packets > 50 && a.in.energy > 0);
check("bob hears alice through the sealed relay", b.in.packets > 50 && b.in.energy > 0);

const mine = await safetyNumber(alice);
check("the safety numbers match on the relay too", mine === (await safetyNumber(bob)));

await alice.getByRole("button", { name: "Hang up" }).click();
await seen(
  "hang-up reaches the other side",
  bob.getByText(/The call ended/).waitFor({ timeout: 10_000 }),
);

await browser.close();
process.exit(failed() ? 1 : 0);
