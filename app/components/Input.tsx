import React, { forwardRef } from 'react';

/**
 * Input variants for different visual styles
 */
export type InputVariant = 'default' | 'filled' | 'outlined';

/**
 * Input sizes for different contexts
 */
export type InputSize = 'sm' | 'md' | 'lg';

/**
 * Props for the Input component
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /**
   * The visual style variant of the input
   * @default 'default'
   */
  variant?: InputVariant;

  /**
   * The size of the input
   * @default 'md'
   */
  size?: InputSize;

  /**
   * Whether the input should take full width of its container
   * @default false
   */
  fullWidth?: boolean;

  /**
   * Error message to display below the input
   */
  error?: string;

  /**
   * Helper text to display below the input
   */
  helperText?: string;

  /**
   * Label text for the input
   */
  label?: string;

  /**
   * Icon to display at the start of the input
   */
  startIcon?: React.ReactNode;

  /**
   * Icon to display at the end of the input
   */
  endIcon?: React.ReactNode;

  /**
   * Whether the input is in a loading state
   * @default false
   */
  loading?: boolean;
}

/**
 * A reusable Input component with multiple variants, sizes, and states.
 *
 * This component provides consistent styling and behavior for form inputs across the application,
 * with built-in support for labels, error states, helper text, and icons.
 *
 * @example
 * ```tsx
 * // Basic input with label
 * <Input
 *   label="Username"
 *   placeholder="Enter your username"
 *   value={username}
 *   onChange={(e) => setUsername(e.target.value)}
 * />
 *
 * // Input with error state
 * <Input
 *   label="Email"
 *   type="email"
 *   error="Please enter a valid email address"
 *   value={email}
 *   onChange={(e) => setEmail(e.target.value)}
 * />
 *
 * // Input with icons
 * <Input
 *   label="Search"
 *   placeholder="Search messages..."
 *   startIcon={<SearchIcon />}
 *   value={searchTerm}
 *   onChange={(e) => setSearchTerm(e.target.value)}
 * />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(({
  variant = 'default',
  size = 'md',
  fullWidth = false,
  error,
  helperText,
  label,
  startIcon,
  endIcon,
  loading = false,
  className = '',
  id,
  disabled,
  ...props
}, ref) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;

  const baseClasses = 'block w-full transition-colors duration-150 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses = {
    default: 'border border-[var(--color-border-secondary)] rounded-xl focus:ring-2 focus:ring-[var(--color-focus)] focus:border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)]',
    filled: 'border border-transparent rounded-xl focus:ring-2 focus:ring-[var(--color-focus)] bg-[var(--color-surface-secondary)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:bg-[var(--color-surface)]',
    outlined: 'border border-[var(--color-border)] rounded-xl focus:ring-2 focus:ring-[var(--color-focus)] focus:border-[var(--color-text-secondary)] bg-transparent text-[var(--color-text)] placeholder-[var(--color-text-muted)]',
  };

  const sizeClasses = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-3 text-base',
    lg: 'px-4 py-3 text-lg',
  };

  const errorClasses = error ? 'border-[var(--color-border)] focus:ring-[var(--color-focus)]' : '';
  const widthClass = fullWidth ? 'w-full' : '';

  const inputClasses = [
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    errorClasses,
    widthClass,
    startIcon ? 'pl-10' : '',
    endIcon ? 'pr-10' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={`relative ${fullWidth ? 'w-full' : ''}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {startIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="text-[var(--color-text-muted)]" aria-hidden="true">
              {startIcon}
            </span>
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          className={inputClasses}
          disabled={disabled || loading}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${inputId}-error` :
            helperText ? `${inputId}-helper` :
            undefined
          }
          {...props}
        />

        {endIcon && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <span className="text-[var(--color-text-muted)]" aria-hidden="true">
              {endIcon}
            </span>
          </div>
        )}

        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <svg
              className="animate-spin h-4 w-4 text-[var(--color-text-muted)]"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          </div>
        )}
      </div>

      {error && (
        <p
          id={`${inputId}-error`}
          className="mt-1 text-sm text-[var(--color-error)]"
          role="alert"
        >
          {error}
        </p>
      )}

      {!error && helperText && (
        <p
          id={`${inputId}-helper`}
          className="mt-1 text-sm text-[var(--color-text-muted)]"
        >
          {helperText}
        </p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

export default Input;
