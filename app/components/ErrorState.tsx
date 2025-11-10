import React from 'react';
import { Button } from './Button';

/**
 * Error state variants for different contexts
 */
export type ErrorVariant = 'default' | 'inline' | 'card' | 'page';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info';

/**
 * Props for the ErrorState component
 */
export interface ErrorStateProps {
  /**
   * The visual variant of the error state
   * @default 'default'
   */
  variant?: ErrorVariant;

  /**
   * The severity level of the error
   * @default 'error'
   */
  severity?: ErrorSeverity;

  /**
   * The main error title/message
   */
  title?: string;

  /**
   * Detailed error description
   */
  message?: string;

  /**
   * Error code or additional technical details
   */
  code?: string;

  /**
   * Icon to display with the error
   */
  icon?: React.ReactNode;

  /**
   * Action buttons to display
   */
  actions?: React.ReactNode;

  /**
   * Whether to show a retry button
   * @default false
   */
  showRetry?: boolean;

  /**
   * Callback for retry action
   */
  onRetry?: () => void;

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
 * A reusable error state component with multiple variants and severity levels.
 *
 * Provides consistent error handling and user feedback across the application
 * with accessibility support and actionable recovery options.
 *
 * @example
 * ```tsx
 * // Simple error message
 * <ErrorState
 *   title="Failed to load data"
 *   message="Please check your connection and try again"
 * />
 *
 * // Error with retry action
 * <ErrorState
 *   title="Network Error"
 *   message="Unable to connect to the server"
 *   showRetry
 *   onRetry={() => refetchData()}
 * />
 *
 * // Inline error for forms
 * <ErrorState
 *   variant="inline"
 *   severity="warning"
 *   message="This field is required"
 * />
 * ```
 */
export const ErrorState: React.FC<ErrorStateProps> = ({
  variant = 'default',
  severity = 'error',
  title,
  message,
  code,
  icon,
  actions,
  showRetry = false,
  onRetry,
  fullWidth = false,
  className = '',
}) => {
  const getDefaultIcon = () => {
    const iconClasses = 'w-12 h-12 mx-auto mb-4';
    switch (severity) {
      case 'error':
        return (
          <svg className={`${iconClasses} text-red-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'warning':
        return (
          <svg className={`${iconClasses} text-yellow-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        );
      case 'info':
        return (
          <svg className={`${iconClasses} text-blue-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getSeverityClasses = () => {
    switch (severity) {
      case 'error':
        return 'text-red-600';
      case 'warning':
        return 'text-yellow-600';
      case 'info':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  const renderDefaultVariant = () => (
    <div className={`text-center py-8 ${fullWidth ? 'w-full' : ''}`}>
      {icon || getDefaultIcon()}

      {title && (
        <h3 className={`text-lg font-semibold mb-2 ${getSeverityClasses()}`}>
          {title}
        </h3>
      )}

      {message && (
        <p className="text-gray-600 mb-4 max-w-md mx-auto">
          {message}
        </p>
      )}

      {code && (
        <p className="text-sm text-gray-500 mb-4 font-mono">
          Error code: {code}
        </p>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        {showRetry && onRetry && (
          <Button onClick={onRetry} variant="primary">
            Try Again
          </Button>
        )}
        {actions}
      </div>
    </div>
  );

  const renderInlineVariant = () => (
    <div className={`flex items-start space-x-3 p-3 rounded-lg bg-red-50 border border-red-200 ${fullWidth ? 'w-full' : ''}`}>
      <div className="flex-shrink-0" aria-hidden="true">
        {icon || (
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        )}
      </div>

      <div className="flex-1">
        {title && (
          <h4 className="text-sm font-medium text-red-800">
            {title}
          </h4>
        )}

        {message && (
          <p className="text-sm text-red-700 mt-1">
            {message}
          </p>
        )}

        {code && (
          <p className="text-xs text-red-600 mt-1 font-mono">
            {code}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex-shrink-0">
          {actions}
        </div>
      )}
    </div>
  );

  const renderCardVariant = () => (
    <div className={`bg-white border border-gray-200 rounded-lg p-6 shadow-sm ${fullWidth ? 'w-full' : ''}`}>
      <div className="flex items-start space-x-4">
        <div className="flex-shrink-0" aria-hidden="true">
          {icon || getDefaultIcon()}
        </div>

        <div className="flex-1">
          {title && (
            <h3 className={`text-lg font-semibold mb-2 ${getSeverityClasses()}`}>
              {title}
            </h3>
          )}

          {message && (
            <p className="text-gray-600 mb-3">
              {message}
            </p>
          )}

          {code && (
            <p className="text-sm text-gray-500 mb-4 font-mono">
              Error code: {code}
            </p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {showRetry && onRetry && (
              <Button onClick={onRetry} variant="primary" size="sm">
                Try Again
              </Button>
            )}
            {actions}
          </div>
        </div>
      </div>
    </div>
  );

  const renderPageVariant = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {icon || getDefaultIcon()}

        {title && (
          <h1 className={`text-2xl font-bold mb-4 ${getSeverityClasses()}`}>
            {title}
          </h1>
        )}

        {message && (
          <p className="text-gray-600 mb-6">
            {message}
          </p>
        )}

        {code && (
          <p className="text-sm text-gray-500 mb-6 font-mono">
            Error code: {code}
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {showRetry && onRetry && (
            <Button onClick={onRetry} variant="primary">
              Try Again
            </Button>
          )}
          {actions}
        </div>
      </div>
    </div>
  );

  const renderVariant = () => {
    switch (variant) {
      case 'inline':
        return renderInlineVariant();
      case 'card':
        return renderCardVariant();
      case 'page':
        return renderPageVariant();
      default:
        return renderDefaultVariant();
    }
  };

  return (
    <div
      className={className}
      role="alert"
      aria-live="polite"
    >
      {renderVariant()}
    </div>
  );
};

/**
 * A specialized error boundary component for catching React errors
 */
export interface ErrorBoundaryProps {
  /**
   * Fallback component to render when an error occurs
   */
  fallback?: React.ComponentType<{ error: Error; resetError: () => void }>;

  /**
   * Callback when an error occurs
   */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;

  /**
   * Children to render normally
   */
  children: React.ReactNode;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component that catches JavaScript errors anywhere in the child component tree.
 *
 * @example
 * ```tsx
 * <ErrorBoundary
 *   fallback={({ error, resetError }) => (
 *     <ErrorState
 *       title="Something went wrong"
 *       message={error.message}
 *       showRetry
 *       onRetry={resetError}
 *     />
 *   )}
 * >
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  resetError = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} resetError={this.resetError} />;
      }

      return (
        <ErrorState
          title="Something went wrong"
          message="An unexpected error occurred. Please try refreshing the page."
          showRetry
          onRetry={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

export default ErrorState;
