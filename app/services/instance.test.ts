// @vitest-environment node
import { describe, expect, it } from "vitest";
import { normalizeInstance, resolveInstance, resolveStoredInstance } from "./instance";

describe("instance resolution", () => {
  it("defaults localhost-style inputs to http", () => {
    expect(resolveInstance("localhost:7575")).toMatchObject({
      origin: "http://localhost:7575",
      apiBaseUrl: "http://localhost:7575",
      wsBaseUrl: "ws://localhost:7575",
      secure: false,
    });
  });

  it("defaults named domains to https", () => {
    expect(resolveInstance("chat.pufferblow.social")).toMatchObject({
      origin: "https://chat.pufferblow.social",
      apiBaseUrl: "https://chat.pufferblow.social",
      wsBaseUrl: "wss://chat.pufferblow.social",
      secure: true,
    });
  });

  it("preserves explicit schemes", () => {
    expect(resolveInstance("https://pb.example.com:8443")).toMatchObject({
      origin: "https://pb.example.com:8443",
      wsBaseUrl: "wss://pb.example.com:8443",
      port: "8443",
      secure: true,
    });
    expect(resolveInstance("ws://127.0.0.1:9000")).toMatchObject({
      origin: "http://127.0.0.1:9000",
      wsBaseUrl: "ws://127.0.0.1:9000",
      secure: false,
    });
  });

  it("normalizes trailing slashes", () => {
    expect(normalizeInstance("https://pb.example.com/")).toBe("https://pb.example.com");
  });

  it("returns null for invalid stored instances", () => {
    expect(resolveStoredInstance("")).toBeNull();
    expect(resolveStoredInstance("://bad-instance")).toBeNull();
  });
});
