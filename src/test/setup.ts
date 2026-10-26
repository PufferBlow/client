import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { resetPending } from "../features/messages/pending";
import { resetTyping } from "../features/typing/store";
import { resetReactionUsage } from "../lib/reactionUsage";

// jsdom has no media playback; sounds are played through Audio and must not fill the log with "not implemented".
Object.defineProperty(HTMLMediaElement.prototype, "play", { configurable: true, value: () => Promise.resolve() });
Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: () => undefined });
Object.defineProperty(HTMLMediaElement.prototype, "load", { configurable: true, value: () => undefined });

afterEach(() => {
  cleanup();
  resetReactionUsage();
  resetTyping();
  resetPending();
  localStorage.clear();
  sessionStorage.clear();
  // Cookies can't be cleared wholesale; expire the ones the app sets.
  document.cookie = "auth_token=; Path=/; Max-Age=0";
});
