import { Button } from "@pufferblow/spines";
import { Switch } from "../../components/auth/AuthFields";
import { SettingsCard } from "../../components/settings/SettingsParts";
import { useDesktopSettings, useUpdates } from "../../features/desktop/hooks";
import type { UpdateState } from "../../../electron/updates";

function describe(state: UpdateState | null): string {
  if (!state) return "Checking…";
  switch (state.status) {
    case "unsupported":
      return state.reason;
    case "checking":
      return "Looking for updates…";
    case "downloading":
      return `Downloading ${state.version}… ${state.percent}%`;
    case "ready":
      return `${state.version} is ready. Restart to use it, or it installs the next time you quit.`;
    case "error":
      return `Couldn't check for updates: ${state.message}`;
    case "idle":
      return state.checkedAt ? `You're up to date. Checked at ${new Date(state.checkedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` : "You're up to date.";
  }
}

/** The desktop app's own settings: what the close button does, and updates. Only offered in the desktop app. */
export function DesktopSection() {
  const { settings, update } = useDesktopSettings();
  const { state, check, install } = useUpdates();
  const busy = state?.status === "checking" || state?.status === "downloading";

  return (
    <>
      <SettingsCard title="Tray" description="Pufferblow keeps a tray icon while it runs.">
        <Switch checked={settings?.closeToTray ?? true} onChange={(closeToTray) => void update({ closeToTray })}>
          Closing the window hides Pufferblow to the tray. Quit from the tray icon.
        </Switch>
      </SettingsCard>

      <SettingsCard
        title="Updates"
        description="New versions download in the background while you use the app, and install when you restart."
      >
        <p className="m-0 text-[13.5px] text-text-body" role="status">
          {settings ? `Pufferblow ${settings.version}. ` : ""}
          {describe(state)}
        </p>
        <div className="flex gap-2">
          {state?.status === "ready" ? (
            <Button onClick={() => void install()}>Restart to update</Button>
          ) : (
            <Button variant="secondary" disabled={busy || state?.status === "unsupported"} onClick={() => void check()}>
              Check for updates
            </Button>
          )}
        </div>
      </SettingsCard>
    </>
  );
}
