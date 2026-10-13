import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LinkEmbed } from "./Embed";

describe("LinkEmbed", () => {
  it("only loads the player once it is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<LinkEmbed url="https://youtu.be/dQw4w9WgXcQ" />);
    expect(container.querySelector("iframe")).toBeNull();
    expect(screen.getByText("Click to load YouTube")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument(); // the message already shows the link

    await user.click(screen.getByRole("button", { name: "Load YouTube player" }));
    const frame = container.querySelector("iframe");
    expect(frame).toHaveAttribute("src", "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1");
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
