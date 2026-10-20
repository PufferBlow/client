import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";
import { HostPill } from "./HostPill";
import { RoleTag } from "./RoleTag";
import { Tooltip } from "./Tooltip";

describe("design primitives", () => {
  it("describes a tooltip's trigger with its label", () => {
    render(
      <Tooltip label="Night Shift · kiln.social">
        <button>trigger</button>
      </Tooltip>,
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("Night Shift · kiln.social");
    expect(screen.getByText("trigger").parentElement).toHaveAttribute("aria-describedby", screen.getByRole("tooltip").id);
  });

  it("shows a remote host with its @, and marks the unverified and blocked ones", () => {
    const { rerender } = render(<HostPill host="mesh.garden" />);
    expect(screen.getByText("@mesh.garden")).toBeInTheDocument();
    rerender(<HostPill host="fogbank.net" state="unverified" />);
    expect(screen.getByText("@fogbank.net")).toHaveAttribute("title", "This instance has not been verified");
    rerender(<HostPill host="junk.zone" state="blocked" />);
    expect(screen.getByText("@junk.zone").className).toContain("line-through");
  });

  it("colours a role tag from its identity colour", () => {
    render(<RoleTag name="Spirit" colour="#a99cf2" />);
    expect(screen.getByText("Spirit").getAttribute("style")).toContain("--role-colour: #a99cf2");
  });

  it("shows a sleepy fish in an empty state unless given another icon", () => {
    const { container, rerender } = render(<EmptyState title="Nothing here yet" description="No one has posted." />);
    expect(container.querySelector("img")!.getAttribute("src")).toMatch(/sleepy-ink/);
    rerender(<EmptyState title="Nothing" icon={<svg data-testid="own" />} />);
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("own")).toBeInTheDocument();
  });

  it("keeps a disabled button from being clicked and labels its variants", () => {
    render(
      <Button variant="danger" disabled>
        Leave
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Leave" })).toBeDisabled();
  });
});
