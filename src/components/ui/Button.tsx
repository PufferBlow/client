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
  // Primary is the only white surface on a screen.
  primary: "bg-primary text-on-primary hover:bg-white active:scale-[0.97]",
  secondary: "bg-surface-secondary text-text hover:bg-surface-tertiary active:scale-[0.97]",
  ghost: "border border-border bg-transparent text-text hover:bg-surface-secondary",
  danger: "bg-error/14 text-error-text hover:bg-error/22 active:scale-[0.97]",
  warning: "bg-warning/14 text-warning hover:bg-warning/22 active:scale-[0.97]",
  success: "bg-success/14 text-success hover:bg-success/22 active:scale-[0.97]",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 rounded-sm",
  md: "h-10 px-[18px] rounded-md",
  lg: "h-12 px-6 rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", fullWidth, loading, className, children, disabled, ...props }, ref) => {
    const classes = [
      "pb-label-button inline-flex items-center justify-center gap-2 border-0 transition-[background-color,transform] duration-(--motion-fast)",
      "focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
      "disabled:cursor-not-allowed disabled:bg-surface disabled:text-text-faint disabled:active:scale-100",
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
