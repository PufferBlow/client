import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { parseMarkdown } from "../../lib/markdown";
import { isEmojiOnly } from "../../lib/emoji";
import { Markdown } from "./Markdown";

const show = (text: string) => render(<Markdown blocks={parseMarkdown(text)} />);

describe("Markdown", () => {
  it("renders formatting as elements", () => {
    const { container } = show("**bold** *it* ~~gone~~ `code`");
    expect(container.querySelector("strong")).toHaveTextContent("bold");
    expect(container.querySelector("em")).toHaveTextContent("it");
    expect(container.querySelector("s")).toHaveTextContent("gone");
    expect(container.querySelector("code")).toHaveTextContent("code");
  });

  it("never turns message text into markup", () => {
    const { container } = show('<img src=x onerror="alert(1)"> **<b>hi</b>**');
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(container).toHaveTextContent('<img src=x onerror="alert(1)"> <b>hi</b>');
  });

  it("hides a spoiler until it is clicked", async () => {
    const user = userEvent.setup();
    show("the end: ||they win||");
    const spoiler = screen.getByRole("button", { name: "Spoiler, select to reveal" });
    expect(spoiler.firstElementChild).toHaveAttribute("aria-hidden", "true");

    await user.click(spoiler);
    expect(screen.queryByRole("button", { name: /spoiler/i })).not.toBeInTheDocument();
    expect(screen.getByText("they win")).toBeVisible();
  });

  it("reveals a spoiler from the keyboard", async () => {
    const user = userEvent.setup();
    show("||kbd||");
    screen.getByRole("button", { name: /spoiler/i }).focus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("button", { name: /spoiler/i })).not.toBeInTheDocument();
  });

  it("opens links in a new tab without a referrer", () => {
    show("[site](https://example.com) and https://b.org");
    const [masked, bare] = screen.getAllByRole("link");
    expect(masked).toHaveAttribute("href", "https://example.com/");
    expect(masked).toHaveAttribute("title", "https://example.com/");
    expect(masked).toHaveAttribute("target", "_blank");
    expect(masked).toHaveAttribute("rel", "noreferrer noopener");
    expect(bare).toHaveTextContent("https://b.org");
  });

  it("renders code blocks with their language and a copy button", () => {
    show("```py\nprint('hi')\n```");
    expect(screen.getByText("py")).toBeInTheDocument();
    expect(screen.getByText("print('hi')")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy code" })).toBeInTheDocument();
  });

  it("numbers the lines of a code block, outside the code itself", () => {
    const { container } = show("```py\na = 1\nb = 2\nc = 3\n```");
    const gutter = container.querySelector(".pb-code-gutter");
    expect(gutter).toHaveAttribute("aria-hidden", "true");
    expect(gutter?.textContent).toBe("1\n2\n3");
    expect(container.querySelector("code")?.textContent).toBe("a = 1\nb = 2\nc = 3");
  });

  it("highlights code in a named language once the highlighter loads", async () => {
    const { container } = show("```js\nconst answer = 42; // yes\n```");
    // The first load also transforms the grammars under test, which is slow.
    await waitFor(() => expect(container.querySelector(".hljs-keyword")).toHaveTextContent("const"), { timeout: 20_000 });
    expect(container.querySelector(".hljs-number")).toHaveTextContent("42");
    expect(container.querySelector(".hljs-comment")).toHaveTextContent("// yes");
    expect(container.querySelector("code")).toHaveTextContent("const answer = 42; // yes");
  }, 30_000);

  it("leaves an unknown language plain", async () => {
    const { container } = show("```notalanguage\nconst x = 1\n```");
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(container.querySelector("[class^='hljs']")).toBeNull();
    expect(container.querySelector("code")).toHaveTextContent("const x = 1");
  });

  it("puts the trailing marker at the end of the last paragraph", () => {
    const { container } = render(<Markdown blocks={parseMarkdown("a\n# b")} trailing={<span>(edited)</span>} />);
    expect(container.querySelector("h1")).toHaveTextContent("b(edited)");
  });
});

describe("isEmojiOnly", () => {
  it("is true for emoji and spaces only", () => {
    expect(isEmojiOnly("🎉 🎉")).toBe(true);
    expect(isEmojiOnly("party 🎉")).toBe(false);
    expect(isEmojiOnly("")).toBe(false);
    expect(isEmojiOnly("🎉".repeat(28))).toBe(false);
  });
});
