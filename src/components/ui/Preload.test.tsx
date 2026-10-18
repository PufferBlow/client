import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { PRELOAD_MS, PreloadGate } from "./Preload";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const app = <div>the app</div>;

describe("PreloadGate", () => {
  it("shows the start-up screen first and keeps the app unmounted", () => {
    render(<PreloadGate>{app}</PreloadGate>);
    expect(screen.getByTestId("preload")).toHaveTextContent("Checking for updates…");
    expect(screen.queryByText("the app")).not.toBeInTheDocument();
  });

  it("lasts three seconds, then fades and hands over to the app", async () => {
    expect(PRELOAD_MS).toBe(3000);
    render(<PreloadGate>{app}</PreloadGate>);

    await act(() => vi.advanceTimersByTimeAsync(2999));
    expect(screen.queryByText("the app")).not.toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(screen.getByTestId("preload")).toHaveStyle({ opacity: "0" }); // fading out

    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByText("the app")).toBeInTheDocument();
    expect(screen.queryByTestId("preload")).not.toBeInTheDocument();
  });

  it("waits for the check when it takes longer than the minimum", async () => {
    let finish: () => void = () => undefined;
    const check = () => new Promise<void>((resolve) => (finish = resolve));
    render(<PreloadGate check={check}>{app}</PreloadGate>);

    await act(() => vi.advanceTimersByTimeAsync(10_000));
    expect(screen.queryByText("the app")).not.toBeInTheDocument();

    finish();
    await act(() => vi.advanceTimersByTimeAsync(300));
    expect(screen.getByText("the app")).toBeInTheDocument();
  });

  it("does not hold the app back when the check fails", async () => {
    render(<PreloadGate check={() => Promise.reject(new Error("offline"))}>{app}</PreloadGate>);
    await act(() => vi.advanceTimersByTimeAsync(3300));
    expect(screen.getByText("the app")).toBeInTheDocument();
  });

  it("can be switched off", () => {
    render(<PreloadGate minMs={0}>{app}</PreloadGate>);
    expect(screen.getByText("the app")).toBeInTheDocument();
  });
});
