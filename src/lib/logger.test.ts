import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { api } from "../services/api";
import { createLogger, getLogLevel, redact, redactText, setLogLevel } from "./logger";

describe("redaction", () => {
  it("masks tokens and passwords in URLs and text", () => {
    expect(redactText("http://h/ws?auth_token=abc123&protocol=1")).toBe("http://h/ws?auth_token=***&protocol=1");
    expect(redactText("/signin?username=ann&password=hunter2")).toBe("/signin?username=ann&password=***");
    expect(redactText("refresh_token: xyz")).toContain("***");
    expect(redactText("nothing secret here")).toBe("nothing secret here");
  });

  it("masks secret fields in objects, at any depth", () => {
    expect(redact({ user: "ann", auth_token: "t", nested: { Password: "p", ok: 1 } })).toEqual({
      user: "ann",
      auth_token: "***",
      nested: { Password: "***", ok: 1 },
    });
  });

  it("keeps errors readable and cuts very long strings", () => {
    expect(redact(new Error("bad token=abc"))).toEqual({ name: "Error", message: "bad token=***" });
    expect((redact("x".repeat(900)) as string).length).toBeLessThan(600);
  });
});

describe("logger", () => {
  // `restoreMocks` undoes spies after every test, so they are made fresh for each one.
  let spies: Record<"debug" | "info" | "warn" | "error", MockInstance>;

  beforeEach(() => {
    spies = {
      debug: vi.spyOn(console, "debug").mockImplementation(() => undefined),
      info: vi.spyOn(console, "info").mockImplementation(() => undefined),
      warn: vi.spyOn(console, "warn").mockImplementation(() => undefined),
      error: vi.spyOn(console, "error").mockImplementation(() => undefined),
    };
  });
  afterEach(() => {
    localStorage.clear();
    setLogLevel("silent");
  });

  it("is silent under test and prints nothing", () => {
    expect(getLogLevel()).toBe("silent");
    createLogger("t").error("boom");
    expect(spies.error).not.toHaveBeenCalled();
  });

  it("prints time, level, scope and message, then the data", () => {
    setLogLevel("debug");
    createLogger("net").warn("slow", { ms: 900 });
    const [format] = spies.warn.mock.calls[0] as unknown[];
    expect(format).toMatch(/^%c\d\d:\d\d:\d\d\.\d{3} %cWARN {1,2}%c\[net\]%c slow$/);
    expect(spies.warn.mock.calls[0]?.at(-1)).toEqual({ ms: 900 });
  });

  it("drops anything below the level and nests scopes", () => {
    setLogLevel("warn");
    const log = createLogger("a").child("b");
    log.info("quiet");
    log.warn("loud");
    expect(spies.info).not.toHaveBeenCalled();
    expect(String(spies.warn.mock.calls[0]?.[0])).toContain("[a:b]");
  });

  it("never prints a token that is part of a message or its data", () => {
    setLogLevel("debug");
    createLogger("t").info("GET /x?auth_token=SECRET", { auth_token: "SECRET", url: "/y?token=SECRET" });
    expect(JSON.stringify(spies.info.mock.calls)).not.toContain("SECRET");
  });
});

describe("network logging", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setLogLevel("silent");
  });

  it("logs each request and its answer without leaking the token, and warns on a 4xx", async () => {
    setLogLevel("debug");
    const debug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response("{}", { status: 200 }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ error_code: "auth.invalid" }), { status: 401 })),
    );

    await api.get("http://h/a", { query: { auth_token: "SECRET" } });
    await expect(api.get("http://h/b")).rejects.toThrow();

    const lines = debug.mock.calls.map((call) => String(call[0]));
    expect(lines.some((line) => line.includes("→ GET http://h/a?auth_token=***"))).toBe(true);
    expect(lines.some((line) => /← 200 GET http:\/\/h\/a/.test(line))).toBe(true);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/← 401 GET http:\/\/h\/b .*auth\.invalid/);
    expect(JSON.stringify([...debug.mock.calls, ...warn.mock.calls])).not.toContain("SECRET");
  });
});
