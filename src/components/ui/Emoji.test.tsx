import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Emoji, EmojiText } from "./Emoji";

describe("Emoji", () => {
  it("draws a Twemoji image that still reads as the emoji", () => {
    render(<Emoji char="🎉" />);
    const img = screen.getByAltText("🎉");
    expect(img.tagName).toBe("IMG");
    expect(img.getAttribute("src")).toBeTruthy();
    // Different emoji get different artwork.
    render(<Emoji char="👍" />);
    expect(screen.getByAltText("👍").getAttribute("src")).not.toBe(img.getAttribute("src"));
  });

  it("honours the size", () => {
    render(<Emoji char="👍" size={22} />);
    expect(screen.getByAltText("👍")).toHaveStyle({ width: "22px", height: "22px" });
  });

  it("falls back to the character when there is no artwork", () => {
    render(<Emoji char="sticker:abc" />);
    expect(screen.getByText("sticker:abc")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

describe("EmojiText", () => {
  it("renders plain text untouched", () => {
    const { container } = render(<p><EmojiText text="just words" /></p>);
    expect(container.querySelector("p")?.innerHTML).toBe("just words");
  });

  it("swaps emoji for images and keeps the words", () => {
    const { container } = render(<p><EmojiText text="nice 🎉 work 👩‍💻!" /></p>);
    expect(container.textContent).toBe("nice 🎉 work 👩‍💻!".replace(/🎉|👩‍💻/g, ""));
    expect(screen.getByAltText("🎉")).toBeInTheDocument();
    expect(screen.getByAltText("👩‍💻")).toBeInTheDocument();
  });
});
