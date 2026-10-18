import { describe, expect, it } from "vitest";
import { parseInline, toPlainText } from "./markdown";
import {
  completeTypedShortcode,
  findShortcodeQuery,
  insertShortcode,
  matchShortcodes,
  replaceShortcodes,
  shortcodeAt,
  shortcodeEmoji,
} from "./shortcodes";

describe("shortcodeEmoji", () => {
  it("knows common names and aliases, ignoring case", () => {
    expect(shortcodeEmoji("tada")).toBe("🎉");
    expect(shortcodeEmoji("TADA")).toBe("🎉");
    expect(shortcodeEmoji("100")).toBe("💯");
    expect(shortcodeEmoji("+1")).toBe("👍");
    expect(shortcodeEmoji("thumbsup")).toBe("👍");
    expect(shortcodeEmoji("not_an_emoji")).toBeUndefined();
  });
});

describe("shortcodeAt", () => {
  it("reads a shortcode that stands alone", () => {
    expect(shortcodeAt(":tada:", 0)).toEqual({ length: 6, emoji: "🎉" });
    expect(shortcodeAt("go :tada:!", 3)).toEqual({ length: 6, emoji: "🎉" });
  });

  it("is not fooled by times, URLs or unknown names", () => {
    expect(shortcodeAt("10:30:45", 2)).toBeNull();
    expect(shortcodeAt("http://x:100:y", 8)).toBeNull();
    expect(shortcodeAt(":nope_nope:", 0)).toBeNull();
    expect(shortcodeAt("::tada:", 1)).toBeNull();
    expect(shortcodeAt(":tada:x", 0)).toBeNull();
  });
});

describe("replaceShortcodes", () => {
  it("writes each shortcode out as its emoji", () => {
    expect(replaceShortcodes("nice :tada: and :+1:")).toBe("nice 🎉 and 👍");
    expect(replaceShortcodes("see 10:30:45 and :unknown:")).toBe("see 10:30:45 and :unknown:");
  });

  it("leaves code alone", () => {
    expect(replaceShortcodes("`:tada:` is :tada:")).toBe("`:tada:` is 🎉");
    expect(replaceShortcodes("```\n:tada:\n```\n:tada:")).toBe("```\n:tada:\n```\n🎉");
  });
});

describe("shortcodes in the markdown parser", () => {
  it("renders as the emoji in text and formatting, but not in code", () => {
    expect(parseInline("hi :tada:")).toEqual([{ type: "text", value: "hi 🎉" }]);
    expect(parseInline("**:tada:**")).toEqual([{ type: "strong", children: [{ type: "text", value: "🎉" }] }]);
    expect(parseInline("`:tada:`")).toEqual([{ type: "code", value: ":tada:" }]);
    expect(toPlainText("party :tada:")).toBe("party 🎉");
  });
});

describe("finding the :word being typed", () => {
  it("needs two letters, a colon that starts a word, and the caret inside it", () => {
    expect(findShortcodeQuery("hi :ta", 6)).toEqual({ start: 3, query: "ta" });
    expect(findShortcodeQuery("hi :t", 5)).toBeNull();
    expect(findShortcodeQuery("a:ta", 4)).toBeNull();
    expect(findShortcodeQuery("hi :tada: there", 15)).toBeNull();
  });
});

describe("suggestions", () => {
  it("lists names that start with the text first, shorter first", () => {
    expect(matchShortcodes("tad")[0]!.name).toBe("tada");
  });

  it("is capped and empty for a too-short query", () => {
    expect(matchShortcodes("sm", 3)).toHaveLength(3);
    expect(matchShortcodes("s")).toEqual([]);
  });
});

describe("inserting and completing", () => {
  it("replaces the typed word with the emoji and a space", () => {
    expect(insertShortcode("hi :ta", { start: 3, query: "ta" }, 6, "🎉")).toEqual({ text: "hi 🎉 ", caret: 6 });
  });

  it("converts a shortcode when its closing colon is typed", () => {
    expect(completeTypedShortcode("hi :tada:", 9)).toEqual({ text: "hi 🎉", caret: 5 });
    expect(completeTypedShortcode("hi :nope:", 9)).toBeNull();
    expect(completeTypedShortcode("10:30:", 6)).toBeNull();
  });
});
