import { join } from "path";
import { describe, expect, it } from "vitest";
import { resolveAppFile } from "./appProtocol";

const root = join("C:", "app", "dist");
const files = new Set([join(root, "index.html"), join(root, "assets", "index-abc.js"), join(root, "sounds", "ring.ogg")]);
const isFile = (path: string) => files.has(path);

describe("serving the app's own files", () => {
  it("serves a file that exists", () => {
    expect(resolveAppFile(root, "/assets/index-abc.js", isFile)).toBe(join(root, "assets", "index-abc.js"));
    expect(resolveAppFile(root, "/sounds/ring.ogg", isFile)).toBe(join(root, "sounds", "ring.ogg"));
  });

  it("gives a route the page, so a reload on /dashboard still opens the app", () => {
    expect(resolveAppFile(root, "/", isFile)).toBe(join(root, "index.html"));
    expect(resolveAppFile(root, "/dashboard/friends", isFile)).toBe(join(root, "index.html"));
    expect(resolveAppFile(root, "/assets/missing.js", isFile)).toBe(join(root, "index.html"));
  });

  it("never reaches outside the app's folder", () => {
    expect(resolveAppFile(root, "/../secret.txt", isFile)).toBe(join(root, "index.html"));
    expect(resolveAppFile(root, "/%2e%2e/%2e%2e/secret.txt", isFile)).toBe(join(root, "index.html"));
    expect(resolveAppFile(root, "/%zz", isFile)).toBe(join(root, "index.html"));
  });
});
