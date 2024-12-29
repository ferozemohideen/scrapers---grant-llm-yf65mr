/**
 * AuthLayout Component
 * 
 * A specialized layout component for authentication-related pages that provides
 * a secure, accessible, and responsive interface with comprehensive security measures.
 * 
 * @version 1.0.0
 */

import React, { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mui/material';
import { useAuth } from '../../hooks/useAuth';
import { BREAKPOINTS } from '../../constants/ui.constants';
import styles from './AuthLayout.module.css';

/**
 * Security level enum for different authentication pages
 */
export enum AuthSecurityLevel {
  HIGH = 'high',     // For sensitive operations (password change, etc.)
  MEDIUM = 'medium', // For standard auth operations (login, register)
  LOW = 'low'       // For public auth pages (password reset request)
}

/**
 * Props interface for the AuthLayout component
 */
interface IAuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  securityLevel?: AuthSecurityLevel;
}

/**
 * Secure and accessible authentication layout component
 */
const AuthLayout: React.FC<IAuthLayoutProps> = ({
  children,
  title,
  className,
  securityLevel = AuthSecurityLevel.MEDIUM
}) => {
  // Authentication hooks and state
  const { authState, validateSession } = useAuth();
  const navigate = useNavigate();

  // Responsive design hooks
  const isMobile = useMediaQuery(`(max-width:${BREAKPOINTS.SM}px)`);
  const isTablet = useMediaQuery(`(max-width:${BREAKPOINTS.MD}px)`);

  /**
   * Session validation handler
   */
  const handleSessionValidation = useCallback(async () => {
    try {
      await validateSession();
      if (authState.status === 'authenticated') {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Session validation error:', error);
    }
  }, [validateSession, authState.status, navigate]);

  /**
   * Initialize session validation and security measures
   */
  useEffect(() => {
    handleSessionValidation();

    // Set up security headers and CSP
    if (securityLevel === AuthSecurityLevel.HIGH) {
      document.querySelector('meta[http-equiv="Content-Security-Policy"]')
        ?.setAttribute('content', "default-src 'self'; script-src 'self'");
    }

    return () => {
      // Cleanup security measures
      if (securityLevel === AuthSecurityLevel.HIGH) {
        document.querySelector('meta[http-equiv="Content-Security-Policy"]')
          ?.setAttribute('content', '');
      }
    };
  }, [handleSessionValidation, securityLevel]);

  /**
   * Keyboard navigation handler
   */
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      navigate('/');
    }
  }, [navigate]);

  /**
   * Set up keyboard listeners
   */
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  /**
   * Compute container classes based on responsive state
   */
  const containerClasses = [
    styles['auth-layout'],
    isMobile && styles['auth-layout--mobile'],
    isTablet && styles['auth-layout--tablet'],
    className
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={containerClasses}
      role="main"
      aria-label="Authentication page"
    >
      <div 
        className={styles['auth-layout__container']}
        aria-live="polite"
        aria-atomic="true"
      >
        {title && (
          <h1 
            className={styles['auth-layout__title']}
            id="auth-title"
            tabIndex={-1}
          >
            {title}
          </h1>
        )}
        
        <div 
          className={styles['auth-layout__content']}
          aria-describedby="auth-description"
          role="region"
        >
          {children}
        </div>

        {/* Hidden description for screen readers */}
        <div id="auth-description" className="sr-only">
          Secure authentication area. Please ensure you're on a private device.
        </div>
      </div>
    </div>
  );
};

// Apply security and performance optimizations
export default React.memo(AuthLayout);