import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { resetTyping } from "../features/typing/store";
import { resetReactionUsage } from "../lib/reactionUsage";

afterEach(() => {
  cleanup();
  resetReactionUsage();
  resetTyping();
  localStorage.clear();
  sessionStorage.clear();
  // Cookies can't be cleared wholesale; expire the ones the app sets.
  document.cookie = "auth_token=; Path=/; Max-Age=0";
});
