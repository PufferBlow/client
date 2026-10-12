import { type InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    const classes = [
      "w-full h-10 px-3 rounded-xl border bg-surface-secondary text-text text-sm",
      "placeholder:text-text-muted transition-colors duration-150",
      "focus:outline-none focus:ring-4 focus:ring-primary/10",
      error ? "border-error" : "border-border hover:border-border-secondary focus:border-primary/60",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="w-full">
        <input ref={ref} className={classes} {...props} />
        {error && <p className="mt-1 text-xs text-error">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
