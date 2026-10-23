import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "./DatePicker";
import { LoadingState } from "./LoadingState";
import { Select } from "./Select";

function Chosen() {
  const [value, setValue] = useState("");
  return (
    <>
      <Select
        label="Action"
        value={value}
        onChange={setValue}
        options={[
          { value: "", label: "Any action" },
          { value: "ban", label: "Ban" },
          { value: "role", label: "Role created" },
        ]}
      />
      <output>{value || "none"}</output>
    </>
  );
}

describe("Select", () => {
  it("shows the current choice and opens a list of options", async () => {
    const user = userEvent.setup();
    render(<Chosen />);
    const box = screen.getByRole("combobox", { name: "Action" });
    expect(box).toHaveTextContent("Any action");
    expect(box).toHaveAttribute("aria-expanded", "false");

    await user.click(box);
    expect(box).toHaveAttribute("aria-expanded", "true");
    const list = screen.getByRole("listbox", { name: "Action" });
    expect(within(list).getAllByRole("option").map((o) => o.textContent)).toEqual(["Any action", "Ban", "Role created"]);
    expect(within(list).getByRole("option", { name: "Any action" })).toHaveAttribute("aria-selected", "true");
  });

  it("chooses with a click and closes", async () => {
    const user = userEvent.setup();
    render(<Chosen />);
    await user.click(screen.getByRole("combobox", { name: "Action" }));
    await user.click(screen.getByRole("option", { name: "Ban" }));
    expect(screen.getByRole("combobox", { name: "Action" })).toHaveTextContent("Ban");
    expect(screen.getByRole("status")).toHaveTextContent("ban");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("works from the keyboard: arrows move, Enter chooses, Escape closes", async () => {
    const user = userEvent.setup();
    render(<Chosen />);
    screen.getByRole("combobox", { name: "Action" }).focus();

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(screen.getByRole("status")).toHaveTextContent("ban");

    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("ban");
  });

  it("closes on a press outside", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Chosen />
        <button type="button">elsewhere</button>
      </>,
    );
    await user.click(screen.getByRole("combobox", { name: "Action" }));
    await user.click(screen.getByRole("button", { name: "elsewhere" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("DatePicker", () => {
  it("opens on the month it is told to and picks a day", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker label="From" value="" initialMonth="2030-01-15" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "From" })).toHaveTextContent("Any day");
    await user.click(screen.getByRole("button", { name: "From" }));
    expect(screen.getByRole("grid", { name: "January 2030" })).toBeInTheDocument();

    await user.click(screen.getByRole("gridcell", { name: "January 3, 2030" }));
    expect(onChange).toHaveBeenCalledWith("2030-01-03");
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });

  it("shows the chosen day, marks it, and moves between months", async () => {
    const user = userEvent.setup();
    render(<DatePicker label="From" value="2030-01-03" onChange={() => undefined} />);
    expect(screen.getByRole("button", { name: "From" })).toHaveTextContent("Jan 3, 2030");

    await user.click(screen.getByRole("button", { name: "From" }));
    expect(screen.getByRole("gridcell", { name: "January 3, 2030" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("button", { name: "Next month" }));
    expect(screen.getByRole("grid", { name: "February 2030" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    await user.click(screen.getByRole("button", { name: "Previous month" }));
    expect(screen.getByRole("grid", { name: "December 2029" })).toBeInTheDocument();
  });

  it("dims days outside min and max and will not choose them", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker label="To" value="" initialMonth="2030-01-15" min="2030-01-10" max="2030-01-20" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "To" }));

    expect(screen.getByRole("gridcell", { name: "January 9, 2030" })).toBeDisabled();
    expect(screen.getByRole("gridcell", { name: "January 21, 2030" })).toBeDisabled();
    expect(screen.getByRole("gridcell", { name: "January 10, 2030" })).toBeEnabled();
    await user.click(screen.getByRole("gridcell", { name: "January 9, 2030" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the day from the field or from the calendar", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<DatePicker label="From" value="2030-01-03" onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "Clear From" }));
    expect(onChange).toHaveBeenLastCalledWith("");

    await user.click(screen.getByRole("button", { name: "From" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe("LoadingState", () => {
  it("is placeholder shapes with the message kept for screen readers, not a spinner or the logo", () => {
    const { container } = render(<LoadingState message="Loading the audit log…" shape="table" />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(within(status).getByText("Loading the audit log…")).toHaveClass("sr-only");
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(4);
  });

  it.each(["list", "table", "form", "cards", "messages"] as const)("draws the %s shape", (shape) => {
    const { container } = render(<LoadingState shape={shape} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(2);
  });
});
