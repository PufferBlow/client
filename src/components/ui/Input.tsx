import { type InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    const classes = [
      "h-11 w-full rounded-md border-0 bg-surface-secondary px-3.5 text-[14.5px] text-text",
      "placeholder:text-text-muted transition-shadow duration-(--motion-fast)",
      // Focus is a 2px white ring offset by 2; an error is a 1px inset line in the danger colour.
      "focus:outline-none focus:shadow-[0_0_0_2px_var(--color-background-secondary),0_0_0_4px_var(--color-text)]",
      error ? "shadow-[inset_0_0_0_1px_var(--color-error)]" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className="w-full">
        <input ref={ref} className={classes} {...props} />
        {error && <p className="pb-error mt-1.5">{error}</p>}
      </div>
    );
  },
);

Input.displayName = "Input";
