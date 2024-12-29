import React, { useCallback, useRef } from 'react';
import classnames from 'classnames';
import '../../assets/styles/variables.css';

/**
 * Props interface for the Card component with enhanced accessibility and interaction support
 * @interface CardProps
 */
interface CardProps {
  /** Card content */
  children: React.ReactNode;
  /** Visual style variant of the card */
  variant?: 'default' | 'outlined' | 'elevated' | 'interactive';
  /** Optional header content */
  header?: React.ReactNode;
  /** Optional footer content */
  footer?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Optional click handler for interactive cards */
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  /** Keyboard event handler for accessibility */
  onKeyPress?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  /** ARIA role for accessibility */
  role?: string;
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /** Test identifier for automated testing */
  'data-testid'?: string;
}

/**
 * Card variants styling configuration
 */
const cardVariants = {
  default: 'bg-white border border-border-color dark:bg-gray-800 dark:border-gray-700',
  outlined: 'bg-white border-2 border-primary-color dark:bg-gray-800 dark:border-primary-400',
  elevated: 'bg-white shadow-md hover:shadow-lg transition-shadow dark:bg-gray-800',
  interactive: 'bg-white hover:bg-gray-50 cursor-pointer transition-colors dark:bg-gray-800 dark:hover:bg-gray-700'
};

/**
 * Card section styling configuration
 */
const cardSections = {
  header: 'px-4 py-3 border-b border-border-color font-medium dark:border-gray-700',
  content: 'p-4 focus-within:ring-2 focus-within:ring-primary-200',
  footer: 'px-4 py-3 border-t border-border-color bg-background-color-dark dark:bg-gray-900 dark:border-gray-700'
};

/**
 * A reusable card component that provides a contained, styled container for content
 * with support for headers, footers, and various visual styles.
 * 
 * @component
 * @example
 * ```tsx
 * <Card
 *   variant="elevated"
 *   header={<h2>Card Title</h2>}
 *   footer={<button>Action</button>}
 *   aria-label="Example card"
 * >
 *   <p>Card content goes here</p>
 * </Card>
 * ```
 */
const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  header,
  footer,
  className,
  onClick,
  onKeyPress,
  role = 'article',
  'aria-label': ariaLabel,
  'data-testid': testId,
  ...rest
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Handle keyboard navigation for interactive cards
  const handleKeyPress = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (onClick && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onClick(event as unknown as React.MouseEvent<HTMLDivElement>);
    }
    onKeyPress?.(event);
  }, [onClick, onKeyPress]);

  // Compose CSS classes
  const cardClasses = classnames(
    // Base styles
    'rounded-md overflow-hidden transition-all duration-normal',
    // Variant styles
    cardVariants[variant],
    // Interactive styles
    {
      'focus:outline-none focus:ring-2 focus:ring-primary-color focus:ring-offset-2': variant === 'interactive',
      'cursor-pointer': onClick
    },
    className
  );

  return (
    <div
      ref={cardRef}
      className={cardClasses}
      onClick={onClick}
      onKeyPress={handleKeyPress}
      role={role}
      aria-label={ariaLabel}
      data-testid={testId}
      tabIndex={onClick ? 0 : undefined}
      {...rest}
    >
      {/* Header Section */}
      {header && (
        <div 
          className={cardSections.header}
          role="heading"
        >
          {header}
        </div>
      )}

      {/* Content Section */}
      <div className={cardSections.content}>
        {children}
      </div>

      {/* Footer Section */}
      {footer && (
        <div className={cardSections.footer}>
          {footer}
        </div>
      )}
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default React.memo(Card);

// Type export for consumers
export type { CardProps };