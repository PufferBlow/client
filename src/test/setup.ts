import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  // Cookies can't be cleared wholesale; expire the ones the app sets.
  document.cookie = "auth_token=; Path=/; Max-Age=0";
});
