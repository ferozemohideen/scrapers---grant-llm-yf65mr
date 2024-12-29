/**
 * @fileoverview UI Constants
 * @version 1.0.0
 * 
 * Centralized UI constants for maintaining consistent styling, behavior,
 * and configuration across the web application's components.
 */

/**
 * Component status constants for consistent state management
 */
export const STATUS = {
  IDLE: 'idle',
  LOADING: 'loading',
  SUCCESS: 'success',
  ERROR: 'error'
} as const;

/**
 * Modal component configuration constants
 */
export const MODAL = {
  SIZES: {
    SM: 'sm',
    MD: 'md',
    LG: 'lg',
    FULL: 'full'
  },
  TRANSITIONS: {
    FADE: 'fade',
    SLIDE: 'slide',
    SCALE: 'scale'
  }
} as const;

/**
 * Toast notification configuration constants
 */
export const TOAST = {
  TYPES: {
    SUCCESS: 'success',
    ERROR: 'error',
    WARNING: 'warning',
    INFO: 'info'
  },
  POSITIONS: {
    TOP_RIGHT: 'top-right',
    TOP_LEFT: 'top-left',
    BOTTOM_RIGHT: 'bottom-right',
    BOTTOM_LEFT: 'bottom-left'
  },
  DURATIONS: {
    SHORT: 3000,
    MEDIUM: 5000,
    LONG: 8000
  }
} as const;

/**
 * Theme configuration constants
 */
export const THEME = {
  LIGHT: 'light',
  DARK: 'dark'
} as const;

/**
 * Responsive design breakpoint constants (in pixels)
 */
export const BREAKPOINTS = {
  SM: 768,  // Mobile breakpoint
  MD: 1024, // Tablet breakpoint
  LG: 1280, // Desktop breakpoint
  XL: 1536  // Large desktop breakpoint
} as const;

/**
 * Accessibility configuration constants
 * Follows WAI-ARIA standards for improved accessibility
 */
export const ACCESSIBILITY = {
  ROLES: {
    DIALOG: 'dialog',
    ALERT: 'alert',
    NAVIGATION: 'navigation'
  },
  LABELS: {
    CLOSE: 'Close',
    MENU: 'Menu',
    SEARCH: 'Search'
  },
  KEYBOARD: {
    ESCAPE: 'Escape',
    ENTER: 'Enter',
    TAB: 'Tab'
  }
} as const;

/**
 * Animation timing and easing constants
 */
export const ANIMATION = {
  DURATIONS: {
    FAST: 150,    // Quick transitions
    NORMAL: 300,  // Standard transitions
    SLOW: 500     // Elaborate transitions
  },
  EASINGS: {
    DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)', // Material Design standard easing
    IN: 'cubic-bezier(0.4, 0, 1, 1)',        // Acceleration curve
    OUT: 'cubic-bezier(0, 0, 0.2, 1)'        // Deceleration curve
  }
} as const;

/**
 * Z-index hierarchy constants
 * Defines stacking order for overlapping elements
 */
export const Z_INDEX = {
  MODAL: 1000,    // Modal dialogs
  TOAST: 2000,    // Toast notifications
  DROPDOWN: 500   // Dropdown menus
} as const;

// Type definitions for better TypeScript support
export type Status = typeof STATUS[keyof typeof STATUS];
export type ModalSize = typeof MODAL.SIZES[keyof typeof MODAL.SIZES];
export type ModalTransition = typeof MODAL.TRANSITIONS[keyof typeof MODAL.TRANSITIONS];
export type ToastType = typeof TOAST.TYPES[keyof typeof TOAST.TYPES];
export type ToastPosition = typeof TOAST.POSITIONS[keyof typeof TOAST.POSITIONS];
export type Theme = typeof THEME[keyof typeof THEME];
export type AccessibilityRole = typeof ACCESSIBILITY.ROLES[keyof typeof ACCESSIBILITY.ROLES];