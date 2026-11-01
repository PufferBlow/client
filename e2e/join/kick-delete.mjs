// Removing someone and deleting your own account, in a real browser against the Docker simulation (docker/sim).
//   node e2e/join/kick-delete.mjs <output folder>
import fs from "node:fs";
import path from "node:path";
import { launch } from "../voice/lib.mjs";

const CLIENT = process.env.E2E_CLIENT ?? "http://127.0.0.1:5173";
const HOST = "host.docker.internal:7576";
const API = `http://${HOST}`;
const PASSWORD = "simpass123";
const OUT = process.argv[2] ?? "kick-delete-shots";
fs.mkdirSync(OUT, { recursive: true });

const post = async (route, body) =>
  (
    await fetch(`${API}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  ).json();
const signin = async (username) =>
  (
    await (
      await fetch(`${API}/api/v1/users/signin?username=${username}&password=${PASSWORD}`)
    ).json()
  ).auth_token;
const results = [];
const step = async (label, run) => {
  try {
    await run();
    results.push(`PASS  ${label}`);
  } catch (error) {
    results.push(`FAIL  ${label}: ${String(error.message).split("\n")[0]}`);
  }
};

async function signedIn(browser, username) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto(`${CLIENT}/login`);
  await page.getByPlaceholder("name@chat.example.com").fill(`${username}@${HOST}`);
  await page.getByPlaceholder("Enter your password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await page.getByRole("button", { name: "Settings" }).waitFor({ timeout: 30_000 });
  return page;
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

const owner = await signin("owner");
const stamp = Math.random().toString(16).slice(2, 8);
const victim = `removed_${stamp}`;
await post("/api/v1/users/signup", { username: victim, password: PASSWORD });
const victimId = (await post("/api/v1/users/profile", { auth_token: await signin(victim) }))
  .user_data.user_id;

const browser = await launch();

await step("members: remove someone with a reason, they show as Removed", async () => {
  const page = await signedIn(browser, "owner");
  await page.goto(`${CLIENT}/control-panel/members`);
  await page.getByLabel("Search members").fill(victim);
  await page
    .getByRole("button", { name: `Remove ${victim} from the server` })
    .waitFor({ timeout: 30_000 });
  await shot(page, "01-members-remove-button");
  await page.getByRole("button", { name: `Remove ${victim} from the server` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Reason").fill("testing the screens");
  await shot(page, "02-remove-dialog");
  await dialog.getByRole("button", { name: "Remove" }).click();
  await dialog.getByText("Removed.").waitFor();
  await dialog.getByRole("button", { name: "Close" }).click();
  await page.getByText("Removed", { exact: true }).waitFor({ timeout: 15_000 });
  await shot(page, "03-members-removed-tag");
});

await step("a removed person is refused, with the reason", async () => {
  const reply = await fetch(`${API}/api/v1/users/signin?username=${victim}&password=${PASSWORD}`);
  const body = await reply.json();
  if (reply.status !== 403 || body.error_code !== "auth.membership_removed")
    throw new Error(`${reply.status} ${body.error_code}`);
});

await step("members: let them back in", async () => {
  const page = await signedIn(browser, "owner");
  await page.goto(`${CLIENT}/control-panel/members`);
  await page.getByLabel("Search members").fill(victim);
  await page.getByRole("button", { name: `Let ${victim} back in` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Let back in" }).click();
  await page
    .getByRole("button", { name: `Remove ${victim} from the server` })
    .waitFor({ timeout: 15_000 });
  await shot(page, "04-members-reinstated");
});

await step("settings: delete your own account", async () => {
  const name = `leaving_${stamp}`;
  await post("/api/v1/users/signup", { username: name, password: PASSWORD });
  const page = await signedIn(browser, name);
  await page.goto(`${CLIENT}/settings/security`);
  await page.getByRole("button", { name: /Delete account/ }).click();
  await page.getByRole("dialog").getByLabel("Confirm with your password").fill("not-my-password");
  await page.getByRole("dialog").getByRole("button", { name: "Delete my account" }).click();
  await page
    .getByRole("dialog")
    .getByText(/password is incorrect/)
    .waitFor({ timeout: 15_000 });
  await shot(page, "05-delete-wrong-password");
  await page.getByRole("dialog").getByLabel("Confirm with your password").fill(PASSWORD);
  await shot(page, "06-delete-dialog");
  await page.getByRole("dialog").getByRole("button", { name: "Delete my account" }).click();
  await page.waitForURL(/login/, { timeout: 30_000 });
  const reply = await fetch(`${API}/api/v1/users/signin?username=${name}&password=${PASSWORD}`);
  if (reply.status === 200) throw new Error("the deleted account can still sign in");
});

await step("settings: the owner is told to hand the server over", async () => {
  const page = await signedIn(browser, "owner");
  await page.goto(`${CLIENT}/settings/security`);
  await page.getByRole("button", { name: /Delete account/ }).click();
  await page.getByRole("dialog").getByLabel("Confirm with your password").fill(PASSWORD);
  await page.getByRole("dialog").getByRole("button", { name: "Delete my account" }).click();
  await page
    .getByRole("dialog")
    .getByText(/Hand the server over/)
    .waitFor({ timeout: 15_000 });
  await shot(page, "07-owner-cannot-delete");
});

await browser.close();
void victimId;
console.log(results.join("\n"));
console.log(
  `\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} steps ok; screenshots in ${path.resolve(OUT)}`,
);
