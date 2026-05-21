// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dispatchDesktopNotification,
  supportsDesktopNotifications,
} from "./desktopNotifications";
import type { WebSocketNotificationCreatedMessage } from "./websocket";

interface FakeNotificationInstance {
  title: string;
  options: { body?: string; tag?: string } | undefined;
  onclick: ((this: FakeNotificationInstance) => void) | null;
  close: () => void;
}

const installFakeNotification = (
  permission: NotificationPermission,
): { ctor: ReturnType<typeof vi.fn>; instances: FakeNotificationInstance[] } => {
  const instances: FakeNotificationInstance[] = [];
  const ctor = vi.fn(function (this: FakeNotificationInstance, title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options as { body?: string; tag?: string } | undefined;
    this.onclick = null;
    this.close = () => {};
    instances.push(this);
  });
  // Mirror the static `permission` property the dispatcher reads.
  (ctor as unknown as { permission: NotificationPermission }).permission = permission;
  (globalThis as unknown as { Notification: unknown }).Notification = ctor;
  return { ctor, instances };
};

const makeMessage = (
  overrides: Partial<WebSocketNotificationCreatedMessage["notification"]> = {},
): WebSocketNotificationCreatedMessage => ({
  type: "notification_created",
  notification: {
    notification_id: "n-1",
    user_id: "viewer-1",
    type: "mention",
    actor_user_id: "actor-1",
    channel_id: "ch-1",
    message_id: "msg-1",
    created_at: "2026-05-13T12:00:00Z",
    read_at: null,
    ...overrides,
  },
});

// The active-channel suppression rule reads `document.hasFocus()` and
// `document.hidden` to decide whether to toast. jsdom's defaults are
// version-dependent — older jsdom returned `true` for hasFocus(),
// newer versions return `false` — so the suppression tests can't rely
// on the runtime default. Stub the two probes explicitly per-test
// via this helper so each scenario expresses its intent.
const setFocusState = (focused: boolean, hidden = false): void => {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => hidden,
  });
  document.hasFocus = () => focused;
};

beforeEach(() => {
  // jsdom doesn't provide Notification by default.
  delete (globalThis as unknown as { Notification?: unknown }).Notification;
  // Default to the "user IS looking at the page" state. Individual
  // tests that want the unfocused / hidden state override below.
  setFocusState(true, false);
});

afterEach(() => {
  delete (globalThis as unknown as { Notification?: unknown }).Notification;
});

describe("supportsDesktopNotifications", () => {
  it("returns false when Notification is missing", () => {
    expect(supportsDesktopNotifications()).toBe(false);
  });

  it("returns true when Notification is present", () => {
    installFakeNotification("default");
    expect(supportsDesktopNotifications()).toBe(true);
  });
});

describe("dispatchDesktopNotification", () => {
  it("returns null when Notification API is missing", () => {
    expect(dispatchDesktopNotification(makeMessage())).toBeNull();
  });

  it("returns null when permission is not granted", () => {
    installFakeNotification("default");
    expect(dispatchDesktopNotification(makeMessage())).toBeNull();
  });

  it("constructs a Notification when permission is granted", () => {
    const { ctor, instances } = installFakeNotification("granted");
    dispatchDesktopNotification(makeMessage(), {
      actorUsername: "alice",
      channelName: "general",
      bodyPreview: "hey there!",
    });
    expect(ctor).toHaveBeenCalledOnce();
    expect(instances).toHaveLength(1);
    expect(instances[0].title).toContain("alice");
    expect(instances[0].title).toContain("general");
    expect(instances[0].options?.body).toBe("hey there!");
    expect(instances[0].options?.tag).toBe("pufferblow:notification:n-1");
  });

  it("suppresses when the viewer is focused on the active channel", () => {
    const { ctor } = installFakeNotification("granted");
    // Default `setFocusState(true, false)` in beforeEach matches the
    // "user is looking at this page right now" state, which is the
    // scenario the suppression rule guards against.
    dispatchDesktopNotification(makeMessage({ channel_id: "ch-1" }), {
      actorUsername: "alice",
      activeChannelId: "ch-1",
    });
    expect(ctor).not.toHaveBeenCalled();
  });

  it("does NOT suppress when the viewer is on the active channel but the window is unfocused", () => {
    const { ctor } = installFakeNotification("granted");
    // User has the right channel selected but the app is in the
    // background. A toast IS the right surface here — they wouldn't
    // see the in-page message otherwise.
    setFocusState(false, false);
    dispatchDesktopNotification(makeMessage({ channel_id: "ch-1" }), {
      actorUsername: "alice",
      activeChannelId: "ch-1",
    });
    expect(ctor).toHaveBeenCalledOnce();
  });

  it("does NOT suppress when the page is hidden even if the right channel is selected", () => {
    const { ctor } = installFakeNotification("granted");
    setFocusState(true, true);
    dispatchDesktopNotification(makeMessage({ channel_id: "ch-1" }), {
      actorUsername: "alice",
      activeChannelId: "ch-1",
    });
    expect(ctor).toHaveBeenCalledOnce();
  });

  it("does NOT suppress when the viewer is on a different channel", () => {
    const { ctor } = installFakeNotification("granted");
    dispatchDesktopNotification(makeMessage({ channel_id: "ch-1" }), {
      actorUsername: "alice",
      activeChannelId: "ch-2",
    });
    expect(ctor).toHaveBeenCalledOnce();
  });

  it("falls back to a generic title when no actor username is supplied", () => {
    const { instances } = installFakeNotification("granted");
    dispatchDesktopNotification(makeMessage(), {});
    expect(instances[0].title).toBe("New notification");
  });

  it("truncates body previews above the max", () => {
    const { instances } = installFakeNotification("granted");
    const longBody = "a".repeat(500);
    dispatchDesktopNotification(makeMessage(), {
      actorUsername: "alice",
      bodyPreview: longBody,
    });
    const body = instances[0].options?.body ?? "";
    expect(body.length).toBeLessThanOrEqual(140);
    expect(body.endsWith("…")).toBe(true);
  });

  it("onclick triggers the activate callback and focuses Electron when available", () => {
    const { instances } = installFakeNotification("granted");
    const onActivate = vi.fn();
    const focusWindow = vi.fn();
    (window as unknown as { electron?: { focusWindow: () => void } }).electron = {
      focusWindow,
    };

    dispatchDesktopNotification(makeMessage(), {
      actorUsername: "alice",
      onActivate,
    });

    instances[0].onclick?.call(instances[0]);
    expect(focusWindow).toHaveBeenCalledOnce();
    expect(onActivate).toHaveBeenCalledOnce();

    delete (window as unknown as { electron?: unknown }).electron;
  });
});
