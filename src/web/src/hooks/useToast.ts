import { useCallback } from 'react'; // ^18.0.0
import { useToastContext } from '../contexts/ToastContext';

/**
 * Type definition for toast notification positions
 */
export type ToastPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';

/**
 * Type definition for toast notification types
 */
export type ToastType = 'success' | 'error' | 'warning' | 'info';

/**
 * Configuration interface for toast notifications with comprehensive accessibility support
 */
export interface ToastConfig {
  /** Type of toast affecting styling and screen reader announcement */
  type: ToastType;
  /** Message to display in the toast - must be non-empty */
  message: string;
  /** Optional duration in milliseconds before auto-hide (defaults to 3000ms) */
  duration?: number;
  /** Position of toast on screen (defaults to 'top-right') */
  position?: ToastPosition;
  /** Optional custom aria-label for screen readers */
  ariaLabel?: string;
}

/**
 * Return type for the useToast hook containing memoized toast management functions
 */
export interface UseToastReturn {
  /** Display a new toast notification */
  showToast: (config: ToastConfig) => void;
  /** Hide a specific toast by ID */
  hideToast: (id: string) => void;
  /** Remove all active toast notifications */
  clearAllToasts: () => void;
}

/**
 * Custom hook for managing toast notifications throughout the application
 * 
 * @returns Object containing memoized toast management functions
 * @throws Error if used outside of ToastProvider context
 * 
 * @example
 * ```tsx
 * const { showToast } = useToast();
 * 
 * // Show a success toast
 * showToast({
 *   type: 'success',
 *   message: 'Operation completed successfully',
 *   position: 'top-right'
 * });
 * ```
 */
export const useToast = (): UseToastReturn => {
  // Get toast context with error boundary protection
  const context = useToastContext();

  /**
   * Validates toast configuration at runtime
   * @param config - Toast configuration to validate
   * @throws Error if configuration is invalid
   */
  const validateToastConfig = (config: ToastConfig): void => {
    if (!config.message || config.message.trim() === '') {
      throw new Error('Toast message cannot be empty');
    }

    if (config.duration !== undefined && (
      typeof config.duration !== 'number' || 
      config.duration < 0
    )) {
      throw new Error('Toast duration must be a positive number');
    }
  };

  /**
   * Memoized function to show a new toast notification
   */
  const showToast = useCallback((config: ToastConfig): void => {
    // Validate configuration before showing toast
    validateToastConfig(config);

    // Generate appropriate aria-label if not provided
    const ariaLabel = config.ariaLabel || `${config.type} notification: ${config.message}`;

    // Show toast with validated config
    context.showToast({
      ...config,
      message: config.message.trim(),
      ariaLabel
    });
  }, [context]);

  /**
   * Memoized function to hide a specific toast by ID
   */
  const hideToast = useCallback((id: string): void => {
    if (!id) {
      throw new Error('Toast ID is required for hiding');
    }
    context.hideToast(id);
  }, [context]);

  /**
   * Memoized function to clear all active toasts
   */
  const clearAllToasts = useCallback((): void => {
    context.clearAllToasts();
  }, [context]);

  return {
    showToast,
    hideToast,
    clearAllToasts
  };
};

/**
 * Default export for convenient importing
 */
export default useToast;