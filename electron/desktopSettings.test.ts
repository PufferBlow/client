import { describe, expect, it } from "vitest";
import { DesktopSettingsStore, parseSettings } from "./desktopSettings";

describe("desktop settings", () => {
  it("hides to the tray by default, and falls back to that for a missing or damaged file", () => {
    expect(parseSettings(null).closeToTray).toBe(true);
    expect(parseSettings("not json").closeToTray).toBe(true);
    expect(parseSettings('{"closeToTray":"no"}').closeToTray).toBe(true);
    expect(parseSettings("null").closeToTray).toBe(true);
    expect(parseSettings('{"closeToTray":false}').closeToTray).toBe(false);
  });

  it("saves a change and ignores anything that is not a setting", () => {
    let file: string | null = null;
    const store = new DesktopSettingsStore({ read: () => file, write: (text) => (file = text) });
    expect(store.set({ closeToTray: false }).closeToTray).toBe(false);
    expect(parseSettings(file).closeToTray).toBe(false);
    expect(store.set({ closeToTray: "yes" }).closeToTray).toBe(false);
    expect(store.set(null).closeToTray).toBe(false);
  });

  it("keeps the choice for this run when the file cannot be written", () => {
    const store = new DesktopSettingsStore({
      read: () => null,
      write: () => {
        throw new Error("read-only");
      },
    });
    expect(store.set({ closeToTray: false }).closeToTray).toBe(false);
  });
});
