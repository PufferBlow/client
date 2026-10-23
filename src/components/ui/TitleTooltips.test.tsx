import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TitleTooltips } from "./TitleTooltips";

describe("TitleTooltips", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("replaces the native hint with the app's tooltip, after a short delay", () => {
    render(
      <>
        <TitleTooltips />
        <button type="button" title="Pinned messages">
          <svg aria-hidden="true" />
        </button>
      </>,
    );
    const button = screen.getByRole("button");
    fireEvent.pointerOver(button);
    // The browser's own hint must not also show, and the control keeps its name.
    expect(button).not.toHaveAttribute("title");
    expect(button).toHaveAccessibleName("Pinned messages");
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    act(() => void vi.advanceTimersByTime(500));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Pinned messages");

    fireEvent.pointerOut(button, { relatedTarget: document.body });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("hides on press and on Escape, and shows nothing for an empty title", () => {
    render(
      <>
        <TitleTooltips />
        <button type="button" title="Mute">Mute</button>
        <button type="button" title="">Blank</button>
      </>,
    );
    const [mute, blank] = screen.getAllByRole("button");
    fireEvent.pointerOver(mute!);
    act(() => void vi.advanceTimersByTime(500));
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.pointerOver(blank!);
    act(() => void vi.advanceTimersByTime(500));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
