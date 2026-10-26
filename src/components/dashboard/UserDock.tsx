import { useEffect, useRef } from "react";
import { UserPanel } from "./UserPanel";
import { VoiceCard } from "./VoiceCard";

/**
 * The user card, and on top of it the call you are in as one object: the call card grows out of the user card.
 * It floats at the bottom left across the server rail and the sidebar, so it reports its height as `--dock-h` on the
 * app shell, and the lists leave that much room plus the gap above it (the user card alone until a call adds to it).
 */
export function UserDock() {
  const dock = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = dock.current;
    const shell = element?.parentElement?.parentElement;
    if (!element || !shell || typeof ResizeObserver === "undefined") return;
    const measure = () => shell.style.setProperty("--dock-h", `${element.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => {
      observer.disconnect();
      shell.style.removeProperty("--dock-h");
    };
  }, []);

  return (
    <div ref={dock} data-dock className="pointer-events-auto rounded-lg bg-surface-secondary shadow-modal">
      <VoiceCard />
      <UserPanel />
    </div>
  );
}
