/**
 * ResetPassword Page Component
 * 
 * Implements secure password reset functionality with comprehensive validation,
 * rate limiting, CSRF protection, and accessibility features.
 * 
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { IResetPasswordFormProps } from '../../components/auth/ResetPasswordForm';
import AuthLayout, { AuthSecurityLevel } from '../../layouts/AuthLayout';
import useToast from '../../hooks/useToast';
import AuthService from '../../services/auth.service';

/**
 * Enhanced ResetPassword page component with security measures and accessibility
 */
const ResetPassword: React.FC = React.memo(() => {
  // Navigation and URL parameters
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const resetToken = searchParams.get('token');

  // State management
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const { showToast } = useToast();

  // Security tracking
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;
  const LOCKOUT_DURATION = 300000; // 5 minutes

  /**
   * Validates reset token on component mount
   */
  useEffect(() => {
    let isSubscribed = true;

    const validateToken = async () => {
      if (!resetToken) {
        showToast({
          type: 'error',
          message: 'Reset token is missing',
          duration: 5000
        });
        navigate('/auth/login');
        return;
      }

      try {
        const isValid = await AuthService.validateResetToken(resetToken);
        
        if (isSubscribed) {
          setIsTokenValid(isValid);
          if (!isValid) {
            showToast({
              type: 'error',
              message: 'Invalid or expired reset token',
              duration: 5000
            });
            navigate('/auth/login');
          }
        }
      } catch (error) {
        if (isSubscribed) {
          console.error('Token validation error:', error);
          showToast({
            type: 'error',
            message: 'Error validating reset token',
            duration: 5000
          });
          navigate('/auth/login');
        }
      } finally {
        if (isSubscribed) {
          setIsValidating(false);
        }
      }
    };

    validateToken();

    return () => {
      isSubscribed = false;
    };
  }, [resetToken, navigate, showToast]);

  /**
   * Handles successful password reset
   */
  const handleResetSuccess = useCallback(() => {
    // Clear sensitive data
    setAttempts(0);
    
    showToast({
      type: 'success',
      message: 'Password has been successfully reset',
      duration: 5000
    });

    // Invalidate the used token
    if (resetToken) {
      AuthService.invalidateResetToken(resetToken).catch(console.error);
    }

    // Redirect to login
    navigate('/auth/login', {
      state: { message: 'Please login with your new password' }
    });
  }, [navigate, resetToken, showToast]);

  /**
   * Handles password reset errors with rate limiting
   */
  const handleResetError = useCallback((error: Error) => {
    setAttempts(prev => {
      const newAttempts = prev + 1;
      
      if (newAttempts >= MAX_ATTEMPTS) {
        // Store lockout timestamp
        sessionStorage.setItem('resetLockout', Date.now().toString());
        
        showToast({
          type: 'error',
          message: `Too many attempts. Please try again in ${LOCKOUT_DURATION / 60000} minutes`,
          duration: 5000
        });
        
        navigate('/auth/login');
      } else {
        showToast({
          type: 'error',
          message: `Reset failed. ${MAX_ATTEMPTS - newAttempts} attempts remaining`,
          duration: 5000
        });
      }
      
      return newAttempts;
    });
  }, [navigate, showToast]);

  /**
   * Check if user is currently locked out
   */
  const checkLockout = useCallback((): boolean => {
    const lockoutTime = sessionStorage.getItem('resetLockout');
    if (lockoutTime) {
      const timeElapsed = Date.now() - parseInt(lockoutTime);
      if (timeElapsed < LOCKOUT_DURATION) {
        return true;
      }
      sessionStorage.removeItem('resetLockout');
    }
    return false;
  }, []);

  // Render loading state
  if (isValidating) {
    return (
      <AuthLayout 
        title="Reset Password"
        securityLevel={AuthSecurityLevel.HIGH}
      >
        <div 
          role="status"
          aria-live="polite"
          className="text-center"
        >
          Validating reset token...
        </div>
      </AuthLayout>
    );
  }

  // Check lockout before rendering form
  if (checkLockout()) {
    return (
      <AuthLayout 
        title="Access Locked"
        securityLevel={AuthSecurityLevel.HIGH}
      >
        <div 
          role="alert"
          className="text-center text-red-600"
        >
          Too many attempts. Please try again later.
        </div>
      </AuthLayout>
    );
  }

  // Main reset password form
  const formProps: IResetPasswordFormProps = {
    token: resetToken || '',
    onSuccess: handleResetSuccess,
    onError: handleResetError,
    maxAttempts: MAX_ATTEMPTS,
    minPasswordStrength: 3
  };

  return (
    <AuthLayout 
      title="Reset Password"
      securityLevel={AuthSecurityLevel.HIGH}
    >
      <div 
        role="main"
        aria-labelledby="reset-password-title"
      >
        <h1 
          id="reset-password-title"
          className="sr-only"
        >
          Reset Password
        </h1>
        
        {isTokenValid && (
          <ResetPasswordForm {...formProps} />
        )}
      </div>
    </AuthLayout>
  );
});

ResetPassword.displayName = 'ResetPassword';

export default ResetPassword;