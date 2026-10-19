import { type ButtonHTMLAttributes, forwardRef } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success" | "warning";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-linear-to-b from-primary-hover to-[#e6e6e6] text-on-primary hover:brightness-105",
  secondary:
    "border border-border bg-surface text-text hover:bg-surface-secondary",
  ghost:
    "border border-transparent bg-transparent text-text-secondary hover:border-border-secondary hover:bg-hover hover:text-text",
  danger:
    "border border-error bg-error text-on-error hover:bg-[color-mix(in_srgb,var(--color-error)_85%,black)]",
  warning:
    "border border-warning bg-warning text-on-warning hover:bg-[color-mix(in_srgb,var(--color-warning)_85%,black)]",
  success:
    "border border-success bg-success text-on-success hover:bg-[color-mix(in_srgb,var(--color-success)_85%,black)]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm rounded-md",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-5 text-base rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", fullWidth, loading, className, children, disabled, ...props }, ref) => {
    const classes = [
      "inline-flex items-center justify-center gap-2 font-medium tracking-[-0.01em] transition-colors duration-150",
      "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      "disabled:opacity-50 disabled:cursor-not-allowed",
      variantClasses[variant],
      sizeClasses[size],
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button ref={ref} className={classes} disabled={disabled || loading} aria-disabled={disabled || loading} {...props}>
        {loading && (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        )}
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";
