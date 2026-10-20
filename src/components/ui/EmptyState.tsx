import type { ReactNode } from "react";
import { fishUrl } from "../../lib/identity";

export interface EmptyStateProps {
  /** Replaces the sleepy fish. */
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** A sleepy fish, one line of help and, if there is one, a single action. */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-center">
      {icon ? (
        <div className="text-text-muted">{icon}</div>
      ) : (
        <img src={fishUrl("sleepy", "ink")} alt="" width={64} height={64} className="size-16 select-none" draggable={false} />
      )}
      <h3 className="pb-title text-xl">{title}</h3>
      {description && <p className="max-w-[280px] text-[13px] text-text-tertiary">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
