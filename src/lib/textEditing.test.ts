import { describe, expect, it } from "vitest";
import { fits, toggleWrap } from "./textEditing";

const apply = (value: string, start: number, end: number, marker: string) => {
  const edit = toggleWrap(value, start, end, marker);
  const text = value.slice(0, edit.from) + edit.insert + value.slice(edit.to);
  return { text, selected: text.slice(edit.selectionStart, edit.selectionEnd) };
};

describe("toggleWrap", () => {
  it("wraps the selection and keeps it selected", () => {
    expect(apply("make bold now", 5, 9, "**")).toEqual({ text: "make **bold** now", selected: "bold" });
  });

  it("unwraps when the markers sit just outside the selection", () => {
    expect(apply("make **bold** now", 7, 11, "**")).toEqual({ text: "make bold now", selected: "bold" });
  });

  it("unwraps when the markers are selected too", () => {
    expect(apply("make **bold** now", 5, 13, "**")).toEqual({ text: "make bold now", selected: "bold" });
  });

  it("leaves the caret between the markers when nothing is selected", () => {
    const edit = toggleWrap("ab", 1, 1, "__");
    expect(edit).toEqual({ from: 1, to: 1, insert: "____", selectionStart: 3, selectionEnd: 3 });
  });
});

describe("fits", () => {
  it("checks the result against the length limit", () => {
    const edit = toggleWrap("abc", 0, 3, "**");
    expect(fits("abc", edit, 7)).toBe(true);
    expect(fits("abc", edit, 6)).toBe(false);
    expect(fits("abc", edit)).toBe(true);
  });
});
