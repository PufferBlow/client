import type { ReactNode } from "react";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

// Meaning keeps its colour (it is status, not decoration); the neutral badge is the host pill.
const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-secondary text-text-tertiary",
  success: "bg-success/14 text-success",
  warning: "bg-warning/14 text-warning",
  error: "bg-error/14 text-error-text",
  info: "bg-info/14 text-info",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 rounded-pill px-2 text-xs font-medium ${variantClasses[variant]} ${className ?? ""}`}>
      {children}
    </span>
  );
}
