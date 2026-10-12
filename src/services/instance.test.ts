import { describe, expect, it } from "vitest";
import { clearStoredInstance, getApiUrl, getStoredInstance, getWebSocketUrl, resolveInstance, setStoredInstance } from "./instance";

describe("resolveInstance", () => {
  it.each([
    ["localhost", "http://localhost:7575"],
    ["localhost:7575", "http://localhost:7575"],
    ["127.0.0.1", "http://127.0.0.1:7575"],
    ["192.168.1.5:9000", "http://192.168.1.5:9000"],
    ["chat.local", "http://chat.local:7575"],
    ["pufferblow.internal:8080", "http://pufferblow.internal:8080"],
    ["chat.example.com", "https://chat.example.com"],
    ["chat.example.com:8443", "https://chat.example.com:8443"],
  ])("infers the scheme and port for %s", (input, origin) => {
    expect(resolveInstance(input).origin).toBe(origin);
  });

  it.each([
    ["https://x.io:8443/", "https://x.io:8443"],
    ["http://a.b", "http://a.b"],
    ["wss://chat.example.com", "https://chat.example.com"],
    ["ws://192.168.1.5", "http://192.168.1.5"],
  ])("keeps an explicit scheme (%s)", (input, origin) => {
    expect(resolveInstance(input).origin).toBe(origin);
  });

  it("describes the instance", () => {
    expect(resolveInstance("https://chat.example.com")).toEqual({
      raw: "chat.example.com",
      host: "chat.example.com",
      port: 443,
      protocol: "https",
      origin: "https://chat.example.com",
    });
  });

  it("trims whitespace and trailing slashes", () => {
    expect(resolveInstance("  chat.example.com///  ").origin).toBe("https://chat.example.com");
  });

  it.each(["", "   "])("rejects an empty address (%j)", (input) => {
    expect(() => resolveInstance(input)).toThrow("Missing instance address");
  });

  it("rejects input that is not a valid address", () => {
    expect(() => resolveInstance("http://")).toThrow();
  });
});

describe("derived URLs", () => {
  it("returns the origin as the API URL", () => {
    expect(getApiUrl(resolveInstance("localhost"))).toBe("http://localhost:7575");
  });

  it("swaps the scheme for the websocket URL", () => {
    expect(getWebSocketUrl(resolveInstance("localhost"))).toBe("ws://localhost:7575");
    expect(getWebSocketUrl(resolveInstance("chat.example.com"))).toBe("wss://chat.example.com");
  });
});

describe("stored instance", () => {
  it("round-trips through localStorage", () => {
    const instance = resolveInstance("localhost");
    setStoredInstance(instance);
    expect(getStoredInstance()).toEqual(instance);
    clearStoredInstance();
    expect(getStoredInstance()).toBeNull();
  });

  it("ignores corrupt or legacy entries", () => {
    localStorage.setItem("pb_instance", "{not json");
    expect(getStoredInstance()).toBeNull();

    localStorage.setItem("pb_instance", JSON.stringify({ raw: "localhost:7575", host: "localhost", port: 7575, protocol: "http" }));
    expect(getStoredInstance()).toBeNull(); // no `origin`: written by an older client
  });
});
