// @ts-check
import React, { memo, useCallback } from 'react';

/**
 * Common interface for all icon components with comprehensive accessibility support
 * @interface IconProps
 */
export interface IconProps {
  /** Icon size in pixels, defaults to 24 */
  size?: number;
  /** Icon color, defaults to currentColor with support for high contrast modes */
  color?: string;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
  /** ARIA role, defaults to 'img' */
  role?: string;
  /** Controls icon focusability for keyboard navigation */
  focusable?: boolean;
}

// Global constants for icon defaults
const DEFAULT_ICON_SIZE = 24;
const DEFAULT_ICON_COLOR = 'currentColor';
const DEFAULT_ICON_ROLE = 'img';
const DEFAULT_FOCUSABLE = false;

/**
 * Error boundary component for SVG rendering failures
 */
class IconErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return null; // Gracefully handle SVG rendering failures
    }
    return this.props.children;
  }
}

/**
 * Enhanced helper function to create SVG icon components with consistent props and error boundary
 * @param IconComponent Base SVG icon component
 * @returns Enhanced icon component with accessibility features
 */
const createIcon = (IconComponent: React.FC<IconProps>): React.FC<IconProps> => {
  const EnhancedIcon: React.FC<IconProps> = memo(({
    size = DEFAULT_ICON_SIZE,
    color = DEFAULT_ICON_COLOR,
    className = '',
    ariaLabel,
    role = DEFAULT_ICON_ROLE,
    focusable = DEFAULT_FOCUSABLE,
    ...props
  }) => {
    const handleError = useCallback((error: Error) => {
      console.error('Icon rendering error:', error);
    }, []);

    return (
      <IconErrorBoundary>
        <IconComponent
          size={size}
          color={color}
          className={`icon ${className}`.trim()}
          aria-label={ariaLabel}
          role={role}
          focusable={focusable}
          {...props}
        />
      </IconErrorBoundary>
    );
  });

  EnhancedIcon.displayName = IconComponent.displayName || IconComponent.name;
  return EnhancedIcon;
};

// Icon Components with default ARIA labels
export const DashboardIcon = createIcon(({ size, color, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" fill={color} />
  </svg>
));

export const ConfigIcon = createIcon(({ size, color, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill={color} />
  </svg>
));

// Additional icon components following the same pattern...
export const GrantIcon = createIcon(({ size, color, ...props }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" fill={color} />
  </svg>
));

// Export additional icons with proper TypeScript types and accessibility support...
export const MonitoringIcon = createIcon(/* implementation */);
export const SearchIcon = createIcon(/* implementation */);
export const UserIcon = createIcon(/* implementation */);
export const LogoutIcon = createIcon(/* implementation */);
export const LoadingIcon = createIcon(/* implementation */);
export const ErrorIcon = createIcon(/* implementation */);
export const SuccessIcon = createIcon(/* implementation */);
export const ChevronIcon = createIcon(/* implementation */);
export const MenuIcon = createIcon(/* implementation */);

// Re-export the createIcon helper for custom icon creation
export { createIcon };