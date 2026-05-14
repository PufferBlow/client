/**
 * OS-level notification dispatch driven by `notification_created` WebSocket
 * events from the Pufferblow API.
 *
 * Works in both the Electron renderer and a plain browser. We deliberately
 * stick to the standard `Notification` Web API rather than calling Electron's
 * `Notification` from the main process; the renderer's notifications integrate
 * with both the OS toast surface AND the in-page focus state, which is what
 * we want for the "don't notify when the user is already looking at it" rule.
 *
 * The service is suppression-aware:
 * - Page hidden / window unfocused → notify.
 * - Page visible AND window focused AND the active channel matches the
 *   notification's channel_id → suppress; the user can see the message.
 */

import { logger } from '../utils/logger';
import type { WebSocketNotificationCreatedMessage } from './websocket';

/**
 * Subset of the global `Window.electron` shape we depend on from preload.ts.
 * Declared locally so we don't have to thread an ambient global type across
 * the codebase for one optional method.
 */
interface ElectronBridge {
  focusWindow?: () => void;
}

/**
 * Per-notification rendering context the caller provides at dispatch time.
 * Lets us turn a wire payload (sender user_id, channel_id) into something
 * a human can read in a toast.
 */
export interface NotificationDispatchContext {
  /** Username of the actor that produced the notification, if known. */
  actorUsername?: string;
  /** Display name of the channel that contains the source message. */
  channelName?: string;
  /** Plain-text preview to show in the toast body. Capped at ~140 chars. */
  bodyPreview?: string;
  /**
   * `channel_id` of the channel the viewer is currently looking at. When
   * this matches the notification's `channel_id` AND the window is focused,
   * we suppress the toast.
   */
  activeChannelId?: string | null;
  /** Called when the user clicks the toast. The service will additionally
   * focus the app window. */
  onActivate?: (notification: WebSocketNotificationCreatedMessage['notification']) => void;
}

const TOAST_BODY_MAX_CHARS = 140;

const isBrowser = (): boolean => typeof window !== 'undefined';

const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;

/**
 * Returns true when the viewer is actively looking at the same channel the
 * notification came from. We don't toast in that case because the message
 * itself is about to appear in their message list a frame later.
 */
const shouldSuppressForActiveChannel = (
  notification: WebSocketNotificationCreatedMessage['notification'],
  activeChannelId: string | null | undefined,
): boolean => {
  if (!isBrowser()) return false;
  if (!activeChannelId) return false;
  if (!notification.channel_id) return false;
  if (notification.channel_id !== activeChannelId) return false;
  // Suppress only when the page is actually visible AND focused; a
  // minimized-but-on-the-channel state should still toast.
  const hidden = document.hidden;
  const focused = typeof document.hasFocus === 'function' ? document.hasFocus() : true;
  return !hidden && focused;
};

/**
 * Whether the current environment can show OS notifications at all. Server-
 * side rendering, locked-down WebViews, and browsers with the API stripped
 * out return false here so callers can bail without try/catching.
 */
export const supportsDesktopNotifications = (): boolean =>
  isBrowser() && typeof Notification !== 'undefined';

/**
 * Ask the OS for permission to display notifications. Idempotent — returns
 * the current state if permission is already granted or denied. Safe to
 * call early at app startup; the OS prompts only on the first un-granted
 * call.
 */
export const ensureNotificationPermission = async (): Promise<NotificationPermission> => {
  if (!supportsDesktopNotifications()) return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch (error) {
    logger.ui.warn('desktopNotifications: requestPermission failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return Notification.permission;
  }
};

/**
 * Show an OS notification for a `notification_created` WS message.
 *
 * Returns the spawned `Notification` instance, or `null` when nothing was
 * shown (no support, no permission, or suppression rule fired).
 */
export const dispatchDesktopNotification = (
  message: WebSocketNotificationCreatedMessage,
  context: NotificationDispatchContext = {},
): Notification | null => {
  if (!supportsDesktopNotifications()) return null;
  if (Notification.permission !== 'granted') return null;

  const notification = message.notification;
  if (!notification) return null;

  if (shouldSuppressForActiveChannel(notification, context.activeChannelId)) {
    logger.ui.debug('desktopNotifications: suppressed (viewing active channel)', {
      notification_id: notification.notification_id,
      channel_id: notification.channel_id,
    });
    return null;
  }

  const title = (() => {
    if (notification.type === 'mention' && context.actorUsername) {
      return context.channelName
        ? `${context.actorUsername} mentioned you in #${context.channelName}`
        : `${context.actorUsername} mentioned you`;
    }
    return context.actorUsername
      ? `New notification from ${context.actorUsername}`
      : 'New notification';
  })();
  const body = truncate(context.bodyPreview || '', TOAST_BODY_MAX_CHARS);

  let toast: Notification;
  try {
    toast = new Notification(title, {
      body: body || undefined,
      // Tag de-duplicates: a re-broadcast for the same row replaces an
      // existing toast instead of stacking.
      tag: `pufferblow:notification:${notification.notification_id}`,
    });
  } catch (error) {
    logger.ui.warn('desktopNotifications: failed to construct Notification', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  toast.onclick = () => {
    // Focus the Electron window first (the renderer's window.focus() is
    // unreliable when the app is in the tray); web browsers ignore the
    // electron call gracefully because the bridge is absent.
    try {
      const bridge = (window as unknown as { electron?: ElectronBridge }).electron;
      bridge?.focusWindow?.();
    } catch (error) {
      logger.ui.debug('desktopNotifications: electron.focusWindow unavailable', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    // Best-effort window focus (browser path).
    try {
      window.focus();
    } catch {
      // Ignore — already-focused browsers refuse to .focus() programmatically.
    }
    context.onActivate?.(notification);
    toast.close();
  };

  return toast;
};
