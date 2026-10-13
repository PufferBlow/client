import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinkEmbed } from "./Embed";

describe("LinkEmbed", () => {
  it("shows the player straight away, loaded lazily, with nothing around it", () => {
    const { container } = render(<LinkEmbed url="https://youtu.be/dQw4w9WgXcQ" />);
    const frame = container.querySelector("iframe");
    expect(frame).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(frame).toHaveAttribute("loading", "lazy");
    expect(screen.queryByRole("link")).not.toBeInTheDocument(); // the message already shows the link
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(frame?.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  });

  it("shows a linked image directly", () => {
    const { container } = render(<LinkEmbed url="https://cdn.example/cat.png" />);
    expect(container.querySelector("img")).toHaveAttribute("referrerpolicy", "no-referrer");
  });

  it("renders nothing for an ordinary page", () => {
    const { container } = render(<LinkEmbed url="https://example.com/" />);
    expect(container).toBeEmptyDOMElement();
  });
});
