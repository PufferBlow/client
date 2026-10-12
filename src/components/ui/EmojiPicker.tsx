import { useEffect, useRef } from "react";
import data from "@emoji-mart/data";
import { Picker } from "emoji-mart";
import spriteSheet from "emoji-datasource-twitter/img/twitter/sheets-256/64.png";

export interface PickedEmoji {
  /** The emoji as a unicode string, e.g. "👍". */
  native: string;
}

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
      navPosition: "top",
      autoFocus: true,
      onEmojiSelect: (emoji: PickedEmoji) => onSelectRef.current(emoji),
    }) as unknown as HTMLElement;

    // Match the Switchyard palette (emoji-mart reads these RGB triplets from the host element).
    picker.style.setProperty("--em-rgb-accent", "227, 174, 79");
    picker.style.setProperty("--em-rgb-background", "35, 30, 25");
    picker.style.setProperty("--em-rgb-input", "46, 39, 32");
    picker.style.setProperty("--em-rgb-color", "239, 230, 212");
    picker.style.setProperty("--border-radius", "12px");

    host.current?.appendChild(picker);
    return () => picker.remove();
  }, []);

  return <div ref={host} />;
}
