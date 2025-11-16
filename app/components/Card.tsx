import React from 'react';

/**
 * Card variants for different visual styles
 */
export type CardVariant = 'default' | 'elevated' | 'outlined' | 'filled';

/**
 * Card padding sizes
 */
export type CardPadding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

/**
 * Props for the Card component
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The visual style variant of the card
   * @default 'default'
   */
  variant?: CardVariant;

  /**
   * The padding size inside the card
   * @default 'md'
   */
  padding?: CardPadding;

  /**
   * Whether the card should be hoverable with elevation effect
   * @default false
   */
  hoverable?: boolean;

  /**
   * Whether the card should take full width of its container
   * @default false
   */
  fullWidth?: boolean;

  /**
   * Custom header content for the card
   */
  header?: React.ReactNode;

  /**
   * Custom footer content for the card
   */
  footer?: React.ReactNode;

  /**
   * The main content of the card
   */
  children: React.ReactNode;
}

/**
 * A reusable Card component for displaying content in a contained, styled container.
 *
 * Cards provide visual separation and grouping of related content, with support for
 * headers, footers, different variants, and hover effects.
 *
 * @example
 * ```jsx
 * // Basic card
 * <Card>
 *   <h3>Card Title</h3>
 *   <p>Card content goes here.</p>
 * </Card>
 *
 * // Card with header and footer
 * <Card
 *   header={<h3>Analytics Dashboard</h3>}
 *   footer={<Button>View Details</Button>}
 * >
 *   <ChartComponent />
 * </Card>
 *
 * // Elevated hoverable card
 * <Card variant="elevated" hoverable>
 *   <UserProfile user={user} />
 * </Card>
 * ```
 */
export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  hoverable = false,
  fullWidth = false,
  header,
  footer,
  children,
  className = '',
  ...props
}) => {
  const baseClasses = 'bg-white rounded-lg border transition-all duration-200';

  const variantClasses = {
    default: 'border-gray-200 shadow-sm',
    elevated: 'border-gray-200 shadow-lg',
    outlined: 'border-2 border-gray-300 shadow-none',
    filled: 'border-0 bg-gray-50 shadow-inner',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  };

  const hoverClasses = hoverable ? 'hover:shadow-lg hover:-translate-y-1 cursor-pointer' : '';
  const widthClass = fullWidth ? 'w-full' : '';

  const cardClasses = [
    baseClasses,
    variantClasses[variant],
    hoverClasses,
    widthClass,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={cardClasses} {...props}>
      {header && (
        <div className="border-b border-gray-200 px-4 py-3">
          {header}
        </div>
      )}

      <div className={paddingClasses[padding]}>
        {children}
      </div>

      {footer && (
        <div className="border-t border-gray-200 px-4 py-3">
          {footer}
        </div>
      )}
    </div>
  );
};

/**
 * CardHeader component for consistent card headers
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The title of the card header
   */
  title?: string;

  /**
   * Subtitle or description
   */
  subtitle?: string;

  /**
   * Action elements (buttons, icons, etc.) to display on the right
   */
  actions?: React.ReactNode;

  /**
   * Icon to display next to the title
   */
  icon?: React.ReactNode;
}

/**
 * A specialized header component for cards with title, subtitle, and actions.
 *
 * @example
 * ```typescript
 * <CardHeader
 *   title="Server Statistics"
 *   subtitle="Real-time metrics"
 *   actions={<Button size="sm">Refresh</Button>}
 * />
 * ```
 */
export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  actions,
  icon,
  className = '',
  children,
  ...props
}) => {
  const classes = `flex items-center justify-between border-b border-gray-200 px-4 py-3 ${className}`;

  return (
    <div className={classes} {...props}>
      <div className="flex items-center space-x-3">
        {icon && (
          <div className="flex-shrink-0" aria-hidden="true">
            {icon}
          </div>
        )}
        <div>
          {title && (
            <h3 className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
          )}
          {subtitle && (
            <p className="text-sm text-gray-600">
              {subtitle}
            </p>
          )}
          {children}
        </div>
      </div>

      {actions && (
        <div className="flex items-center space-x-2">
          {actions}
        </div>
      )}
    </div>
  );
};

/**
 * CardContent component for consistent card content padding
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * The padding size for the content
   * @default 'md'
   */
  padding?: CardPadding;
}

/**
 * A content wrapper for card content with consistent padding.
 *
 * @example
 * ```typescript
 * <CardContent padding="lg">
 *   <UserDetails user={user} />
 * </CardContent>
 * ```
 */
export const CardContent: React.FC<CardContentProps> = ({
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
    xl: 'p-8',
  };

  const classes = `${paddingClasses[padding]} ${className}`.trim();

  return <div className={classes} {...props} />;
};

/**
 * CardFooter component for consistent card footers
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Actions to display in the footer (typically buttons)
   */
  actions?: React.ReactNode;

  /**
   * Additional content to display on the left side
   */
  content?: React.ReactNode;
}

/**
 * A specialized footer component for cards with actions and content.
 */
export const CardFooter: React.FC<CardFooterProps> = ({
  actions,
  content,
  className = '',
  children,
  ...props
}) => {
  const classes = `flex items-center justify-between border-t border-gray-200 px-4 py-3 ${className}`;

  return (
    <div className={classes} {...props}>
      <div>
        {content}
        {children}
      </div>

      {actions && (
        <div className="flex items-center space-x-2">
          {actions}
        </div>
      )}
    </div>
  );
};

export default Card;
