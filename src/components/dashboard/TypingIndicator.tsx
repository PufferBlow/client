import { Fragment } from "react";
import { typingLabel } from "../../features/typing/label";

/** "Ada is typing…" with three rising bubbles, in the slot under the composer. */
export function TypingIndicator({ names }: { names: readonly string[] }) {
  const label = typingLabel(names);
  return (
    <p aria-live="polite" className="m-0 flex h-full items-center gap-1.5 truncate text-[11.5px] leading-none text-text-muted">
      {names.length > 0 && (
        <>
          <span aria-hidden="true" className="flex h-4 shrink-0 items-end gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="pb-anim-rise rounded-full shadow-[inset_0_0_0_1.5px_var(--color-text-body)]"
                style={{ width: 5 + i * 1.5, height: 5 + i * 1.5, animationDelay: `${i * 160}ms` }}
              />
            ))}
          </span>
          <span className="truncate">
            {label.names.map((name, i) => (
              <Fragment key={i}>
                {i > 0 && (i === label.names.length - 1 ? " and " : ", ")}
                <b className="font-semibold text-text-body">{name}</b>
              </Fragment>
            ))}
            {label.rest}
          </span>
        </>
      )}
    </p>
  );
}
