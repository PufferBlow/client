import type { Root } from "hast";
import type { createLowlight } from "lowlight";

type Highlighter = ReturnType<typeof createLowlight>;

let highlighter: Promise<Highlighter> | null = null;

/** The highlighter with the ~35 common languages, fetched the first time a code block needs it. */
function loadHighlighter(): Promise<Highlighter> {
  highlighter ??= import("lowlight").then(({ common, createLowlight }) => createLowlight(common));
  highlighter.catch(() => {
    highlighter = null;
  });
  return highlighter;
}

/** Past this a block is shown plain: highlighting it would stall the UI for little benefit. */
const MAX_HIGHLIGHT_LENGTH = 200_000;

/**
 * Highlights `code` as `lang` (a name or alias such as js, py, ts, rust, sh, json…). Resolves to
 * null when the language isn't known, so the block is shown plain.
 */
export async function highlight(lang: string, code: string): Promise<Root | null> {
  if (code.length > MAX_HIGHLIGHT_LENGTH) return null;
  const lowlight = await loadHighlighter();
  const name = lang.toLowerCase();
  if (!lowlight.registered(name)) return null;
  return lowlight.highlight(name, code);
}
