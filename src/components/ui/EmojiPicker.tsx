import { useEffect, useRef, useState } from "react";
import { Picker } from "emoji-mart";
import spriteSheet from "emoji-datasource-twitter/img/twitter/sheets-256/64.png";

export interface PickedEmoji {
  /** The emoji as a unicode string, e.g. "👍". */
  native: string;
}

let emojiAssets: Promise<unknown> | null = null;

/**
 * Fetches what the picker draws with, once per session: the emoji data (~475 KB) and the sprite
 * sheet (~2.8 MB). The picker itself renders right away; only these are loaded on demand.
 */
function loadEmojiAssets(): Promise<unknown> {
  emojiAssets ??= Promise.all([
    // The Twitter set, not the package default: only the per-set files carry each emoji's x/y cell
    // in the sprite sheet. The default (native) set has none, so every emoji drew cell 0,0 — "#️⃣".
    import("@emoji-mart/data/sets/15/twitter.json").then((module) => module.default),
    // Decoded up front so the grid appears filled instead of as blank tiles. A failure here only
    // costs that, so it doesn't block the picker.
    (() => {
      const image = new Image();
      image.src = spriteSheet;
      return image.decode().catch(() => undefined);
    })(),
  ]).then(([data]) => data);
  emojiAssets.catch(() => {
    emojiAssets = null;
  });
  return emojiAssets;
}

/**
 * Rules injected into emoji-mart's shadow root, in the app's own look: a rounded search field
 * with a white focus ring, condensed uppercase category labels, soft rounded hover tiles, and a
 * tab bar along the bottom where the active category is a white pill.
 */
const PICKER_CSS = `
  :host { height: 392px; width: 100%; display: flex; }
  #root { --color-b: #9a9a9a; --color-c: #707070; }

  .spacer { height: 12px; }
  .search input[type="search"] {
    background-color: #161616;
    border: 1px solid rgba(242, 242, 242, 0.08);
    border-radius: 12px;
    padding: 9px 2em 9px 2.4em;
    transition-property: border-color, box-shadow;
  }
  .search input[type="search"]:hover { border-color: rgba(242, 242, 242, 0.14); }
  .search input[type="search"]:focus {
    background-color: #161616;
    border-color: rgba(255, 255, 255, 0.55);
    box-shadow: none;
    outline: none;
  }
  .search input[type="search"]::placeholder { color: #707070; opacity: 1; }
  .search .loupe { left: 0.85em; color: #707070; }
  .search .delete { color: #9a9a9a; }
  .skin-tone-button:hover, .skin-tone-button[aria-selected] { background-color: #2a2a2a; border-color: transparent; }
  .menu { background-color: rgba(22, 22, 22, 0.96); border-color: rgba(242, 242, 242, 0.14); }
  .option:hover { color: #000000; }

  .scroll { padding-top: 4px; }
  .sticky {
    padding: 12px 4px 6px;
    background-color: rgba(31, 31, 31, 0.96);
    backdrop-filter: blur(6px);
    color: #707070;
    font-family: "Barlow Condensed", "Barlow", system-ui, sans-serif;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }
  .category button .background { border-radius: 10px; background-color: #2a2a2a; }
  .skin-tone-button { border-radius: 10px; }
  .search { padding: 0 0 2px; }

  /*
   * The app sets scrollbar-color globally and it inherits into this shadow root; any non-auto
   * value makes Chromium ignore emoji-mart's ::-webkit-scrollbar rules and draw the native
   * scrollbar, arrows and all. Reset it so those rules (thin rounded thumb, no buttons) apply.
   */
  .scroll { scrollbar-color: auto; scrollbar-width: auto; }
  .scroll:hover::-webkit-scrollbar-thumb { background-color: rgba(242, 242, 242, 0.1); }
  .scroll::-webkit-scrollbar-thumb:hover { background-color: rgba(242, 242, 242, 0.18) !important; }
  @supports not selector(::-webkit-scrollbar) {
    .scroll { scrollbar-width: thin; scrollbar-color: rgba(242, 242, 242, 0.12) transparent; }
  }

  #nav { padding: 8px 12px 12px; background-color: #161616; border-top: 1px solid rgba(242, 242, 242, 0.08); }
  #nav:before, #nav .bar { display: none; }
  #nav .flex { gap: 2px; }
  #nav button { height: 32px; align-items: center; border-radius: 10px; }
  #nav button:hover { background-color: #2a2a2a; color: #f2f2f2; }
  #nav button[aria-selected] { background-color: #ffffff; color: #000000; }
`;

