import { describe, expect, it } from "vitest";
import { embeddableUrls, parseInline, parseMarkdown, safeUrl, type Inline } from "./markdown";

const text = (value: string): Inline => ({ type: "text", value });

describe("parseInline", () => {
  it("leaves plain text alone", () => {
    expect(parseInline("just words")).toEqual([text("just words")]);
  });

  it("reads bold, italics, underline, strikethrough and spoilers", () => {
    expect(parseInline("**b** *i* _i_ __u__ ~~s~~ ||x||")).toEqual([
      { type: "strong", children: [text("b")] },
      text(" "),
      { type: "em", children: [text("i")] },
      text(" "),
      { type: "em", children: [text("i")] },
      text(" "),
      { type: "underline", children: [text("u")] },
      text(" "),
      { type: "strike", children: [text("s")] },
      text(" "),
      { type: "spoiler", children: [text("x")] },
    ]);
  });

  it("nests, including ***bold italics***", () => {
    expect(parseInline("***both***")).toEqual([{ type: "strong", children: [{ type: "em", children: [text("both")] }] }]);
    expect(parseInline("*a **b** c*")).toEqual([
      { type: "em", children: [text("a "), { type: "strong", children: [text("b")] }, text(" c")] },
    ]);
    expect(parseInline("||**secret**||")).toEqual([{ type: "spoiler", children: [{ type: "strong", children: [text("secret")] }] }]);
  });

  it("does not italicise arithmetic or snake_case", () => {
    expect(parseInline("2 * 3 * 4")).toEqual([text("2 * 3 * 4")]);
    expect(parseInline("snake_case_name")).toEqual([text("snake_case_name")]);
  });

  it("keeps unclosed markers literal", () => {
    expect(parseInline("**open and ~~never ||closed")).toEqual([text("**open and ~~never ||closed")]);
  });

  it("treats inline code as literal, formatting markers included", () => {
    expect(parseInline("run `**not bold**` now")).toEqual([text("run "), { type: "code", value: "**not bold**" }, text(" now")]);
    expect(parseInline("``has ` inside``")).toEqual([{ type: "code", value: "has ` inside" }]);
  });

  it("does not close a pair across a code span", () => {
    expect(parseInline("*a `*` b*")).toEqual([{ type: "em", children: [text("a "), { type: "code", value: "*" }, text(" b")] }]);
  });

  it("honours backslash escapes", () => {
    expect(parseInline("\\*not italic\\*")).toEqual([text("*not italic*")]);
  });

  it("links bare URLs, without trailing punctuation, and marks them embeddable", () => {
    expect(parseInline("see https://example.com/a_(b). ok")).toEqual([
      text("see "),
      { type: "link", href: "https://example.com/a_(b)", embed: true, children: [text("https://example.com/a_(b)")] },
      text(". ok"),
    ]);
  });

  it("links masked and angle-bracketed URLs without embedding them", () => {
    expect(parseInline("[docs](https://example.com) <https://x.org>")).toEqual([
      { type: "link", href: "https://example.com/", embed: false, children: [text("docs")] },
      text(" "),
      { type: "link", href: "https://x.org/", embed: false, children: [text("https://x.org")] },
    ]);
  });

  it("refuses non-http links", () => {
    expect(parseInline("[x](javascript:alert(1))")).toEqual([text("[x](javascript:alert(1))")]);
    expect(safeUrl("data:text/html,hi")).toBeNull();
  });

  it("does not link a URL glued to a word", () => {
    expect(parseInline("xhttps://a.com")).toEqual([text("xhttps://a.com")]);
  });
});

describe("parseMarkdown", () => {
  it("keeps line breaks inside a paragraph", () => {
    expect(parseMarkdown("one\ntwo\n\nthree")).toEqual([{ type: "paragraph", children: [text("one\ntwo\n\nthree")] }]);
  });

  it("reads fenced code blocks with and without a language", () => {
    expect(parseMarkdown("before\n```ts\nconst a = 1;\n```\nafter")).toEqual([
      { type: "paragraph", children: [text("before")] },
      { type: "codeblock", lang: "ts", value: "const a = 1;" },
      { type: "paragraph", children: [text("after")] },
    ]);
    expect(parseMarkdown("```**raw**```")).toEqual([{ type: "codeblock", lang: null, value: "**raw**" }]);
  });

  it("reads headings, subtext, quotes and lists", () => {
    expect(parseMarkdown("# Title\n-# small\n> quoted\n> more\n- a\n- b\n3. c\n4. d")).toEqual([
      { type: "heading", level: 1, children: [text("Title")] },
      { type: "subtext", children: [text("small")] },
      { type: "quote", children: [{ type: "paragraph", children: [text("quoted\nmore")] }] },
      { type: "list", ordered: false, start: 1, items: [[text("a")], [text("b")]] },
      { type: "list", ordered: true, start: 3, items: [[text("c")], [text("d")]] },
    ]);
  });

  it("quotes the rest of the message after >>>", () => {
    expect(parseMarkdown("hi\n>>> all\nof this")).toEqual([
      { type: "paragraph", children: [text("hi")] },
      { type: "quote", children: [{ type: "paragraph", children: [text("all\nof this")] }] },
    ]);
  });

  it("does not treat #hashtags as headings", () => {
    expect(parseMarkdown("#general is busy")).toEqual([{ type: "paragraph", children: [text("#general is busy")] }]);
  });
});

describe("embeddableUrls", () => {
  it("lists bare links once, skipping masked, angled and spoilered ones", () => {
    const blocks = parseMarkdown(
      "https://a.com https://a.com [m](https://m.com) <https://n.com> ||https://s.com||\n> https://q.com\n```https://code.com```",
    );
    expect(embeddableUrls(blocks)).toEqual(["https://a.com/", "https://q.com/"]);
  });

  it("stops at the limit", () => {
    expect(embeddableUrls(parseMarkdown("https://1.com https://2.com https://3.com"), 2)).toHaveLength(2);
  });
});
