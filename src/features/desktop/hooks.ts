import { useCallback, useEffect, useState } from "react";
import type { DesktopSettings } from "../../../electron/desktopSettings";
import type { UpdateState } from "../../../electron/updates";

/** The state of the background updater, and the actions on it. Both are inert in a browser, where there is no desktop app. */
export function useUpdates() {
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    const bridge = window.electron?.updates;
    if (!bridge) return;
    let live = true;
    void bridge.state().then((s) => live && setState(s));
    const stop = bridge.onState((s) => live && setState(s));
    return () => {
      live = false;
      stop();
    };
  }, []);

  const check = useCallback(() => window.electron?.updates.check(), []);
  const install = useCallback(() => window.electron?.updates.install(), []);
  return { state, check, install };
}

/** The desktop app's own settings (the tray) and the version that is running; null until they load, and in a browser. */
export function useDesktopSettings() {
  const [settings, setSettings] = useState<(DesktopSettings & { version: string }) | null>(null);

  useEffect(() => {
    const bridge = window.electron?.desktop;
    if (!bridge) return;
    let live = true;
    void bridge.get().then((s) => live && setSettings(s));
    // The tray menu has the same switch, so a change there reaches this page too.
    const stop = bridge.onChange((s) => live && setSettings((prev) => (prev ? { ...prev, ...s } : prev)));
    return () => {
      live = false;
      stop();
    };
  }, []);

  const update = useCallback(async (patch: Partial<DesktopSettings>) => {
    const next = await window.electron?.desktop.set(patch);
    if (next) setSettings((prev) => (prev ? { ...prev, ...next } : prev));
  }, []);

  return { settings, update };
}
