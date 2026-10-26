/** What the desktop app remembers about itself, kept in the user's data folder next to the session vault. */
export interface DesktopSettings {
  /** The close button hides the window to the tray instead of quitting, as Discord does. */
  closeToTray: boolean;
}

export const DEFAULT_SETTINGS: DesktopSettings = { closeToTray: true };

/** Reads a settings file, falling back to the defaults for anything missing, unreadable or of the wrong type. */
export function parseSettings(raw: string | null): DesktopSettings {
  if (!raw) return { ...DEFAULT_SETTINGS };
  try {
    const value: unknown = JSON.parse(raw);
    const closeToTray = (value as Partial<DesktopSettings> | null)?.closeToTray;
    return { closeToTray: typeof closeToTray === "boolean" ? closeToTray : DEFAULT_SETTINGS.closeToTray };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export interface SettingsIo {
  read: () => string | null;
  write: (text: string) => void;
}

export class DesktopSettingsStore {
  private current: DesktopSettings;

  constructor(private readonly io: SettingsIo) {
    this.current = parseSettings(io.read());
  }

  get(): DesktopSettings {
    return { ...this.current };
  }

  /** Applies a change from the page, ignoring anything that is not a known setting of the right type. */
  set(patch: unknown): DesktopSettings {
    if (patch && typeof patch === "object" && typeof (patch as Partial<DesktopSettings>).closeToTray === "boolean") {
      this.current = { ...this.current, closeToTray: (patch as DesktopSettings).closeToTray };
      try {
        this.io.write(JSON.stringify(this.current));
      } catch {
        // The choice still holds for this run; it just will not survive a restart.
      }
    }
    return this.get();
  }
}
