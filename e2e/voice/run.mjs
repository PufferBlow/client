// Runs the voice end-to-end scenarios against a throwaway instance, media server and dev server.
//
//   npm run e2e:voice                      all scenarios
//   npm run e2e:voice -- dm-relay          one (by file name, without .mjs)
//
// It builds media-sfu, makes an isolated Pufferblow home in the OS temp folder (your real ~/.pufferblow
// is never read or written), starts the instance, the media server and Vite on their own ports, drives
// real Chromium windows, then stops everything. See README.md for what it needs installed.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, "../..");
const root = path.resolve(clientDir, "..");
const ports = {
  api: Number(process.env.E2E_API_PORT ?? 7600),
  sfu: Number(process.env.E2E_SFU_PORT ?? 8790),
  web: Number(process.env.E2E_WEB_PORT ?? 5199),
};
const python = process.env.E2E_PYTHON ?? "python";
const work = fs.mkdtempSync(path.join(os.tmpdir(), "pufferblow-voice-e2e-"));
const home = path.join(work, "home");
const exe = process.platform === "win32" ? ".exe" : "";
const children = [];

const log = (message) => console.log(`\n== ${message}`);

function stopAll() {
  for (const child of children.splice(0)) {
    try {
      if (process.platform === "win32")
        spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
      else process.kill(-child.pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
}
process.on("exit", stopAll);
process.on("SIGINT", () => process.exit(130));

function start(name, command, args, options = {}) {
  const out = fs.openSync(path.join(work, `${name}.log`), "w");
  const child = spawn(command, args, {
    stdio: ["ignore", out, out],
    detached: process.platform !== "win32",
    ...options,
  });
  child.on("error", (error) => console.log(`${name} failed to start: ${error.message}`));
  children.push(child);
  return child;
}

async function until(label, url, seconds = 60) {
  for (let i = 0; i < seconds; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${label} did not come up at ${url}. Logs are in ${work}`);
}

function sync(command, args, options) {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

async function main() {
  const wanted = process.argv.slice(2);
  const scenarios = fs
    .readdirSync(path.join(here, "scenarios"))
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => f.replace(/\.mjs$/, ""));
  const chosen = wanted.length ? wanted : scenarios;
  for (const name of chosen)
    if (!scenarios.includes(name))
      throw new Error(`No scenario "${name}". Have: ${scenarios.join(", ")}`);

  log("building media-sfu");
  const sfu = path.join(work, `sfu${exe}`);
  sync("go", ["build", "-o", sfu, "./cmd/server"], { cwd: path.join(root, "media-sfu") });

  log(`preparing an instance in ${home}`);
  sync(python, [path.join(here, "setup_instance.py"), home, String(ports.api), String(ports.sfu)], {
    cwd: path.join(root, "pufferblow"),
  });

  log("starting the instance, the media server and the dev server");
  start(
    "api",
    python,
    [path.join(here, "serve_instance.py"), home, String(ports.api), String(ports.sfu)],
    { cwd: path.join(root, "pufferblow") },
  );
  await until("the instance", `http://127.0.0.1:${ports.api}/healthz`);
  // Loopback only: a host with several adapters can nominate a pair between its own addresses that stalls after a few seconds (see README).
  start("sfu", sfu, ["-config", path.join(home, ".pufferblow", "config.toml")], {
    env: { ...process.env, MEDIA_SFU_LOOPBACK_ONLY: "1" },
  });
  await until("the media server", `http://127.0.0.1:${ports.sfu}/healthz`);
  start(
    "web",
    process.execPath,
    [
      path.join(clientDir, "node_modules", "vite", "bin", "vite.js"),
      "--port",
      String(ports.web),
      "--strictPort",
      "--host",
      "localhost",
    ],
    { cwd: clientDir },
  );
  await until("the dev server", `http://localhost:${ports.web}/`);

  const env = {
    ...process.env,
    E2E_CLIENT: `http://localhost:${ports.web}`,
    E2E_HOST: `127.0.0.1:${ports.api}`,
    E2E_IDS: path.join(home, "ids.json"),
  };
  const results = [];
  for (const name of chosen) {
    log(`scenario: ${name}`);
    const run = spawnSync(process.execPath, [path.join(here, "scenarios", `${name}.mjs`)], {
      env,
      encoding: "utf-8",
      cwd: clientDir,
      timeout: 10 * 60_000,
    });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    process.stdout.write(output);
    const passes = (output.match(/^PASS /gm) ?? []).length;
    const fails = (output.match(/^FAIL /gm) ?? []).length;
    results.push({ name, passes, fails, ok: run.status === 0 && fails === 0 });
  }

  log("summary");
  for (const r of results)
    console.log(`${r.ok ? "ok  " : "FAIL"}  ${r.name}: ${r.passes} passed, ${r.fails} failed`);
  console.log(`logs: ${work}`);
  return results.every((r) => r.ok) ? 0 : 1;
}

// The servers it started keep the process alive, so it stops them and exits explicitly.
main()
  .catch((error) => {
    console.error(error.message);
    return 1;
  })
  .then((code) => {
    stopAll();
    process.exit(code);
  });
