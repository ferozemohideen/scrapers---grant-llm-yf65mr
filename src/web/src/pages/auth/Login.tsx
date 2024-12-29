/**
 * Login Page Component
 * 
 * Implements a secure, accessible, and responsive login interface with enhanced
 * security measures, comprehensive accessibility features, and adaptive layouts.
 * 
 * @version 1.0.0
 */

import React, { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // ^6.0.0
import { useMediaQuery } from '@mui/material'; // ^5.0.0
import LoginForm from '../../components/auth/LoginForm';
import AuthLayout, { AuthSecurityLevel } from '../../layouts/AuthLayout';
import { useAuth } from '../../hooks/useAuth';
import { BREAKPOINTS, STATUS } from '../../constants/ui.constants';
import styles from './Login.module.css';

/**
 * Enhanced login page component with security measures and accessibility features
 */
const LoginPage: React.FC = () => {
  // Navigation and authentication hooks
  const navigate = useNavigate();
  const { isAuthenticated, validateSession } = useAuth();
  
  // Component state
  const [status, setStatus] = useState<typeof STATUS[keyof typeof STATUS]>(STATUS.IDLE);
  const [sessionChecked, setSessionChecked] = useState(false);

  // Responsive design hooks
  const isMobile = useMediaQuery(`(max-width:${BREAKPOINTS.SM}px)`);
  const isTablet = useMediaQuery(`(max-width:${BREAKPOINTS.MD}px)`);

  /**
   * Session validation handler with security checks
   */
  const checkSession = useCallback(async () => {
    try {
      setStatus(STATUS.LOADING);
      await validateSession();
      setSessionChecked(true);
      
      if (isAuthenticated) {
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Session validation error:', error);
    } finally {
      setStatus(STATUS.IDLE);
    }
  }, [validateSession, isAuthenticated, navigate]);

  /**
   * Initialize security measures and session validation
   */
  useEffect(() => {
    // Set security headers
    document.title = 'Secure Login - Tech Transfer Platform';
    
    // Add CSP headers
    const metaCsp = document.createElement('meta');
    metaCsp.httpEquiv = 'Content-Security-Policy';
    metaCsp.content = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';";
    document.head.appendChild(metaCsp);

    // Validate session
    checkSession();

    return () => {
      document.head.removeChild(metaCsp);
    };
  }, [checkSession]);

  /**
   * Handle successful login with security measures
   */
  const handleLoginSuccess = useCallback(async () => {
    try {
      // Set secure session flags
      sessionStorage.setItem('login_timestamp', Date.now().toString());
      
      // Generate browser fingerprint
      const fingerprint = await generateBrowserFingerprint();
      sessionStorage.setItem('browser_fingerprint', fingerprint);

      // Navigate to dashboard
      navigate('/dashboard');
    } catch (error) {
      console.error('Login success handler error:', error);
    }
  }, [navigate]);

  /**
   * Generate secure browser fingerprint
   */
  const generateBrowserFingerprint = async (): Promise<string> => {
    const components = [
      navigator.userAgent,
      navigator.language,
      new Date().getTimezoneOffset(),
      screen.colorDepth,
      navigator.hardwareConcurrency
    ];
    
    const fingerprintData = components.join('|');
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Compute responsive classes
  const containerClasses = [
    styles['login-page'],
    isMobile && styles['login-page--mobile'],
    isTablet && styles['login-page--tablet']
  ].filter(Boolean).join(' ');

  return (
    <AuthLayout
      title="Sign In"
      className={containerClasses}
      securityLevel={AuthSecurityLevel.MEDIUM}
    >
      <div 
        className={styles['login-page__content']}
        role="main"
        aria-labelledby="login-title"
      >
        <h1 
          id="login-title" 
          className={styles['login-page__title']}
          tabIndex={-1}
        >
          Welcome Back
        </h1>

        <div className={styles['login-page__form-container']}>
          <LoginForm
            onSuccess={handleLoginSuccess}
            className={styles['login-page__form']}
          />
        </div>

        <div className={styles['login-page__links']}>
          <a 
            href="/forgot-password"
            className={styles['login-page__forgot-link']}
            aria-label="Reset your password"
          >
            Forgot Password?
          </a>
          <a 
            href="/register"
            className={styles['login-page__register-link']}
            aria-label="Create a new account"
          >
            Create Account
          </a>
        </div>

        {/* Screen reader announcements */}
        <div 
          className="sr-only" 
          role="status" 
          aria-live="polite"
        >
          {status === STATUS.LOADING && 'Verifying your session...'}
          {sessionChecked && 'Session verification complete'}
        </div>
      </div>
    </AuthLayout>
  );
};

export default LoginPage;