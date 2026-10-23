const EXTENSION = /^[a-z0-9]{1,10}$/;

/** "jpg, .PNG webp" becomes ["jpg", "png", "webp"]; null when something in it is not a file extension. */
export function parseExtensions(text: string): string[] | null {
  const words = text
    .split(/[\s,;]+/)
    .map((w) => w.replace(/^\./, "").toLowerCase())
    .filter(Boolean);
  if (!words.every((w) => EXTENSION.test(w))) return null;
  return [...new Set(words)];
}
