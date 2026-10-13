import { createLogger } from "./logger";

const log = createLogger("clipboard");

/** Copies text, falling back to a hidden textarea where the async clipboard API is unavailable. Resolves false on failure. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (error) {
    // Permission denied or insecure context: try the fallback below.
    log.debug("async clipboard refused, using the fallback", error);
  }

  try {
    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand("copy");
    field.remove();
    if (!ok) log.warn("copy command was refused");
    return ok;
  } catch (error) {
    log.warn("couldn't copy to the clipboard", error);
    return false;
  }
}
