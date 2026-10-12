import { describe, expect, it } from "vitest";
import { gradientFor, initialsFor } from "./avatar";

describe("gradientFor", () => {
  it("is stable for the same seed", () => {
    expect(gradientFor("user-1")).toBe(gradientFor("user-1"));
  });

  it("returns a CSS gradient", () => {
    expect(gradientFor("anything")).toMatch(/^linear-gradient\(135deg, #[0-9a-f]{6}, #[0-9a-f]{6}\)$/);
  });

  it("spreads different seeds across several gradients", () => {
    const seeds = Array.from({ length: 40 }, (_, i) => `user-${i}`);
    expect(new Set(seeds.map(gradientFor)).size).toBeGreaterThan(3);
  });

  it("handles an empty seed", () => {
    expect(gradientFor("")).toContain("linear-gradient");
  });
});

describe("initialsFor", () => {
  it.each([
    ["ada", "A"],
    ["Ada Lovelace", "AL"],
    ["kate wolf", "KW"],
    ["one two three", "OT"],
    ["  spaced   out  ", "SO"],
  ])("derives %j -> %s", (name, initials) => {
    expect(initialsFor(name)).toBe(initials);
  });

  it("falls back for an empty name", () => {
    expect(initialsFor("")).toBe("?");
  });
});
