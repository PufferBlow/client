import type { ReactNode } from "react";

export type BadgeVariant = "default" | "success" | "warning" | "error" | "info";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-surface-secondary text-text-secondary border-border-secondary",
  success: "bg-[color-mix(in_srgb,var(--color-success)_12%,var(--color-surface))] text-[color-mix(in_srgb,var(--color-success)_76%,var(--color-text))] border-[color-mix(in_srgb,var(--color-success)_34%,var(--color-border-secondary))]",
  warning: "bg-[color-mix(in_srgb,var(--color-warning)_12%,var(--color-surface))] text-[color-mix(in_srgb,var(--color-warning)_76%,var(--color-text))] border-[color-mix(in_srgb,var(--color-warning)_34%,var(--color-border-secondary))]",
  error: "bg-[color-mix(in_srgb,var(--color-error)_12%,var(--color-surface))] text-[color-mix(in_srgb,var(--color-error)_76%,var(--color-text))] border-[color-mix(in_srgb,var(--color-error)_34%,var(--color-border-secondary))]",
  info: "bg-[color-mix(in_srgb,var(--color-info)_12%,var(--color-surface))] text-[color-mix(in_srgb,var(--color-info)_76%,var(--color-text))] border-[color-mix(in_srgb,var(--color-info)_34%,var(--color-border-secondary))]",
};

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className ?? ""}`}>
      {children}
    </span>
  );
}
