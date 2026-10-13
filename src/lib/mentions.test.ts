import { describe, expect, it } from "vitest";
import { parseInline, toPlainText } from "./markdown";
import { findMentionQuery, insertMention, matchMentionables, mentionAt, mentionsUser, type Mentionable } from "./mentions";

const person = (name: string): Mentionable => ({ id: `id-${name}`, name, avatarUrl: null });

describe("mentionAt", () => {
  it("reads a name after an @ at the start or after whitespace", () => {
    expect(mentionAt("@ann hi", 0)).toBe("ann");
    expect(mentionAt("hi @ann.", 3)).toBe("ann"); // the trailing dot is punctuation
    expect(mentionAt("hi @a_b-c.d", 3)).toBe("a_b-c.d");
  });

  it("is not fooled by email addresses or a bare @", () => {
    expect(mentionAt("ann@example.com", 3)).toBeNull();
    expect(mentionAt("hi @ there", 3)).toBeNull();
    expect(mentionAt("hi", 0)).toBeNull();
  });
});

describe("mentionsUser", () => {
  it("finds a mention of someone by name, ignoring case", () => {
    expect(mentionsUser("hey @Grace, look", "grace")).toBe(true);
    expect(mentionsUser("hey @graceful", "grace")).toBe(false);
    expect(mentionsUser("mail grace@home.example", "grace")).toBe(false);
  });
});

describe("mentions in the markdown parser", () => {
  it("makes a mention node and leaves the rest as text", () => {
    expect(parseInline("hi @ann!")).toEqual([
      { type: "text", value: "hi " },
      { type: "mention", name: "ann" },
      { type: "text", value: "!" },
    ]);
  });

  it("does not turn snake_case names into italics", () => {
    expect(parseInline("@a_b_c done")).toEqual([
      { type: "mention", name: "a_b_c" },
      { type: "text", value: " done" },
    ]);
  });

  it("finds a mention inside formatting, and keeps it in plain-text previews", () => {
    expect(parseInline("**@ann**")).toEqual([{ type: "strong", children: [{ type: "mention", name: "ann" }] }]);
    expect(toPlainText("hello @ann **there**")).toBe("hello @ann there");
  });

  it("leaves code alone", () => {
    expect(parseInline("`@ann`")).toEqual([{ type: "code", value: "@ann" }]);
  });
});

describe("finding the @word being typed", () => {
  it("finds the word the caret is in", () => {
    expect(findMentionQuery("hi @gr", 6)).toEqual({ start: 3, query: "gr" });
    expect(findMentionQuery("@", 1)).toEqual({ start: 0, query: "" });
    expect(findMentionQuery("hi @gr there", 6)).toEqual({ start: 3, query: "gr" });
  });

  it("finds nothing once the word has ended, or inside an email", () => {
    expect(findMentionQuery("hi @gr there", 12)).toBeNull();
    expect(findMentionQuery("ann@ex", 6)).toBeNull();
    expect(findMentionQuery("no mention", 4)).toBeNull();
  });
});

describe("suggestions", () => {
  const people = ["grace", "ada", "gregor", "angrily"].map(person);

  it("lists names that start with the text first, then ones that contain it", () => {
    expect(matchMentionables(people, "gr").map((p) => p.name)).toEqual(["grace", "gregor", "angrily"]);
  });

  it("lists everyone for an empty query, capped", () => {
    expect(matchMentionables(people, "", 2)).toHaveLength(2);
  });

  it("is case-insensitive", () => {
    expect(matchMentionables(people, "ADA").map((p) => p.name)).toEqual(["ada"]);
  });
});

describe("inserting a mention", () => {
  it("replaces the word with the name and a space, and puts the caret after it", () => {
    const query = { start: 3, query: "gr" };
    expect(insertMention("hi @gr", query, 6, "grace")).toEqual({ text: "hi @grace ", caret: 10 });
  });

  it("does not add a second space when one follows", () => {
    expect(insertMention("hi @gr there", { start: 3, query: "gr" }, 6, "grace")).toEqual({ text: "hi @grace there", caret: 10 });
  });
});
