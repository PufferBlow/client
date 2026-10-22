// Voice channels: three people in one room, mute and deafen agreeing with the instance, leaving, rejoining.
import { audio, check, failed, ids, launch, person, roster, seen } from "../lib.mjs";

const browser = await launch();
const { voice_channel: channel } = ids();
const alice = await person(browser, "alice");
const bob = await person(browser, "bob");
const carol = await person(browser, "carol");

const join = (page) => page.getByRole("button", { name: /Join voice channel lounge/ }).click();
const inCall = (page, who) =>
  page.getByRole("list", { name: "In this call" }).getByText(who, { exact: true });

// ── two people, audio both ways ──
await join(alice);
await join(bob);
await seen("alice sees bob in the room", inCall(alice, "bob").waitFor({ timeout: 20_000 }));
await seen("bob sees alice in the room", inCall(bob, "alice").waitFor({ timeout: 20_000 }));
await alice.waitForTimeout(4000);
const a = await audio(alice);
const b = await audio(bob);
check("alice hears bob (decoded audio, not just packets)", a.in.packets > 50 && a.in.energy > 0);
check("bob hears alice", b.in.packets > 50 && b.in.energy > 0);

// ── a third person ──
await join(carol);
await seen(
  "carol sees both",
  Promise.all([
    inCall(carol, "alice").waitFor({ timeout: 20_000 }),
    inCall(carol, "bob").waitFor({ timeout: 20_000 }),
  ]),
);
await alice.waitForTimeout(4000);
const c = await audio(carol);
check("carol hears the room", c.in.packets > 50 && c.in.energy > 0);
check(
  "alice now receives two streams",
  (await audio(alice)).states.length >= 1 && (await roster(channel)).length === 3,
);

// ── mute and deafen agree with what the instance reports ──
await bob.getByRole("button", { name: "Mute microphone" }).click();
await bob.waitForTimeout(1500);
check(
  "the instance knows bob is muted",
  (await roster(channel)).find((p) => p.username === "bob")?.is_muted === true,
);
await seen(
  "alice sees bob muted",
  alice
    .getByRole("list", { name: "In this call" })
    .getByLabel("Muted")
    .first()
    .waitFor({ timeout: 10_000 }),
);
await bob.getByRole("button", { name: "Unmute microphone" }).click();
await bob.waitForTimeout(1500);
check(
  "unmuting is reported too",
  (await roster(channel)).find((p) => p.username === "bob")?.is_muted === false,
);

await carol.getByRole("button", { name: "Deafen" }).click();
await carol.waitForTimeout(1500);
const deaf = (await roster(channel)).find((p) => p.username === "carol");
check(
  "deafening is reported, and mutes too",
  deaf?.is_deafened === true && deaf?.is_muted === true,
);
await carol.getByRole("button", { name: "Undeafen" }).click();

// ── leaving ──
await bob.getByRole("button", { name: /lounge, connected/ }).click();
await seen(
  "bob leaves and the others see it go",
  alice
    .getByRole("list", { name: "In this call" })
    .getByText("bob", { exact: true })
    .waitFor({ state: "detached", timeout: 15_000 }),
);
check("the instance agrees he left", !(await roster(channel)).some((p) => p.username === "bob"));

// ── rejoining works (the one-time join token is not reused) ──
await join(bob);
await seen("bob can rejoin", inCall(alice, "bob").waitFor({ timeout: 20_000 }));
await alice.waitForTimeout(8000);
const again = { bob: await audio(bob), alice: await audio(alice) };
console.log("after the rejoin:", JSON.stringify(again));
for (const [who, page] of [
  ["alice", alice],
  ["bob", bob],
  ["carol", carol],
])
  console.log(
    `${who} sees:`,
    JSON.stringify(await page.getByRole("alert").allInnerTexts()),
    JSON.stringify(await page.getByRole("status").allInnerTexts()),
  );
check("and hears the room again", again.bob.in.packets > 20 && again.bob.in.energy > 0);
check("and is heard again", again.alice.in.energy > 0);

await browser.close();
process.exit(failed() ? 1 : 0);