/** The picker's layout in placeholder blocks, shown at full size until the emoji have loaded. */
function PickerSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col bg-surface-secondary" aria-hidden="true">
      <div className="flex items-center px-3 pt-3">
        <div className="h-9.5 flex-1 rounded-xl border border-border-secondary bg-surface" />
        <div className="flex size-9.5 items-center justify-center">
          <div className="size-4 rounded-full bg-surface-tertiary" />
        </div>
      </div>
      <div className="flex-1 overflow-hidden px-3 pt-1">
        <div className="mx-1 mb-1.5 mt-2.5 h-3 w-28 rounded bg-surface-tertiary" />
        <div className="grid grid-cols-[repeat(8,38px)]">
          {Array.from({ length: 48 }, (_, i) => (
            <div key={i} className="flex size-9.5 items-center justify-center">
              <div className="size-6.5 animate-pulse rounded-lg bg-surface-tertiary" />
            </div>
          ))}
        </div>
      </div>
      <div className="h-13.25 border-t border-border-secondary bg-surface" />
    </div>
  );
}

/**
 * emoji-mart's searchable picker, drawn with the bundled Twemoji sprite sheet so it matches the
 * rest of the app and works offline. It opens at full size straight away with a placeholder grid;
 * the emoji data and artwork load behind it.
 */
export default function EmojiPicker({ onSelect }: { onSelect: (emoji: PickedEmoji) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });

  useEffect(() => {
    let picker: HTMLElement | null = null;
    let observer: MutationObserver | null = null;
    let cancelled = false;

    loadEmojiAssets().then(
      (data) => {
        if (cancelled || !host.current) return;
        picker = createPicker(data, (emoji) => onSelectRef.current(emoji));
        // emoji-mart paints a moment after it's attached; keep the placeholder up until it has.
        const shadow = picker.shadowRoot;
        observer = new MutationObserver(() => {
          if (shadow?.querySelector("#root")) {
            observer?.disconnect();
            setState("ready");
          }
        });
        if (shadow) observer.observe(shadow, { childList: true });
        else setState("ready");
        host.current.appendChild(picker);
      },
      () => {
        if (!cancelled) setState("failed");
      },
    );

    return () => {
      cancelled = true;
      observer?.disconnect();
      picker?.remove();
    };
  }, [attempt]);

  return (
    <div className="relative flex h-98 w-full">
      <div ref={host} className="flex w-full" />
      {state === "loading" && <PickerSkeleton />}
      {state === "failed" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-secondary text-sm text-text-muted">
          <p className="m-0">Couldn't load emoji.</p>
          <button
            type="button"
            className="rounded-lg bg-surface-tertiary px-3 py-1.5 text-text hover:bg-hover"
            onClick={() => {
              setState("loading");
              setAttempt((n) => n + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function createPicker(data: unknown, onEmojiSelect: (emoji: PickedEmoji) => void): HTMLElement {
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
    onEmojiSelect,
  }) as unknown as HTMLElement;

  // Match the Switchyard palette. These are the theme's inputs: emoji-mart's [data-theme] rule
  // redefines every --em-* variable from them on its own root, so setting --em-* here is ignored.
  const vars: Record<string, string> = {
    "--rgb-accent": "255, 255, 255",
    "--rgb-background": "31, 31, 31",
    "--rgb-input": "22, 22, 22",
    "--rgb-color": "242, 242, 242",
    "--color-border": "rgba(242, 242, 242, 0.08)",
    "--color-border-over": "rgba(242, 242, 242, 0.14)",
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

  return picker;
}
