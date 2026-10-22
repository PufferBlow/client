// Three people sit in a voice channel for a minute doing nothing: nobody's connection may drop or go quiet.
import { audio, check, failed, launch, person } from "../lib.mjs";

const browser = await launch();
const people = {
  alice: await person(browser, "alice"),
  bob: await person(browser, "bob"),
  carol: await person(browser, "carol"),
};
for (const page of Object.values(people))
  await page.getByRole("button", { name: /Join voice channel lounge/ }).click();
await people.alice.waitForTimeout(5000);

const trail = [];
for (let second = 0; second < 60; second += 5) {
  const row = {};
  for (const [name, page] of Object.entries(people))
    row[name] = (await audio(page)).states.join("/");
  trail.push(`${second}s ${JSON.stringify(row)}`);
  await people.alice.waitForTimeout(5000);
}
console.log(trail.join("\n"));
for (const [name, page] of Object.entries(people)) {
  const a = await audio(page);
  check(
    `${name} is still connected and hearing the others after a minute`,
    a.states.every((s) => s === "connected") && a.in.packets > 1000 && a.in.energy > 0,
  );
}
await browser.close();
process.exit(failed() ? 1 : 0);
