/**
 * Register Page Component
 * 
 * A secure, accessible, and responsive registration page that implements comprehensive
 * validation, error handling, loading states, and proper authentication flow integration.
 * 
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.0.0
import { ErrorBoundary } from 'react-error-boundary'; // v3.1.4

// Internal imports
import { RegisterForm, IRegisterFormProps } from '../../components/auth/RegisterForm';
import { AuthLayout } from '../../layouts/AuthLayout';
import { useAuth } from '../../hooks/useAuth';
import { BREAKPOINTS } from '../../constants/ui.constants';
import { AUTH_STATES } from '../../constants/auth.constants';
import { IUser, IAuthError } from '../../interfaces/auth.interface';

// CSS Module import
import styles from './Register.module.css';

/**
 * Error Fallback component for the registration page
 */
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div 
    className={styles['register-page__error']}
    role="alert"
    aria-live="assertive"
  >
    <h2>Registration Error</h2>
    <p>{error.message}</p>
    <button onClick={() => window.location.reload()}>Try Again</button>
  </div>
);

/**
 * Register page component with comprehensive security and accessibility features
 */
const Register: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, error: authError } = useAuth();
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect authenticated users
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  /**
   * Handles successful registration
   */
  const handleRegistrationSuccess = useCallback(async (user: IUser) => {
    try {
      setIsSubmitting(true);
      // Additional success handling (e.g., analytics)
      navigate('/dashboard');
    } catch (error) {
      console.error('Registration success handler error:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [navigate]);

  /**
   * Handles registration errors
   */
  const handleRegistrationError = useCallback((error: IAuthError) => {
    setRegistrationError(error.message);
    setIsSubmitting(false);

    // Announce error to screen readers
    const errorMessage = document.getElementById('registration-error');
    if (errorMessage) {
      errorMessage.focus();
    }
  }, []);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <AuthLayout
        title="Create Account"
        className={styles['register-page']}
        securityLevel="MEDIUM"
      >
        <div 
          className={styles['register-page__content']}
          role="main"
          aria-labelledby="register-title"
        >
          <h1 
            id="register-title" 
            className={styles['register-page__title']}
            tabIndex={-1}
          >
            Create Your Account
          </h1>

          {/* Error display */}
          {(registrationError || authError) && (
            <div
              id="registration-error"
              className={styles['register-page__error']}
              role="alert"
              aria-live="assertive"
              tabIndex={-1}
            >
              {registrationError || authError}
            </div>
          )}

          {/* Loading state */}
          {isSubmitting && (
            <div 
              className={styles['register-page__loading']}
              aria-live="polite"
            >
              Processing your registration...
            </div>
          )}

          {/* Registration form */}
          <RegisterForm
            onSuccess={handleRegistrationSuccess}
            onError={handleRegistrationError}
            className={styles['register-page__form']}
          />

          {/* Login link */}
          <div className={styles['register-page__login-link']}>
            Already have an account?{' '}
            <a 
              href="/login"
              className={styles['register-page__link']}
              onClick={(e) => {
                e.preventDefault();
                navigate('/login');
              }}
            >
              Log in here
            </a>
          </div>
        </div>
      </AuthLayout>
    </ErrorBoundary>
  );
};

// CSS Module definitions
const styles = {
  'register-page': `
    min-height: 100vh
    bg-background-color
    flex
    flex-col
    items-center
    justify-center
    p-4
    sm:p-6
    md:p-8
  `,
  'register-page__content': `
    w-full
    max-w-md
    space-y-6
  `,
  'register-page__title': `
    text-2xl
    font-bold
    text-center
    mb-8
  `,
  'register-page__error': `
    bg-error-color
    text-white
    p-4
    rounded-md
    mb-6
  `,
  'register-page__loading': `
    text-center
    text-text-color-light
    my-4
  `,
  'register-page__form': `
    w-full
  `,
  'register-page__login-link': `
    text-center
    mt-6
    text-text-color-light
  `,
  'register-page__link': `
    text-primary-color
    hover:text-primary-color-dark
    transition-colors
    duration-200
  `
} as const;

Register.displayName = 'RegisterPage';

export default Register;