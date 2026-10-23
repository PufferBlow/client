import { SkeletonCards, SkeletonForm, SkeletonMessage, SkeletonRow, SkeletonTable } from "./Skeleton";

export type LoadingShape = "list" | "table" | "form" | "cards" | "messages";

export interface LoadingStateProps {
  /** Said to screen readers; nothing is written on screen. */
  message?: string;
  /** The shape of what is coming, so the page does not jump when it arrives. */
  shape?: LoadingShape;
  className?: string;
}

function Shape({ shape }: { shape: LoadingShape }) {
  switch (shape) {
    case "table":
      return <SkeletonTable />;
    case "form":
      return <SkeletonForm />;
    case "cards":
      return <SkeletonCards />;
    case "messages":
      return (
        <div className="flex flex-col py-2">
          {Array.from({ length: 7 }, (_, i) => (
            <SkeletonMessage key={i} index={i} />
          ))}
        </div>
      );
    default:
      return (
        <div className="flex flex-col px-1">
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonRow key={i} index={i} />
          ))}
        </div>
      );
  }
}

/**
 * A panel while its data loads: placeholder shapes where the content will be. (The puffer's
 * "gulp and puff" loop is kept for the start-up update check, in `Preload`.)
 */
export function LoadingState({ message = "Loading…", shape = "list", className = "" }: LoadingStateProps) {
  return (
    <div role="status" aria-busy="true" className={`w-full ${className}`}>
      <span className="sr-only">{message}</span>
      <Shape shape={shape} />
    </div>
  );
}
