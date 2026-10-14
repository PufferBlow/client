import { Fragment } from "react";
import { typingLabel } from "../../features/typing/label";

/** "Ada is typing…" with three pulsing dots, in the slot under the composer. */
export function TypingIndicator({ names }: { names: readonly string[] }) {
  const label = typingLabel(names);
  return (
    <p aria-live="polite" className="m-0 flex h-full items-center gap-1.5 truncate text-[11.5px] leading-none text-text-muted">
      {names.length > 0 && (
        <>
          <span aria-hidden="true" className="flex shrink-0 gap-[3px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="typing-dot size-1 rounded-full bg-text-muted" style={{ animationDelay: `${i * 160}ms` }} />
            ))}
          </span>
          <span className="truncate">
            {label.names.map((name, i) => (
              <Fragment key={i}>
                {i > 0 && (i === label.names.length - 1 ? " and " : ", ")}
                <b className="font-semibold text-text-secondary">{name}</b>
              </Fragment>
            ))}
            {label.rest}
          </span>
        </>
      )}
    </p>
  );
}
