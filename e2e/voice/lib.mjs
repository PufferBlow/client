// Shared helpers for the voice end-to-end scenarios: real Chromium windows (with a fake microphone)
// against a real instance, media server and client dev server started by run.mjs.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

export const CLIENT = process.env.E2E_CLIENT ?? "http://localhost:5199";
export const HOST = process.env.E2E_HOST ?? "127.0.0.1:7600";
export const API = `http://${HOST}`;
export const PASSWORD = "12345678";

/** Where a Chromium that Playwright installed lives (`npx playwright-core install chromium`), unless overridden. */
export function findChromium() {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM;
  const roots = [
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    path.join(os.homedir(), "AppData", "Local", "ms-playwright"),
    path.join(os.homedir(), ".cache", "ms-playwright"),
    path.join(os.homedir(), "Library", "Caches", "ms-playwright"),
  ].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const folders = fs
      .readdirSync(root)
      .filter((name) => /^chromium-\d+$/.test(name))
      .sort()
      .reverse();
    for (const folder of folders) {
      for (const relative of [
        "chrome-win64/chrome.exe",
        "chrome-win/chrome.exe",
        "chrome-linux/chrome",
        "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
      ]) {
        const candidate = path.join(root, folder, relative);
        if (fs.existsSync(candidate)) return candidate;
      }
    }
  }
  throw new Error(
    "No Chromium found. Run `npx playwright-core install chromium`, or set E2E_CHROMIUM to a Chromium/Chrome executable.",
  );
}

export const launch = () =>
  chromium.launch({
    executablePath: findChromium(),
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--allow-loopback-in-peer-connection",
    ],
  });

let failures = 0;
/** One line per check, `PASS`/`FAIL`, which run.mjs counts. */
export function check(label, ok) {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  return ok;
}
export const failed = () => failures;

/** Waits for something to show and records it as a check; a timeout is a failed check, not a crash. */
export async function seen(label, wait) {
  try {
    await wait;
    return check(label, true);
  } catch {
    return check(label, false);
  }
}

/** A signed-in window. Every RTCPeerConnection it makes is kept in `window.__pcs`, so audio can be measured. */
export async function person(
  browser,
  name,
  { goto = "/dashboard/channels", forceRelay = false } = {},
) {
  const context = await browser.newContext({ permissions: ["microphone"] });
  if (forceRelay)
    await context.addInitScript(() => localStorage.setItem("pb_calls_force_relay", "1"));
  await context.addInitScript(() => {
    const Native = window.RTCPeerConnection;
    window.__pcs = [];
    window.RTCPeerConnection = function (...args) {
      const pc = new Native(...args);
      window.__pcs.push(pc);
      return pc;
    };
    window.RTCPeerConnection.prototype = Native.prototype;
    // Keep a note of every description's ICE credentials and DTLS role, to see what a renegotiation changes.
    window.__sdp = [];
    const note = (where, d) =>
      window.__sdp.push(`${Math.round(performance.now() / 1000)}s ${where} ${d?.type} ufrag=${/a=ice-ufrag:(\S+)/.exec(d?.sdp ?? "")?.[1]} setup=${[...(d?.sdp ?? "").matchAll(/a=setup:(\S+)/g)].map((m) => m[1]).join(",")} m=${(d?.sdp ?? "").match(/^m=/gm)?.length}`);
    for (const method of ["setLocalDescription", "setRemoteDescription"]) {
      const original = Native.prototype[method];
      Native.prototype[method] = function (d) {
        note(method === "setLocalDescription" ? "local" : "remote", d ?? undefined);
        return original.apply(this, arguments);
      };
    }
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log(`[${name}] console.error ${m.text().slice(0, 240)}`);
  });
  page.on("pageerror", (e) => console.log(`[${name}] pageerror ${e.message.slice(0, 240)}`));
  await page.goto(`${CLIENT}/login`);
  await page.getByPlaceholder("name@chat.example.com").fill(`${name}@${HOST}`);
  await page.getByPlaceholder("Enter your password").fill(PASSWORD);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
  await open(page, goto);
  return page;
}

/** Go to an app route and wait out the start-up screen. */
export async function open(page, route) {
  await page.goto(`${CLIENT}${route}`);
  await page.getByRole("button", { name: "Settings" }).waitFor({ timeout: 30_000 });
}

/** Audio the page's peer connections have sent and received, with how loud what arrived was. */
export const audio = (page) =>
  page.evaluate(async () => {
    const out = { in: { packets: 0, energy: 0 }, out: { packets: 0 }, states: [] };
    for (const pc of window.__pcs) {
      const report = await pc.getStats();
      report.forEach((s) => {
        if (s.type === "inbound-rtp" && s.kind === "audio") {
          out.in.packets += s.packetsReceived;
          out.in.energy += s.totalAudioEnergy ?? 0;
        }
        if (s.type === "outbound-rtp" && s.kind === "audio") out.out.packets += s.packetsSent;
      });
      out.states.push(pc.connectionState);
    }
    return out;
  });

export async function token(name) {
  const r = await fetch(`${API}/api/v1/users/signin?username=${name}&password=${PASSWORD}`);
  const body = await r.json();
  return body.auth_token ?? body.access_token;
}

/** A DM conversation exists once one message has been sent. */
export async function conversationBetween(from, to) {
  const r = await fetch(`${API}/api/v1/dms/send`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      auth_token: await token(from),
      peer: to,
      message: "hi",
      attachments: [],
    }),
  });
  return (await r.json()).result.conversation_id;
}

export const ids = () => JSON.parse(fs.readFileSync(process.env.E2E_IDS, "utf-8"));

/** Who the instance says is in a voice channel, with their mute state. */
export async function roster(channelId, as = "alice") {
  const r = await fetch(
    `${API}/api/v2/voice/channels/${channelId}/participants?auth_token=${await token(as)}`,
  );
  return (await r.json()).participants ?? [];
}

/** The safety number shown on a call, read from the dialog and closed again. */
export async function safetyNumber(page) {
  await page.getByRole("button", { name: /Show safety number/ }).click();
  const text = await page.getByLabel("Safety number", { exact: true }).innerText();
  await page.getByRole("button", { name: "Close" }).click();
  return text.replace(/\s+/g, " ");
}
