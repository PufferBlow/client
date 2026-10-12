import { useEffect, useRef } from "react";
import data from "@emoji-mart/data";
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
  #root { --color-a: #efe6d4; --color-b: #7d7365; --color-c: #a99e8b; }
  .search { padding: 10px 10px 2px; }
  .search input[type="search"] {
    background: #1a1612;
    border: 1px solid rgba(239, 230, 212, 0.12);
    border-radius: 12px;
    color: #efe6d4;
    padding: 10px 2.2em;
  }
  .search input[type="search"]:focus { border-color: rgba(227, 174, 79, 0.55); box-shadow: 0 0 0 3px rgba(227, 174, 79, 0.12); }
  .scroll { padding: 0 6px 4px; }
  .sticky {
    padding: 10px 6px 6px;
    background: rgba(35, 30, 25, 0.94);
    color: #7d7365;
    font-family: "Barlow Condensed", "Barlow", system-ui, sans-serif;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .category button .background { border-radius: 10px; background: #2e2720; }
  #nav { padding: 8px; background: #1a1612; }
  #nav .flex { gap: 2px; }
  #nav button { height: 32px; border-radius: 9px; }
  #nav button:hover { background: #2e2720; color: #efe6d4; }
  #nav button[aria-selected] { background: #e3ae4f; color: #1c1408; }
  #nav .bar { display: none; }
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

    // Match the Switchyard palette (emoji-mart reads these from the host element).
    const vars: Record<string, string> = {
      "--em-rgb-accent": "227, 174, 79",
      "--em-rgb-background": "35, 30, 25",
      "--em-rgb-input": "26, 22, 18",
      "--em-rgb-color": "239, 230, 212",
      "--em-color-border": "rgba(239, 230, 212, 0.07)",
      "--em-color-border-over": "rgba(239, 230, 212, 0.14)",
      "--border-radius": "16px",
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
