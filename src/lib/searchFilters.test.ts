import { describe, expect, it } from "vitest";
import { currentWord, dayRange, hasServerFilters, parseSearch, withFilter } from "./searchFilters";

describe("parseSearch", () => {
  it("takes the filters out and keeps the rest as the text", () => {
    const parsed = parseSearch("lunch from:ada has:image has:link mentions:@grace in:#general before:2026-03-31 after:2026-03-01 author:bot menu");
    expect(parsed).toMatchObject({ text: "lunch menu", from: "ada", mentions: "grace", inChannel: "general", has: ["image", "link"], before: "2026-03-31", after: "2026-03-01", author: "bot", problems: [] });
  });

  it("is case-insensitive about the key and the kind, and ignores a repeat", () => {
    expect(parseSearch("FROM:Ada Has:IMAGE has:image")).toMatchObject({ from: "Ada", has: ["image"] });
  });

  it("does not count a filter that has nothing after its colon yet", () => {
    expect(parseSearch("hello from:")).toMatchObject({ text: "hello", has: [] });
    expect(parseSearch("hello from:").from).toBeUndefined();
    expect(parseSearch("has:")).toMatchObject({ text: "", has: [] });
  });

  it("reports what cannot be used instead of guessing", () => {
    expect(parseSearch("has:gif before:soon after:2026-13-45 author:robot").problems).toEqual(["has:gif", "before:soon", "after:2026-13-45", "author:robot"]);
  });

  it("only reads a filter that starts a word", () => {
    const parsed = parseSearch("see https://x.test/from:me or typefrom:ada");
    expect(parsed.text).toBe("see https://x.test/from:me or typefrom:ada");
    expect(parsed.from).toBeUndefined();
  });
});

describe("dayRange", () => {
  it("passes before and after through, and turns during into the day around it", () => {
    expect(dayRange({ before: "2026-03-31", after: "2026-03-01" })).toEqual({ before: "2026-03-31", after: "2026-03-01" });
    expect(dayRange({ during: "2026-03-01" })).toEqual({ after: "2026-02-28", before: "2026-03-02" });
    expect(dayRange({})).toEqual({ after: undefined, before: undefined });
  });
});

describe("withFilter", () => {
  it("adds, replaces and removes one filter", () => {
    expect(withFilter("", "from", "ada")).toBe("from:ada");
    expect(withFilter("lunch", "has", "image")).toBe("lunch has:image");
    expect(withFilter("lunch from:ada has:image", "from", "grace")).toBe("lunch has:image from:grace");
    expect(withFilter("lunch from:ada", "from", "")).toBe("lunch");
  });
});

describe("currentWord", () => {
  it("says when the filter menu belongs (nothing typed yet) and when a value is being typed", () => {
    expect(currentWord("")).toMatchObject({ empty: true, key: null });
    expect(currentWord("lunch ")).toMatchObject({ empty: true, start: 6 });
    expect(currentWord("lunch from:a")).toMatchObject({ key: "from", partial: "a", start: 6, empty: false });
    expect(currentWord("has:")).toMatchObject({ key: "has", partial: "" });
    expect(currentWord("lunch")).toMatchObject({ key: null, partial: "lunch", empty: false });
    expect(currentWord("nope:x")).toMatchObject({ key: null });
  });
});

describe("hasServerFilters", () => {
  it("is true when anything is set", () => {
    expect(hasServerFilters({})).toBe(false);
    expect(hasServerFilters({ has: [] })).toBe(false);
    expect(hasServerFilters({ has: ["link"] })).toBe(true);
    expect(hasServerFilters({ authorType: "bot" })).toBe(true);
  });
});
