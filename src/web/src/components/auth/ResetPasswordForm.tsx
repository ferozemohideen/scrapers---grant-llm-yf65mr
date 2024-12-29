import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.0.0
import zxcvbn from 'zxcvbn'; // v4.4.2
import Form, { FormProps } from '../common/Form';
import Input from '../common/Input';
import AuthService from '../../services/auth.service';
import styles from './ResetPasswordForm.module.css';

/**
 * Props interface for ResetPasswordForm component
 */
export interface IResetPasswordFormProps {
  token: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  maxAttempts?: number;
  minPasswordStrength?: number;
}

/**
 * Interface for form values with validation
 */
interface IResetPasswordFormValues {
  password: string;
  confirmPassword: string;
  passwordStrength: number;
  attempts: number;
}

/**
 * Enhanced React component for secure password reset functionality
 * Implements comprehensive validation, security measures, and accessibility features
 */
export const ResetPasswordForm: React.FC<IResetPasswordFormProps> = ({
  token,
  onSuccess,
  onError,
  maxAttempts = 3,
  minPasswordStrength = 3
}) => {
  const navigate = useNavigate();
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempts, setAttempts] = useState(0);

  // Initial form values
  const initialValues: IResetPasswordFormValues = {
    password: '',
    confirmPassword: '',
    passwordStrength: 0,
    attempts: 0
  };

  /**
   * Validates reset token on component mount
   */
  useEffect(() => {
    const validateToken = async () => {
      try {
        const isValid = await AuthService.validateResetToken(token);
        setIsTokenValid(isValid);
      } catch (error) {
        onError?.(error as Error);
        navigate('/auth/login');
      } finally {
        setLoading(false);
      }
    };

    validateToken();
  }, [token, navigate, onError]);

  /**
   * Enhanced password validation with security checks
   */
  const validatePassword = useCallback((password: string): string | undefined => {
    if (!password) {
      return 'Password is required';
    }

    // Check minimum length
    if (password.length < 12) {
      return 'Password must be at least 12 characters long';
    }

    // Check character requirements
    if (!/[A-Z]/.test(password)) {
      return 'Password must contain at least one uppercase letter';
    }
    if (!/[a-z]/.test(password)) {
      return 'Password must contain at least one lowercase letter';
    }
    if (!/\d/.test(password)) {
      return 'Password must contain at least one number';
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      return 'Password must contain at least one special character';
    }

    // Check password strength using zxcvbn
    const result = zxcvbn(password);
    if (result.score < minPasswordStrength) {
      return 'Password is too weak. Please choose a stronger password.';
    }

    return undefined;
  }, [minPasswordStrength]);

  /**
   * Validation schema for the form
   */
  const validationSchema = {
    password: validatePassword,
    confirmPassword: (value: string, allValues: Record<string, any>) => {
      if (!value) {
        return 'Please confirm your password';
      }
      if (value !== allValues.password) {
        return 'Passwords do not match';
      }
      return undefined;
    }
  };

  /**
   * Handles form submission with security measures
   */
  const handleSubmit = async (values: IResetPasswordFormValues) => {
    try {
      // Check rate limiting
      const canAttempt = await AuthService.checkResetAttempts(token);
      if (!canAttempt) {
        throw new Error('Too many attempts. Please try again later.');
      }

      setAttempts(prev => prev + 1);
      
      if (attempts >= maxAttempts) {
        throw new Error('Maximum password reset attempts exceeded');
      }

      await AuthService.resetPassword(token, values.password);
      onSuccess?.();
      navigate('/auth/login', { state: { message: 'Password reset successful' } });
    } catch (error) {
      onError?.(error as Error);
    }
  };

  if (loading) {
    return (
      <div 
        className={styles['reset-password-form__loading']}
        role="status"
        aria-live="polite"
      >
        Validating reset token...
      </div>
    );
  }

  if (!isTokenValid) {
    return (
      <div 
        className={styles['reset-password-form__error']}
        role="alert"
      >
        Invalid or expired reset token. Please request a new password reset.
      </div>
    );
  }

  return (
    <Form
      id="reset-password-form"
      className={styles['reset-password-form']}
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      <h2 className={styles['reset-password-form__title']}>Reset Password</h2>
      
      <Input
        id="password"
        name="password"
        type="password"
        label="New Password"
        required
        className={styles['reset-password-form__input']}
        aria-describedby="password-requirements"
      />
      
      <div 
        id="password-requirements"
        className={styles['reset-password-form__requirements']}
      >
        Password must be at least 12 characters long and contain uppercase, 
        lowercase, number, and special characters.
      </div>

      <Input
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        label="Confirm Password"
        required
        className={styles['reset-password-form__input']}
      />

      <div 
        className={styles['reset-password-form__attempts']}
        aria-live="polite"
      >
        {attempts > 0 && (
          <span>Attempts remaining: {maxAttempts - attempts}</span>
        )}
      </div>
    </Form>
  );
};

ResetPasswordForm.displayName = 'ResetPasswordForm';

export default ResetPasswordForm;