import { useEffect, useRef } from "react";
import { UserPanel } from "./UserPanel";
import { VoiceCard } from "./VoiceCard";

/** The room the dock needs under the lists: its own height, plus the gutter it floats in. */
const GUTTER = 16;

/**
 * The user card, and on top of it the call you are in as one object: the call card grows out of the user card.
 * It floats at the bottom left across the server rail and the sidebar, so it reports its height as `--dock-h` on the
 * app shell, and the lists leave exactly that much room (60px, the user card alone, until a call adds to it).
 */
export function UserDock() {
  const dock = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = dock.current;
    const shell = element?.parentElement?.parentElement;
    if (!element || !shell || typeof ResizeObserver === "undefined") return;
    const measure = () => shell.style.setProperty("--dock-h", `${element.offsetHeight + GUTTER}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      shell.style.removeProperty("--dock-h");
    };
  }, []);

  return (
    <div ref={dock} className="pointer-events-auto rounded-lg bg-surface-secondary shadow-modal">
      <VoiceCard />
      <UserPanel />
    </div>
  );
}
