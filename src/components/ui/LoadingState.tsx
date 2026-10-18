import loaderAnimated from "../../assets/loader/loader.png";
import loaderStill from "../../assets/loader/loader-still.png";

export interface LoadingStateProps {
  message?: string;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** A panel's loading state: the puffer's "gulp and puff" loop (its still frame for reduced motion). */
export function LoadingState({ message = "Loading..." }: LoadingStateProps) {
  return (
    <div role="status" className="flex flex-col items-center justify-center py-12 text-center">
      <img src={prefersReducedMotion() ? loaderStill : loaderAnimated} alt="" draggable={false} width={72} height={72} className="size-[72px] select-none" />
      <p className="mt-3 text-sm text-text-secondary">{message}</p>
    </div>
  );
}
