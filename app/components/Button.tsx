import React from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "success"
  | "danger"
  | "warning";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  startIcon?: React.ReactNode;
  endIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border pb-border bg-[var(--color-primary)] text-[var(--color-on-primary)] hover:bg-[var(--color-primary-hover)]",
  secondary:
    "border pb-border bg-[var(--color-surface-secondary)] text-[var(--color-text)] hover:bg-[var(--color-hover)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--color-text-secondary)] hover:border-[var(--color-border-secondary)] hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]",
  danger:
    "border border-[var(--color-error)]/50 bg-[var(--color-error)] text-[var(--color-on-error)] hover:bg-[var(--color-error)]/90",
  warning:
    "border border-[var(--color-warning)]/50 bg-[var(--color-warning)] text-[var(--color-on-warning)] hover:bg-[var(--color-warning)]/90",
  success:
    "border border-[var(--color-success)]/50 bg-[var(--color-success)] text-[var(--color-on-success)] hover:bg-[var(--color-success)]/90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

/**
 * Shared tokenized button component for monochrome + semantic actions.
 */
export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  startIcon,
  endIcon,
  children,
  className = "",
  disabled,
  ...props
}) => {
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] disabled:opacity-50 disabled:cursor-not-allowed",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled || loading} aria-disabled={disabled || loading} {...props}>
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}

      {!loading && startIcon ? <span aria-hidden="true">{startIcon}</span> : null}
      <span>{children}</span>
      {!loading && endIcon ? <span aria-hidden="true">{endIcon}</span> : null}
    </button>
  );
};

export default Button;

