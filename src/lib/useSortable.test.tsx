import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { moved, useSortable } from "./useSortable";

function List({ ids }: { ids: string[] }) {
  const { ordered, itemProps } = useSortable(ids, "test_order");
  return (
    <ul>
      {ordered.map((id) => (
        <li key={id} tabIndex={0} {...itemProps(id)}>
          {id}
        </li>
      ))}
    </ul>
  );
}

const order = () => screen.getAllByRole("listitem").map((li) => li.textContent);
const transfer = () => ({ dataTransfer: { setData: () => undefined, effectAllowed: "" } });

beforeEach(() => localStorage.removeItem("test_order"));

describe("moved", () => {
  it("puts an item where another is and shifts the ones between", () => {
    expect(moved(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(moved(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
    expect(moved(["a", "b"], "a", "a")).toEqual(["a", "b"]);
    expect(moved(["a", "b"], "x", "a")).toEqual(["a", "b"]);
  });
});

describe("useSortable", () => {
  it("drags one item onto another and remembers the order", () => {
    const { unmount } = render(<List ids={["a", "b", "c"]} />);
    const [a, , c] = screen.getAllByRole("listitem");
    fireEvent.dragStart(a!, transfer());
    fireEvent.dragOver(c!, transfer());
    expect(c).toHaveAttribute("data-drop-target", "true");
    fireEvent.drop(c!, transfer());
    expect(order()).toEqual(["b", "c", "a"]);
    unmount();

    render(<List ids={["a", "b", "c"]} />);
    expect(order()).toEqual(["b", "c", "a"]);
  });

  it("moves the focused item with Alt and the arrow keys", () => {
    render(<List ids={["a", "b", "c"]} />);
    fireEvent.keyDown(screen.getByText("a"), { key: "ArrowDown", altKey: true });
    expect(order()).toEqual(["b", "a", "c"]);
    fireEvent.keyDown(screen.getByText("c"), { key: "ArrowUp", altKey: true });
    expect(order()).toEqual(["b", "c", "a"]);
    fireEvent.keyDown(screen.getByText("b"), { key: "ArrowUp", altKey: true }); // already first
    fireEvent.keyDown(screen.getByText("b"), { key: "ArrowDown" }); // not without Alt
    expect(order()).toEqual(["b", "c", "a"]);
  });

  it("puts new ids at the end and forgets ones that went", () => {
    localStorage.setItem("test_order", JSON.stringify(["c", "gone", "a"]));
    render(<List ids={["a", "b", "c"]} />);
    expect(order()).toEqual(["c", "a", "b"]);
  });

  it("cannot be dragged when there is only one", () => {
    render(<List ids={["only"]} />);
    expect(screen.getByRole("listitem")).toHaveAttribute("draggable", "false");
  });
});
