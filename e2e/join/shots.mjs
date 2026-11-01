// Walks the "join a server" screens against the Docker simulation (docker/sim) and saves a screenshot of each state.
// Needs the client dev server (E2E_CLIENT, default http://127.0.0.1:5173) and the three simulated instances up.
//   node e2e/join/shots.mjs <output folder>
import fs from "node:fs";
import path from "node:path";
import { launch } from "../voice/lib.mjs";

const CLIENT = process.env.E2E_CLIENT ?? "http://127.0.0.1:5173";
const OUT = process.argv[2] ?? "join-shots";
const PASSWORD = "simpass123";
const HOSTS = {
  pb1: "host.docker.internal:7576",
  pb2: "host.docker.internal:7577",
  pb3: "host.docker.internal:7578",
};
fs.mkdirSync(OUT, { recursive: true });

const api = async (host, route, body) =>
  (
    await fetch(`http://${host}${route}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  ).json();
const results = [];
const step = async (label, run) => {
  try {
    await run();
    results.push(`PASS  ${label}`);
  } catch (error) {
    results.push(`FAIL  ${label}: ${String(error.message).split("\n")[0]}`);
  }
};

async function signedIn(browser, key, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(`${CLIENT}/login`);
  await page.getByPlaceholder("name@chat.example.com").fill(`owner@${HOSTS[key]}`);
  await page.getByPlaceholder("Enter your password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await page.getByRole("button", { name: "Settings" }).waitFor({ timeout: 30_000 });
  return page;
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const openPopup = async (page) => {
  await page.getByRole("button", { name: "Join a server" }).click();
  await page.getByLabel("Server address").waitFor();
};
const typeAddress = async (page, address) => {
  await page.getByLabel("Server address").fill(address);
};

const browser = await launch();

// ── joining, as the owner of Open Harbor (an account that has joined nothing yet) ──
const page = await signedIn(browser, "pb1");
await step("rail with the + button", async () => shot(page, "01-dashboard-rail"));

await step("popup, empty", async () => {
  await openPopup(page);
  await shot(page, "02-popup-empty");
});
await step("popup, your own server", async () => {
  await typeAddress(page, HOSTS.pb1);
  await page.getByText("That is your own server.").waitFor();
  await shot(page, "03-popup-own-server");
});
await step("popup, no such server", async () => {
  await typeAddress(page, "127.0.0.1:9");
  await page.getByText(/Couldn.t find a Pufferblow server/).waitFor({ timeout: 20_000 });
  await shot(page, "04-popup-not-found");
});
await step("popup, invite only", async () => {
  await typeAddress(page, HOSTS.pb2);
  await page.getByText("Invite only.").waitFor({ timeout: 20_000 });
  await shot(page, "05-popup-invite-only");
});
await step("popup, invite only, no code entered", async () => {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^join$/i })
    .click();
  await page.getByText("Enter the invitation code you were given.").waitFor();
  await shot(page, "06-popup-code-missing");
});
await step("popup, invite only, wrong code", async () => {
  await page.getByLabel("Invitation code").fill("WRONGCODE123");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /join with code/i })
    .click();
  await page
    .getByRole("alert")
    .filter({ hasText: /invitation code/i })
    .waitFor({ timeout: 20_000 });
  await shot(page, "07-popup-wrong-code");
});
await step("popup, request to join", async () => {
  await typeAddress(page, HOSTS.pb3);
  await page.getByText("Asks to approve new people.").waitFor({ timeout: 20_000 });
  await page
    .getByLabel("Note for the moderators")
    .fill("Hi, I run Open Harbor and would like to visit.");
  await shot(page, "08-popup-request");
});
await step("request sent", async () => {
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /request to join/i })
    .click();
  await page.getByText("Request sent").waitFor({ timeout: 20_000 });
  await shot(page, "09-request-sent");
  await page.getByRole("button", { name: "Done" }).click();
});
await step("rail shows the waiting server", async () => {
  await page.reload();
  await page.getByRole("button", { name: "Settings" }).waitFor({ timeout: 30_000 });
  await shot(page, "10-rail-waiting-tile");
});
await step("popup, already asked", async () => {
  await openPopup(page);
  await typeAddress(page, HOSTS.pb3);
  await page.getByText(/already joined it/).waitFor({ timeout: 20_000 });
  await shot(page, "11-popup-already-asked");
  await page.keyboard.press("Escape");
});

// a real code, made by the owner of Members Only
const pb2Owner = (
  await api(HOSTS.pb2, "/api/v1/users/signin", { username: "owner", password: PASSWORD })
).auth_token;
const code = (
  await api(HOSTS.pb2, "/api/v1/server/invites", {
    auth_token: pb2Owner,
    note: "screens",
    max_uses: 5,
  })
).invite.code;
await step("join with a good code", async () => {
  await openPopup(page);
  await typeAddress(page, HOSTS.pb2);
  await page.getByText("Invite only.").waitFor({ timeout: 20_000 });
  await page.getByLabel("Invitation code").fill(code);
  await shot(page, "12-popup-good-code");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /join with code/i })
    .click();
  await page.waitForURL(/dashboard\/channels/, { timeout: 30_000 });
  await page.getByRole("button", { name: "Settings" }).waitFor({ timeout: 30_000 });
  await shot(page, "13-joined-members-only");
});
await step("rail with the home server, the joined one and the waiting one", async () => {
  await page.goto(`${CLIENT}/dashboard/channels`);
  await page.getByRole("button", { name: "Settings" }).waitFor({ timeout: 30_000 });
  await shot(page, "14-rail-three-servers");
});

// narrow screen
await step("popup on a phone", async () => {
  const phone = await signedIn(browser, "pb1", { width: 390, height: 844 });
  await phone
    .getByRole("button", { name: "Join a server" })
    .first()
    .click()
    .catch(async () => {
      await phone
        .getByRole("button", { name: /open servers|servers/i })
        .first()
        .click();
      await phone.getByRole("button", { name: "Join a server" }).first().click();
    });
  await phone.getByLabel("Server address").fill(HOSTS.pb2);
  await phone.getByText("Invite only.").waitFor({ timeout: 20_000 });
  await shot(phone, "15-popup-phone");
});

// ── staff screens ──
await step("join requests (By Approval)", async () => {
  const staff = await signedIn(browser, "pb3");
  await staff.goto(`${CLIENT}/control-panel/join-requests`);
  await staff
    .getByRole("heading", { name: /join requests/i })
    .first()
    .waitFor({ timeout: 30_000 });
  await staff.waitForTimeout(1500);
  await shot(staff, "16-control-join-requests");
  const approve = staff.getByRole("button", { name: /^approve/i }).first();
  if (await approve.count()) {
    await approve.click();
    await staff.waitForTimeout(1200);
    await shot(staff, "17-control-join-requests-approved-one");
  }
});
await step("invitations (Members Only)", async () => {
  const staff = await signedIn(browser, "pb2");
  await staff.goto(`${CLIENT}/control-panel/invites`);
  await staff
    .getByRole("heading", { name: /invitations/i })
    .first()
    .waitFor({ timeout: 30_000 });
  await staff.waitForTimeout(1500);
  await shot(staff, "18-control-invites");
  await staff.goto(`${CLIENT}/control-panel/settings`);
  await staff
    .getByText(/who can join/i)
    .first()
    .waitFor({ timeout: 30_000 });
  await shot(staff, "19-control-settings-who-can-join");
});
for (const [key, label] of [["pb2", "invite-only"], ["pb3", "request"]]) {
  await step(`sign up page of the ${label} server`, async () => {
    const anon = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
    await anon.goto(`${CLIENT}/signup`);
    await anon.getByPlaceholder(/chat\.example|server|name@/i).first().fill(`newcomer@${HOSTS[key]}`);
    await anon.waitForTimeout(3000);
    await shot(anon, `20-signup-${label}`);
  });
}

await browser.close();
console.log(results.join("\n"));
console.log(
  `\n${results.filter((r) => r.startsWith("PASS")).length}/${results.length} steps ok; screenshots in ${path.resolve(OUT)}`,
);
