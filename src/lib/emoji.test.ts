import { describe, expect, it } from "vitest";
import { emojiFileName, splitEmoji } from "./emoji";
import { emojiUrl } from "./twemoji";

const emojiOf = (text: string) => splitEmoji(text).filter((s) => s.kind === "emoji").map((s) => s.value);

describe("splitEmoji", () => {
  it("leaves plain text as one run", () => {
    expect(splitEmoji("hello there")).toEqual([{ kind: "text", value: "hello there" }]);
    expect(splitEmoji("")).toEqual([]);
  });

  it("splits text around emoji and keeps the order", () => {
    expect(splitEmoji("hi 👍 there")).toEqual([
      { kind: "text", value: "hi " },
      { kind: "emoji", value: "👍" },
      { kind: "text", value: " there" },
    ]);
  });

  it("treats a joined sequence as one emoji", () => {
    expect(emojiOf("👩‍💻")).toEqual(["👩‍💻"]);
    expect(emojiOf("👨‍👩‍👧‍👦")).toEqual(["👨‍👩‍👧‍👦"]);
  });

  it("keeps skin tones, variation selectors, flags and keycaps together", () => {
    expect(emojiOf("👍🏽")).toEqual(["👍🏽"]);
    expect(emojiOf("❤️")).toEqual(["❤️"]);
    expect(emojiOf("🇫🇷")).toEqual(["🇫🇷"]);
    expect(emojiOf("1️⃣")).toEqual(["1️⃣"]);
  });

  it("separates adjacent emoji", () => {
    expect(emojiOf("😂😂🎉")).toEqual(["😂", "😂", "🎉"]);
  });

  it("does not turn ordinary symbols and digits into emoji", () => {
    expect(emojiOf("© 2030 ™ #1 *bold* 123")).toEqual([]);
  });
});

describe("emojiFileName", () => {
  it("uses the lowercase hex codepoint", () => {
    expect(emojiFileName("👍")).toBe("1f44d");
    expect(emojiFileName("🎉")).toBe("1f389");
  });

  it("drops the variation selector unless the emoji is a joined sequence", () => {
    expect(emojiFileName("❤️")).toBe("2764");
    expect(emojiFileName("👩‍💻")).toBe("1f469-200d-1f4bb");
    expect(emojiFileName("🏳️‍🌈")).toBe("1f3f3-fe0f-200d-1f308");
  });

  it("names flags and keycaps", () => {
    expect(emojiFileName("🇫🇷")).toBe("1f1eb-1f1f7");
    expect(emojiFileName("1️⃣")).toBe("31-20e3");
  });
});

describe("emojiUrl", () => {
  it("finds bundled artwork for common emoji, including sequences", () => {
    for (const emoji of ["👍", "❤️", "😂", "🎉", "👩‍💻", "🇫🇷", "🏳️‍🌈", "1️⃣", "👍🏽"]) {
      expect(emojiUrl(emoji), emoji).toBeTruthy();
    }
  });

  it("returns nothing for text", () => {
    expect(emojiUrl("x")).toBeUndefined();
    expect(emojiUrl("sticker:abc")).toBeUndefined();
  });
});
