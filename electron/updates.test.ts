import { describe, expect, it, vi } from "vitest";
import { CHECK_EVERY_MS, UpdateManager, type Updater, type UpdateState } from "./updates";

function fake() {
  const listeners = new Map<string, (arg?: never) => void>();
  const updater = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    on: (event: string, listener: (arg?: never) => void) => void listeners.set(event, listener),
    checkForUpdates: vi.fn(async () => undefined),
    quitAndInstall: vi.fn(),
  };
  const emit = (event: string, arg?: unknown) => listeners.get(event)?.(arg as never);
  const states: UpdateState[] = [];
  const timers: { run: () => void; ms: number }[] = [];
  const manager = new UpdateManager({
    updater: updater as unknown as Updater,
    enabled: true,
    onState: (s) => states.push(s),
    now: () => 1000,
    setTimer: (run, ms) => void timers.push({ run, ms }),
  });
  return { updater, emit, states, timers, manager };
}

describe("updates", () => {
  it("downloads by itself and installs on quit, so nobody runs an installer", () => {
    const { updater } = fake();
    expect(updater.autoDownload).toBe(true);
    expect(updater.autoInstallOnAppQuit).toBe(true);
  });

  it("follows a new version from found, through the download, to ready", () => {
    const { emit, manager, states } = fake();
    emit("checking-for-update");
    emit("update-available", { version: "1.2.0" });
    emit("download-progress", { percent: 41.6 });
    expect(manager.current()).toEqual({ status: "downloading", version: "1.2.0", percent: 42 });
    emit("update-downloaded", { version: "1.2.0" });
    expect(manager.current()).toEqual({ status: "ready", version: "1.2.0" });
    expect(states.at(-1)).toEqual({ status: "ready", version: "1.2.0" });
  });

  it("records when it last looked and found nothing", () => {
    const { emit, manager } = fake();
    emit("update-not-available");
    expect(manager.current()).toEqual({ status: "idle", checkedAt: 1000 });
  });

  it("checks at start and again every half hour, but never while one is under way", async () => {
    const { updater, timers, manager, emit } = fake();
    manager.start();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(timers[0]!.ms).toBe(CHECK_EVERY_MS);
    emit("checking-for-update");
    await manager.check();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    emit("update-not-available");
    await manager.check();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it("reports a failed check and lets the next one try again", async () => {
    const { updater, manager } = fake();
    updater.checkForUpdates.mockRejectedValueOnce(new Error("offline"));
    await manager.check();
    expect(manager.current()).toEqual({ status: "error", message: "offline" });
    await manager.check();
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it("treats a project with no releases yet as up to date", () => {
    const { emit, manager } = fake();
    emit("error", new Error("No published versions on GitHub"));
    expect(manager.current()).toEqual({ status: "idle", checkedAt: 1000 });
  });

  it("only restarts into an update once one is ready", () => {
    const { updater, emit, manager } = fake();
    expect(manager.install()).toBe(false);
    emit("update-downloaded", { version: "1.2.0" });
    expect(manager.install()).toBe(true);
    expect(updater.quitAndInstall).toHaveBeenCalledWith(true, true);
  });

  it("does nothing, and says why, when updates are off", async () => {
    const updater = { checkForUpdates: vi.fn(), on: vi.fn() };
    const manager = new UpdateManager({
      updater: updater as unknown as Updater,
      enabled: false,
      disabledReason: "Dev build",
      onState: vi.fn(),
    });
    manager.start();
    await manager.check();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
    expect(manager.current()).toEqual({ status: "unsupported", reason: "Dev build" });
    expect(manager.install()).toBe(false);
  });
});
