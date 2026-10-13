import { useEffect, useRef } from "react";
// The Twitter set, not the package default: only the per-set files carry each emoji's x/y cell in
// the sprite sheet. The default (native) set has none, so every emoji drew cell 0,0 — "#️⃣".
import data from "@emoji-mart/data/sets/15/twitter.json";
import { Picker } from "emoji-mart";
import spriteSheet from "emoji-datasource-twitter/img/twitter/sheets-256/64.png";

export interface PickedEmoji {
  /** The emoji as a unicode string, e.g. "👍". */
  native: string;
}

/**
 * Rules injected into emoji-mart's shadow root, in the app's own look: a rounded search field
 * with a brass focus ring, condensed uppercase category labels, soft rounded hover tiles, and a
 * tab bar along the bottom where the active category is a brass pill.
 */
const PICKER_CSS = `
  :host { height: 392px; width: 100%; display: flex; }
  #root { --color-b: #a99e8b; --color-c: #7d7365; }

  .spacer { height: 12px; }
  .search input[type="search"] {
    background-color: #1a1612;
    border: 1px solid rgba(239, 230, 212, 0.08);
    border-radius: 12px;
    padding: 9px 2em 9px 2.4em;
    transition-property: border-color, box-shadow;
  }
  .search input[type="search"]:hover { border-color: rgba(239, 230, 212, 0.14); }
  .search input[type="search"]:focus {
    background-color: #1a1612;
    border-color: rgba(227, 174, 79, 0.55);
    box-shadow: 0 0 0 3px rgba(227, 174, 79, 0.12);
  }
  .search input[type="search"]::placeholder { color: #7d7365; opacity: 1; }
  .search .loupe { left: 0.85em; color: #7d7365; }
  .search .delete { color: #a99e8b; }
  .skin-tone-button:hover, .skin-tone-button[aria-selected] { background-color: #2e2720; border-color: transparent; }
  .menu { background-color: rgba(26, 22, 18, 0.96); border-color: rgba(239, 230, 212, 0.14); }
  .option:hover { color: #1c1408; }

  .scroll { padding-top: 4px; }
  .sticky {
    padding: 10px 4px 6px;
    background-color: rgba(35, 30, 25, 0.92);
    color: #7d7365;
    font-family: "Barlow Condensed", "Barlow", system-ui, sans-serif;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .category button .background { border-radius: 10px; background-color: #2e2720; }

  /*
   * The app sets scrollbar-color globally and it inherits into this shadow root; any non-auto
   * value makes Chromium ignore emoji-mart's ::-webkit-scrollbar rules and draw the native
   * scrollbar, arrows and all. Reset it so those rules (thin rounded thumb, no buttons) apply.
   */
  .scroll { scrollbar-color: auto; scrollbar-width: auto; }
  .scroll:hover::-webkit-scrollbar-thumb { background-color: rgba(239, 230, 212, 0.1); }
  .scroll::-webkit-scrollbar-thumb:hover { background-color: rgba(239, 230, 212, 0.18) !important; }
  @supports not selector(::-webkit-scrollbar) {
    .scroll { scrollbar-width: thin; scrollbar-color: rgba(239, 230, 212, 0.12) transparent; }
  }

  #nav { padding: 8px 12px 12px; background-color: #1a1612; border-top: 1px solid rgba(239, 230, 212, 0.08); }
  #nav:before, #nav .bar { display: none; }
  #nav .flex { gap: 2px; }
  #nav button { height: 32px; align-items: center; border-radius: 10px; }
  #nav button:hover { background-color: #2e2720; color: #efe6d4; }
  #nav button[aria-selected] { background-color: #e3ae4f; color: #1c1408; }
`;

/**
 * emoji-mart's searchable picker, drawn with the bundled Twemoji sprite sheet so it matches the
 * rest of the app and works offline. Loaded lazily: the emoji data is large.
 */
export default function EmojiPicker({ onSelect }: { onSelect: (emoji: PickedEmoji) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    const picker = new Picker({
      data,
      set: "twitter",
      theme: "dark",
      getSpritesheetURL: () => spriteSheet,
      previewPosition: "none",
      skinTonePosition: "search",
      navPosition: "bottom",
      perLine: 8,
      emojiButtonSize: 38,
      emojiSize: 26,
      maxFrequentRows: 2,
      autoFocus: true,
      onEmojiSelect: (emoji: PickedEmoji) => onSelectRef.current(emoji),
    }) as unknown as HTMLElement;

    // Match the Switchyard palette. These are the theme's inputs: emoji-mart's [data-theme] rule
    // redefines every --em-* variable from them on its own root, so setting --em-* here is ignored.
    const vars: Record<string, string> = {
      "--rgb-accent": "227, 174, 79",
      "--rgb-background": "35, 30, 25",
      "--rgb-input": "26, 22, 18",
      "--rgb-color": "239, 230, 212",
      "--color-border": "rgba(239, 230, 212, 0.08)",
      "--color-border-over": "rgba(239, 230, 212, 0.14)",
      // The popover around the picker draws the rounded border and clips to it.
      "--border-radius": "0px",
      "--category-icon-size": "18px",
      "--font-size": "14px",
      "--font-family": '"Barlow", ui-sans-serif, system-ui, sans-serif',
      "--shadow": "none",
    };
    for (const [name, value] of Object.entries(vars)) picker.style.setProperty(name, value);

    const style = document.createElement("style");
    style.textContent = PICKER_CSS;
    picker.shadowRoot?.appendChild(style);

    host.current?.appendChild(picker);
    return () => picker.remove();
  }, []);

  return <div ref={host} className="flex" />;
}
