import React from 'react';

/**
 * Loading state variants for different contexts
 */
export type LoadingVariant = 'spinner' | 'skeleton' | 'pulse' | 'dots';

/**
 * Loading state sizes
 */
export type LoadingSize = 'sm' | 'md' | 'lg';

/**
 * Props for the LoadingState component
 */
export interface LoadingStateProps {
  /**
   * The visual variant of the loading state
   * @default 'spinner'
   */
  variant?: LoadingVariant;

  /**
   * The size of the loading indicator
   * @default 'md'
   */
  size?: LoadingSize;

  /**
   * Custom message to display with the loading indicator
   */
  message?: string;

  /**
   * Whether to show the loading state as an overlay
   * @default false
   */
  overlay?: boolean;

  /**
   * Whether to take full width of the container
   * @default false
   */
  fullWidth?: boolean;

  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * A reusable loading state component with multiple variants and sizes.
 *
 * Provides consistent loading indicators across the application with accessibility support.
 *
 * @example
 * ```tsx
 * // Simple spinner
 * <LoadingState />
 *
 * // Loading with message
 * <LoadingState message="Loading data..." />
 *
 * // Skeleton loading for content
 * <LoadingState variant="skeleton" />
 *
 * // Full overlay loading
 * <LoadingState overlay message="Processing..." />
 * ```
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  variant = 'spinner',
  size = 'md',
  message,
  overlay = false,
  fullWidth = false,
  className = '',
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const containerClasses = [
    'flex flex-col items-center justify-center',
    fullWidth ? 'w-full' : '',
    overlay ? 'absolute inset-0 bg-white/80 backdrop-blur-sm z-10' : '',
    className,
  ].filter(Boolean).join(' ');

  const renderSpinner = () => (
    <svg
      className={`animate-spin text-blue-600 ${sizeClasses[size]}`}
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
  );

  const renderDots = () => (
    <div className="flex space-x-1">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`bg-blue-600 rounded-full animate-pulse ${sizeClasses[size]}`}
          style={{
            animationDelay: `${i * 0.2}s`,
            animationDuration: '1.4s',
          }}
          aria-hidden="true"
        />
      ))}
    </div>
  );

  const renderSkeleton = () => (
    <div className="space-y-3 w-full max-w-md">
      <div className="h-4 bg-gray-300 rounded animate-pulse" />
      <div className="h-4 bg-gray-300 rounded animate-pulse w-3/4" />
      <div className="h-4 bg-gray-300 rounded animate-pulse w-1/2" />
    </div>
  );

  const renderPulse = () => (
    <div className={`bg-gray-300 rounded animate-pulse ${sizeClasses[size]}`} />
  );

  const renderLoadingIndicator = () => {
    switch (variant) {
      case 'spinner':
        return renderSpinner();
      case 'dots':
        return renderDots();
      case 'skeleton':
        return renderSkeleton();
      case 'pulse':
        return renderPulse();
      default:
        return renderSpinner();
    }
  };

  return (
    <div
      className={containerClasses}
      role="status"
      aria-live="polite"
      aria-label={message || 'Loading'}
    >
      {renderLoadingIndicator()}

      {message && variant !== 'skeleton' && (
        <p className="mt-3 text-sm text-gray-600 text-center">
          {message}
        </p>
      )}

      {/* Screen reader only text */}
      <span className="sr-only">
        {message || 'Loading content, please wait'}
      </span>
    </div>
  );
};

/**
 * A specialized loading state for data tables
 */
export interface TableLoadingStateProps {
  /**
   * Number of rows to show as skeleton
   * @default 5
   */
  rows?: number;

  /**
   * Number of columns to show
   * @default 4
   */
  columns?: number;
}

/**
 * Loading state specifically designed for data tables.
 *
 * @example
 * ```tsx
 * <TableLoadingState rows={10} columns={5} />
 * ```
 */
export const TableLoadingState: React.FC<TableLoadingStateProps> = ({
  rows = 5,
  columns = 4,
}) => (
  <div className="space-y-3">
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex space-x-4">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <div
            key={colIndex}
            className="flex-1 h-4 bg-gray-300 rounded animate-pulse"
            style={{
              width: colIndex === 0 ? '20%' : colIndex === columns - 1 ? '15%' : '25%',
            }}
          />
        ))}
      </div>
    ))}
  </div>
);

/**
 * A specialized loading state for cards
 */
export interface CardLoadingStateProps {
  /**
   * Whether to show a header skeleton
   * @default true
   */
  showHeader?: boolean;

  /**
   * Number of content lines to show
   * @default 3
   */
  contentLines?: number;
}

/**
 * Loading state specifically designed for card components.
 *
 * @example
 * ```tsx
 * <CardLoadingState showHeader={false} contentLines={2} />
 * ```
 */
export const CardLoadingState: React.FC<CardLoadingStateProps> = ({
  showHeader = true,
  contentLines = 3,
}) => (
  <div className="space-y-4">
    {showHeader && (
      <div className="h-6 bg-gray-300 rounded animate-pulse w-1/3" />
    )}

    <div className="space-y-2">
      {Array.from({ length: contentLines }).map((_, index) => (
        <div
          key={index}
          className="h-4 bg-gray-300 rounded animate-pulse"
          style={{
            width: index === contentLines - 1 ? '60%' : '100%',
          }}
        />
      ))}
    </div>
  </div>
);

export default LoadingState;
