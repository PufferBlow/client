/**
 * The app's sounds. All of them are pieces of one recording (see scripts/make-sounds.py), so they belong together.
 * A browser may refuse to play before the page has been clicked, and a person may have turned sounds off; either way
 * nothing here throws, and what is on screen still says what happened.
 */
import accept from "../../assets/sounds/accept.ogg";
import calling from "../../assets/sounds/calling.ogg";
import end from "../../assets/sounds/end.ogg";
import join from "../../assets/sounds/join.ogg";
import leave from "../../assets/sounds/leave.ogg";
import ping from "../../assets/sounds/ping.ogg";
import ring from "../../assets/sounds/ring.ogg";

export const SOUNDS = {
  /** Someone is calling you. Loops until you answer. */
  ring,
  /** You are calling someone. Loops until they answer. */
  calling,
  /** A call was answered and is connected. */
  accept,
  /** A call ended. */
  end,
  /** You left a voice channel. */
  leave,
  /** You joined a voice channel. */
  join,
  /** You were pinged: an @-mention or a reply. */
  ping,
} as const;

export type SoundName = keyof typeof SOUNDS;

const OFF_KEY = "pb_sounds_off";

export function soundsEnabled(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) !== "1";
  } catch {
    return true;
  }
}

export function setSoundsEnabled(on: boolean): void {
  try {
    if (on) localStorage.removeItem(OFF_KEY);
    else localStorage.setItem(OFF_KEY, "1");
  } catch {
    // The choice holds for this page only.
  }
}

function make(name: SoundName, volume: number): HTMLAudioElement | null {
  if (!soundsEnabled() || typeof Audio === "undefined") return null;
  try {
    const audio = new Audio(SOUNDS[name]);
    audio.volume = volume;
    return audio;
  } catch {
    return null;
  }
}

function start(audio: HTMLAudioElement): void {
  try {
    void audio.play()?.catch(() => undefined);
  } catch {
    // Not allowed to play yet.
  }
}

/** Plays a sound once. */
export function playSound(name: SoundName, volume = 0.6): void {
  const audio = make(name, volume);
  if (audio) start(audio);
}

/** Plays a sound over and over until the returned function is called. */
export function loopSound(name: SoundName, volume = 0.6): () => void {
  const audio = make(name, volume);
  if (!audio) return () => undefined;
  audio.loop = true;
  start(audio);
  return () => {
    try {
      audio.pause();
      audio.removeAttribute("src");
      audio.load?.();
    } catch {
      // Already gone.
    }
  };
}
