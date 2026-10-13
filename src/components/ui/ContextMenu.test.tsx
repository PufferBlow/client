import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextMenu, type MenuEntry } from "./ContextMenu";
import { clampToViewport } from "./menuPosition";

afterEach(() => vi.restoreAllMocks());

const viewport = { width: 1000, height: 800 };
const size = { width: 200, height: 300 };

describe("clampToViewport", () => {
  it("keeps the pointer position when the menu fits", () => {
    expect(clampToViewport({ x: 100, y: 120 }, size, viewport)).toEqual({ left: 100, top: 120 });
  });

  it("moves left when it would overflow the right edge", () => {
    expect(clampToViewport({ x: 950, y: 100 }, size, viewport)).toEqual({ left: 792, top: 100 });
  });

  it("moves up when it would overflow the bottom edge", () => {
    expect(clampToViewport({ x: 100, y: 700 }, size, viewport)).toEqual({ left: 100, top: 492 });
  });

  it("handles both edges at once", () => {
    expect(clampToViewport({ x: 999, y: 799 }, size, viewport)).toEqual({ left: 792, top: 492 });
  });

  it("never leaves the top or left edge, even in a viewport smaller than the menu", () => {
    expect(clampToViewport({ x: -50, y: -50 }, size, viewport)).toEqual({ left: 8, top: 8 });
    expect(clampToViewport({ x: 20, y: 20 }, size, { width: 150, height: 150 })).toEqual({ left: 8, top: 8 });
  });
});

const entries = (overrides: { onCopy?: () => void; onDelete?: () => void } = {}): MenuEntry[] => [
  { kind: "item", id: "copy", label: "Copy text", onSelect: overrides.onCopy ?? vi.fn() },
  { kind: "item", id: "off", label: "Unavailable", onSelect: vi.fn(), disabled: true },
  { kind: "separator", id: "sep" },
  { kind: "item", id: "delete", label: "Delete", onSelect: overrides.onDelete ?? vi.fn(), danger: true },
];

describe("ContextMenu", () => {
  it("renders an accessible menu at the given point", () => {
    render(<ContextMenu x={120} y={80} label="Message actions" entries={entries()} onClose={vi.fn()} />);
    const menu = screen.getByRole("menu", { name: "Message actions" });
    expect(menu).toHaveStyle({ left: "120px", top: "80px" });
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("keeps itself inside the viewport", () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ width: 220, height: 180 } as DOMRect);
    Object.defineProperty(window, "innerWidth", { value: 1000, configurable: true });
    Object.defineProperty(window, "innerHeight", { value: 600, configurable: true });

    render(<ContextMenu x={990} y={590} label="Message actions" entries={entries()} onClose={vi.fn()} />);
    expect(screen.getByRole("menu")).toHaveStyle({ left: "772px", top: "412px", visibility: "visible" });
  });

  it("focuses the first available action on open", () => {
    render(<ContextMenu x={0} y={0} label="m" entries={entries()} onClose={vi.fn()} />);
    expect(screen.getByRole("menuitem", { name: "Copy text" })).toHaveFocus();
  });

  it("closes on Escape", async () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} label="m" entries={entries()} onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on a click outside, but not inside", () => {
    const onClose = vi.fn();
    render(
      <div>
        <button>outside</button>
        <ContextMenu x={0} y={0} label="m" entries={entries()} onClose={onClose} />
      </div>,
    );
    fireEvent.pointerDown(screen.getByRole("menu"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText("outside"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes when anything scrolls, resizes or loses the window", () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="list" />
        <ContextMenu x={0} y={0} label="m" entries={entries()} onClose={onClose} />
      </div>,
    );
    fireEvent.scroll(screen.getByTestId("list"));
    fireEvent(window, new Event("resize"));
    fireEvent(window, new Event("blur"));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it("closes on Tab", async () => {
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} label="m" entries={entries()} onClose={onClose} />);
    await userEvent.tab();
    expect(onClose).toHaveBeenCalled();
  });

  it("moves with the arrow keys, skipping disabled items and wrapping", async () => {
    render(<ContextMenu x={0} y={0} label="m" entries={entries()} onClose={vi.fn()} />);
    const copy = screen.getByRole("menuitem", { name: "Copy text" });
    const del = screen.getByRole("menuitem", { name: "Delete" });

    await userEvent.keyboard("{ArrowDown}");
    expect(del).toHaveFocus(); // "Unavailable" was skipped
    await userEvent.keyboard("{ArrowDown}");
    expect(copy).toHaveFocus(); // wrapped
    await userEvent.keyboard("{ArrowUp}");
    expect(del).toHaveFocus();
    await userEvent.keyboard("{Home}");
    expect(copy).toHaveFocus();
    await userEvent.keyboard("{End}");
    expect(del).toHaveFocus();
  });

  it("activates the focused item with Enter or Space, then closes", async () => {
    const onCopy = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    render(<ContextMenu x={0} y={0} label="m" entries={entries({ onCopy, onDelete })} onClose={onClose} />);

    await userEvent.keyboard("{Enter}");
    expect(onCopy).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{ArrowDown}{ }");
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does nothing when a disabled item is clicked", async () => {
    const onClose = vi.fn();
    const onSelect = vi.fn();
    render(
      <ContextMenu x={0} y={0} label="m" entries={[{ kind: "item", id: "a", label: "Nope", onSelect, disabled: true }, { kind: "item", id: "b", label: "Yes", onSelect: vi.fn() }]} onClose={onClose} />,
    );
    await userEvent.click(screen.getByRole("menuitem", { name: "Nope" }));
    expect(onSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("renders a row of choices and selects one", async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    render(
      <ContextMenu
        x={0}
        y={0}
        label="m"
        onClose={onClose}
        entries={[{ kind: "choices", id: "r", label: "Add reaction", choices: [{ id: "up", label: "Add 👍 reaction", content: "👍", onSelect: onPick }] }]}
      />,
    );
    // Announced as the group's name, not printed next to the emoji.
    expect(screen.getByRole("group", { name: "Add reaction" })).toBeInTheDocument();
    expect(screen.queryByText("Add reaction")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("menuitem", { name: "Add 👍 reaction" }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns focus to where it was when it closes", () => {
    const ui = (open: boolean) => (
      <div>
        <button>opener</button>
        {open && <ContextMenu x={0} y={0} label="m" entries={entries()} onClose={vi.fn()} />}
      </div>
    );
    const { rerender } = render(ui(false));
    screen.getByText("opener").focus();

    rerender(ui(true));
    expect(screen.getByRole("menuitem", { name: "Copy text" })).toHaveFocus();
    rerender(ui(false));
    expect(screen.getByText("opener")).toHaveFocus();
  });

  it("removes its document listeners on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<ContextMenu x={0} y={0} label="m" entries={entries()} onClose={vi.fn()} />);
    unmount();
    const removed = removeSpy.mock.calls.map(([type]) => type);
    for (const type of ["pointerdown", "scroll", "keydown"]) expect(removed).toContain(type);
  });

  it("blocks the browser menu on itself", () => {
    render(<ContextMenu x={0} y={0} label="m" entries={entries()} onClose={vi.fn()} />);
    const allowed = fireEvent.contextMenu(screen.getByRole("menu"));
    expect(allowed).toBe(false);
  });
});
