import { useEffect, useState, type ReactNode } from "react";
import loaderAnimated from "../../assets/loader/loader.png";
import loaderStill from "../../assets/loader/loader-still.png";

/**
 * How long the start-up screen stays up. A stand-in for the real update check: it is a fixed wait
 * for now, and `check` on {@link PreloadGate} is where the check goes once there is one.
 */
export const PRELOAD_MS = 3000;
const FADE_MS = 250;

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The start-up screen: the "gulp and puff" loader (an animated PNG, 2.6 s loop) and a status line. */
export function Preload({ status = "Checking for updates…", leaving = false }: { status?: string; leaving?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="preload"
      style={{ transition: `opacity ${FADE_MS}ms ease-out`, opacity: leaving ? 0 : 1 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background text-text"
    >
      {/* The still frame stands in for the animation when the system asks for less motion. */}
      <img
        src={prefersReducedMotion() ? loaderStill : loaderAnimated}
        alt=""
        draggable={false}
        width={168}
        height={168}
        className="size-[168px] select-none"
      />
      <div className="flex flex-col items-center gap-2">
        <span className="font-display text-3xl leading-none">Pufferblow</span>
        <span className="text-sm text-text-tertiary">{status}</span>
      </div>
    </div>
  );
}

interface PreloadGateProps {
  children: ReactNode;
  /** Shortest time to show the screen, in ms. */
  minMs?: number;
  /** Work to finish before the app shows (the update check). A rejection does not hold the app back. */
  check?: () => Promise<unknown>;
}

/**
 * Shows the start-up screen once, when the app opens, then fades to the app. The app is not
 * mounted underneath, so nothing it does (network calls, redirects) starts until the screen is gone.
 */
export function PreloadGate({ children, minMs = PRELOAD_MS, check }: PreloadGateProps) {
  const [phase, setPhase] = useState<"loading" | "leaving" | "done">(minMs > 0 ? "loading" : "done");

  useEffect(() => {
    if (minMs <= 0) return;
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const wait = new Promise<void>((resolve) => timers.push(setTimeout(resolve, minMs)));
    const work = check ? Promise.resolve().then(check).catch(() => undefined) : Promise.resolve();
    void Promise.all([wait, work]).then(() => {
      if (cancelled) return;
      setPhase("leaving");
      timers.push(setTimeout(() => !cancelled && setPhase("done"), FADE_MS));
    });
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [minMs, check]);

  if (phase === "done") return <>{children}</>;
  return <Preload leaving={phase === "leaving"} />;
}
