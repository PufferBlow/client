/**
 * Updates the way Discord does them: the app checks quietly when it starts and every half hour, downloads a new
 * version in the background, and then offers a restart. Nobody runs an installer; if the restart is put off, the
 * update is applied the next time the app quits.
 */

export type UpdateState =
  | { status: "unsupported"; reason: string }
  | { status: "idle"; checkedAt?: number }
  | { status: "checking" }
  | { status: "downloading"; version: string; percent: number }
  | { status: "ready"; version: string }
  | { status: "error"; message: string };

/** The part of electron-updater's `autoUpdater` that this uses, so a test can stand in for it. */
export interface Updater {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  on(event: "checking-for-update" | "update-not-available", listener: () => void): unknown;
  on(event: "update-available" | "update-downloaded", listener: (info: { version: string }) => void): unknown;
  on(event: "download-progress", listener: (progress: { percent: number }) => void): unknown;
  on(event: "error", listener: (error: Error) => void): unknown;
  checkForUpdates(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
}

export const CHECK_EVERY_MS = 30 * 60 * 1000;

export interface UpdateOptions {
  updater: Updater;
  /** False for a run from the source tree, or a build that has nowhere to update from. */
  enabled: boolean;
  /** Why updates are off, shown instead of a status. */
  disabledReason?: string;
  onState: (state: UpdateState) => void;
  now?: () => number;
  setTimer?: (run: () => void, ms: number) => unknown;
}

export class UpdateManager {
  private state: UpdateState;
  private readonly now: () => number;

  constructor(private readonly options: UpdateOptions) {
    this.now = options.now ?? Date.now;
    this.state = options.enabled
      ? { status: "idle" }
      : { status: "unsupported", reason: options.disabledReason ?? "Updates are off in this build." };
    if (!options.enabled) return;

    const { updater } = options;
    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.on("checking-for-update", () => this.set({ status: "checking" }));
    updater.on("update-available", (info) => this.set({ status: "downloading", version: info.version, percent: 0 }));
    updater.on("download-progress", (progress) => {
      if (this.state.status === "downloading") this.set({ ...this.state, percent: Math.round(progress.percent) });
    });
    updater.on("update-not-available", () => this.set({ status: "idle", checkedAt: this.now() }));
    updater.on("update-downloaded", (info) => this.set({ status: "ready", version: info.version }));
    updater.on("error", (error) => this.fail(error));
  }

  current(): UpdateState {
    return this.state;
  }

  /** Looks for a new version unless one is already being looked for, fetched or waiting to be installed. */
  async check(): Promise<void> {
    if (!this.options.enabled) return;
    if (["checking", "downloading", "ready"].includes(this.state.status)) return;
    try {
      await this.options.updater.checkForUpdates();
    } catch (error) {
      this.fail(error);
    }
  }

  /** Checks now, then again every half hour for as long as the app runs. */
  start(): void {
    if (!this.options.enabled) return;
    void this.check();
    const again = this.options.setTimer ?? ((run, ms) => setInterval(run, ms));
    again(() => void this.check(), CHECK_EVERY_MS);
  }

  /** Quits, installs the downloaded version and starts the app again. Does nothing until one has been downloaded. */
  install(): boolean {
    if (this.state.status !== "ready") return false;
    this.options.updater.quitAndInstall(true, true);
    return true;
  }

  private fail(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // A project that has not published a release yet has nothing to update to; that is not a failure.
    if (/no published versions/i.test(message)) this.set({ status: "idle", checkedAt: this.now() });
    else this.set({ status: "error", message });
  }

  private set(state: UpdateState) {
    this.state = state;
    this.options.onState(state);
  }
}
