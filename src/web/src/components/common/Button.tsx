import React, { useCallback } from 'react';
import classNames from 'classnames';
import '../../assets/styles/variables.css';

/**
 * Props interface for the Button component
 * @interface ButtonProps
 */
interface ButtonProps {
  /** Button content (text, icons, or other elements) */
  children: React.ReactNode;
  /** Visual style variant of the button */
  variant?: 'primary' | 'secondary' | 'outline' | 'text';
  /** Size variant affecting padding and font size */
  size?: 'sm' | 'md' | 'lg';
  /** Disabled state preventing interactions */
  disabled?: boolean;
  /** Loading state showing spinner and preventing interactions */
  loading?: boolean;
  /** Click event handler with error boundary protection */
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  /** HTML button type attribute */
  type?: 'button' | 'submit' | 'reset';
  /** Additional CSS classes for customization */
  className?: string;
  /** Custom aria-label for improved accessibility */
  ariaLabel?: string;
}

// Button style variants mapping
const buttonVariants = {
  primary: `
    bg-[var(--primary-color)]
    text-white
    hover:bg-[var(--primary-color-dark)]
    focus:ring-2
    focus:ring-[var(--focus-ring-color)]
    transition-colors
    duration-[var(--duration-normal)]
  `,
  secondary: `
    bg-[var(--secondary-color)]
    text-white
    hover:opacity-90
    focus:ring-2
    focus:ring-[var(--focus-ring-color)]
    transition-colors
    duration-[var(--duration-normal)]
  `,
  outline: `
    border-2
    border-[var(--primary-color)]
    text-[var(--primary-color)]
    hover:bg-[var(--primary-color-light)]
    hover:text-white
    focus:ring-2
    focus:ring-[var(--focus-ring-color)]
    transition-colors
    duration-[var(--duration-normal)]
  `,
  text: `
    text-[var(--primary-color)]
    hover:bg-[var(--primary-color-light)]
    hover:bg-opacity-10
    focus:ring-2
    focus:ring-[var(--focus-ring-color)]
    transition-colors
    duration-[var(--duration-normal)]
  `,
};

// Button size variants mapping
const buttonSizes = {
  sm: 'px-3 py-1.5 text-sm min-h-[32px]',
  md: 'px-4 py-2 text-base min-h-[40px]',
  lg: 'px-6 py-3 text-lg min-h-[48px]',
};

/**
 * Button component that provides consistent styling and behavior across the application
 * with full accessibility support and various visual states.
 *
 * @component
 * @example
 * ```tsx
 * <Button
 *   variant="primary"
 *   size="md"
 *   onClick={() => console.log('clicked')}
 *   ariaLabel="Save changes"
 * >
 *   Save
 * </Button>
 * ```
 */
const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  type = 'button',
  className,
  ariaLabel,
}) => {
  // Safe click handler with error boundary
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (disabled || loading) return;
      try {
        onClick?.(event);
      } catch (error) {
        console.error('Button click handler error:', error);
      }
    },
    [disabled, loading, onClick]
  );

  // Detect high contrast mode
  const isHighContrast = window.matchMedia('(forced-colors: active)').matches;

  // Compose button classes
  const buttonClasses = classNames(
    // Base styles
    'inline-flex items-center justify-center',
    'rounded-[var(--border-radius-md)]',
    'font-[var(--font-weight-medium)]',
    'focus:outline-none',
    'select-none',
    'relative',
    // Variant styles
    buttonVariants[variant],
    // Size styles
    buttonSizes[size],
    // State styles
    {
      'opacity-50 cursor-not-allowed': disabled,
      'cursor-wait': loading,
      // High contrast mode styles
      'border-2 border-current': isHighContrast,
    },
    // Custom classes
    className
  );

  // Loading spinner component
  const LoadingSpinner = () => (
    <svg
      className="animate-spin -ml-1 mr-2 h-4 w-4"
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
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );

  return (
    <button
      type={type}
      className={buttonClasses}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      aria-label={ariaLabel}
      role="button"
      tabIndex={disabled ? -1 : 0}
    >
      {loading && <LoadingSpinner />}
      <span className={loading ? 'opacity-75' : ''}>
        {children}
      </span>
    </button>
  );
};

export default Button;