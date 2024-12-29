/**
 * @fileoverview Enhanced Alert Component with Accessibility Features
 * @version 1.0.0
 * 
 * A reusable Alert component for displaying status messages, notifications,
 * and feedback with comprehensive accessibility support including ARIA labels,
 * keyboard navigation, and focus management.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import classNames from 'classnames'; /* @version 2.3.0 */
import { STATUS } from '../../constants/ui.constants';

import styles from './Alert.module.css';

// Alert variant type definition
export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

// Comprehensive props interface with accessibility features
export interface AlertProps {
  /** The message to display in the alert */
  message: string;
  /** The visual and semantic variant of the alert */
  variant: AlertVariant;
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Optional callback when alert is closed */
  onClose?: () => void;
  /** Optional auto-close duration in milliseconds */
  autoClose?: number;
  /** Whether to show the status icon */
  showIcon?: boolean;
  /** Data test id for testing */
  testId?: string;
  /** ARIA role for accessibility */
  role?: 'alert' | 'status' | 'log';
  /** Whether the alert can receive focus */
  focusable?: boolean;
  /** Whether to close on Escape key */
  closeOnEscape?: boolean;
  /** Whether to auto-focus the alert */
  autoFocus?: boolean;
  /** ARIA live region behavior */
  live?: 'polite' | 'assertive';
  /** RTL support */
  rtl?: boolean;
}

/**
 * Alert component for displaying accessible status messages
 */
export const Alert: React.FC<AlertProps> = ({
  message,
  variant,
  className,
  onClose,
  autoClose = 0,
  showIcon = true,
  testId = 'alert',
  role = 'alert',
  focusable = true,
  closeOnEscape = true,
  autoFocus = false,
  live = 'polite',
  rtl = false,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const alertRef = useRef<HTMLDivElement>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout>();

  // Get appropriate icon based on variant
  const getIcon = useCallback(() => {
    switch (variant) {
      case 'success':
        return '✓';
      case 'error':
        return '⚠';
      case 'warning':
        return '!';
      case 'info':
        return 'i';
      default:
        return null;
    }
  }, [variant]);

  // Handle alert closure
  const handleClose = useCallback(() => {
    setIsVisible(false);
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
    }
    if (onClose) {
      onClose();
    }
  }, [onClose]);

  // Handle keyboard interactions
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (closeOnEscape && event.key === 'Escape') {
      event.preventDefault();
      handleClose();
    }
  }, [closeOnEscape, handleClose]);

  // Get alert styles based on variant
  const getAlertStyles = useCallback(() => {
    return classNames(
      styles.alert,
      styles[`alert--${variant}`],
      {
        [styles['alert--rtl']]: rtl,
        [styles['alert--focusable']]: focusable,
      },
      className
    );
  }, [variant, rtl, focusable, className]);

  // Set up auto-close timer
  useEffect(() => {
    if (autoClose > 0) {
      autoCloseTimerRef.current = setTimeout(() => {
        handleClose();
      }, autoClose);
    }

    return () => {
      if (autoCloseTimerRef.current) {
        clearTimeout(autoCloseTimerRef.current);
      }
    };
  }, [autoClose, handleClose]);

  // Handle auto-focus
  useEffect(() => {
    if (autoFocus && alertRef.current) {
      alertRef.current.focus();
    }
  }, [autoFocus]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      ref={alertRef}
      className={getAlertStyles()}
      role={role}
      aria-live={live}
      aria-atomic="true"
      data-testid={testId}
      tabIndex={focusable ? 0 : -1}
      onKeyDown={handleKeyDown}
      dir={rtl ? 'rtl' : 'ltr'}
    >
      {showIcon && (
        <span className={styles.alert__icon} aria-hidden="true">
          {getIcon()}
        </span>
      )}
      
      <div className={styles.alert__content}>
        {message}
      </div>

      {onClose && (
        <button
          type="button"
          className={styles.alert__close}
          onClick={handleClose}
          aria-label="Close alert"
          data-testid={`${testId}-close`}
        >
          ×
        </button>
      )}
    </div>
  );
};

// Default export for convenient importing
export default Alert;