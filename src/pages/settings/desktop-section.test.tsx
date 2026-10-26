import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UpdateState } from "../../../electron/updates";
import { UpdateButton } from "../../features/desktop/UpdateButton";
import { DesktopSection } from "./DesktopSection";

function bridge(initial: UpdateState) {
  let push: (s: UpdateState) => void = () => {};
  const api = {
    desktop: {
      get: vi.fn(async () => ({ closeToTray: true, version: "1.0.0" })),
      set: vi.fn(async (patch: { closeToTray: boolean }) => patch),
      onChange: vi.fn(() => () => {}),
    },
    updates: {
      state: vi.fn(async () => initial),
      check: vi.fn(async () => {}),
      install: vi.fn(async () => true),
      onState: vi.fn((cb: (s: UpdateState) => void) => {
        push = cb;
        return () => {};
      }),
    },
  };
  Object.defineProperty(window, "electron", { value: api, configurable: true });
  return { api, push: (s: UpdateState) => act(() => push(s)) };
}

afterEach(() => Reflect.deleteProperty(window, "electron"));

describe("the desktop app's settings", () => {
  it("turns hiding to the tray off and on", async () => {
    const { api } = bridge({ status: "idle" });
    render(<DesktopSection />);
    const toggle = await screen.findByRole("switch");
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await userEvent.click(toggle);
    expect(api.desktop.set).toHaveBeenCalledWith({ closeToTray: false });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "false"));
  });

  it("shows the version, checks on request, and restarts into a downloaded update", async () => {
    const { api, push } = bridge({ status: "idle" });
    render(<DesktopSection />);
    expect(await screen.findByText(/Pufferblow 1\.0\.0/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Check for updates" }));
    expect(api.updates.check).toHaveBeenCalled();

    push({ status: "downloading", version: "1.1.0", percent: 40 });
    expect(await screen.findByText(/Downloading 1\.1\.0… 40%/)).toBeInTheDocument();

    push({ status: "ready", version: "1.1.0" });
    await userEvent.click(await screen.findByRole("button", { name: "Restart to update" }));
    expect(api.updates.install).toHaveBeenCalled();
  });

  it("offers the title bar button only once an update is ready", async () => {
    const { push } = bridge({ status: "idle" });
    render(<UpdateButton />);
    await act(async () => {});
    expect(screen.queryByRole("button")).toBeNull();
    push({ status: "ready", version: "1.1.0" });
    expect(await screen.findByRole("button", { name: /Update ready/ })).toBeInTheDocument();
  });
});
