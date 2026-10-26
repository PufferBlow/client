import { loopSound } from "../sounds/sounds";

/**
 * What tells you someone is calling: the ring sound, and a desktop notification if the window is in the
 * background and notifications are already allowed. Neither asks for anything; if the browser blocks sound
 * until you have clicked on the page, the call card on screen is still there.
 */

/** Start ringing for an incoming call. Returns a function that stops it. */
export const startRinging = (): (() => void) => loopSound("ring");

/** Start the sound of your own call going out. Returns a function that stops it. */
export const startCalling = (): (() => void) => loopSound("calling");

/** Tell the person, outside the window, that someone is calling. Only if they have already allowed notifications. */
export function notifyIncomingCall(name: string): () => void {
  try {
    if (typeof Notification === "undefined" || Notification.permission !== "granted" || !document.hidden) return () => undefined;
    const notification = new Notification(`${name} is calling`, { body: "Pufferblow · end-to-end encrypted call", tag: "pufferblow-call", requireInteraction: true });
    notification.onclick = () => window.focus();
    return () => notification.close();
  } catch {
    return () => undefined;
  }
}
