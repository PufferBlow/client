/**
 * What tells you someone is calling: a two-tone ring made with the Web Audio API (so there is no sound
 * file to ship), and a desktop notification if the window is in the background and notifications are
 * already allowed. Neither asks for anything; if the browser blocks sound until you have clicked on the
 * page, the call card on screen is still there.
 */

const RING_EVERY_MS = 2_000;

type AudioContextCtor = typeof AudioContext;

function tone(context: AudioContext, frequency: number, start: number, length: number): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
  gain.gain.linearRampToValueAtTime(0, start + length);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + length + 0.05);
}

/** Start ringing. Returns a function that stops it. */
export function startRinging(): () => void {
  const Ctor = (globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }).AudioContext ?? (globalThis as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return () => undefined;

  let context: AudioContext | null = null;
  try {
    context = new Ctor();
  } catch {
    return () => undefined;
  }
  const ring = () => {
    if (!context || context.state === "closed") return;
    void context.resume?.().catch(() => undefined);
    const now = context.currentTime;
    tone(context, 440, now, 0.4);
    tone(context, 480, now + 0.45, 0.4);
  };
  ring();
  const timer = setInterval(ring, RING_EVERY_MS);
  return () => {
    clearInterval(timer);
    void context?.close().catch(() => undefined);
    context = null;
  };
}

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
