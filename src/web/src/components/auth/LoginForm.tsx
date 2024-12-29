import React, { useState, useCallback, useEffect } from 'react';
import * as yup from 'yup'; // ^1.0.0
import { useAuth } from '../../hooks/useAuth';
import Form from '../common/Form';
import Input from '../common/Input';
import Button from '../common/Button';
import { validateCredentials } from '../../utils/validation.util';
import { IUserCredentials } from '../../interfaces/auth.interface';

/**
 * Props interface for the LoginForm component
 */
interface LoginFormProps {
  /** Callback function called after successful login */
  onSuccess?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Maximum number of login attempts before lockout */
  maxAttempts?: number;
}

/**
 * Internal state interface for login form
 */
interface LoginFormState {
  attempts: number;
  lastAttempt: Date | null;
  sessionFingerprint: string;
}

/**
 * Validation schema for login credentials
 */
const loginValidationSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .email('Invalid email format'),
  password: yup
    .string()
    .required('Password is required')
    .min(12, 'Password must be at least 12 characters long')
});

/**
 * Secure login form component with comprehensive validation,
 * rate limiting, and accessibility features.
 */
const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  className,
  maxAttempts = 5
}) => {
  // Authentication hook
  const { login, isLoading } = useAuth();

  // Internal form state
  const [formState, setFormState] = useState<LoginFormState>({
    attempts: 0,
    lastAttempt: null,
    sessionFingerprint: ''
  });

  const [error, setError] = useState<string | null>(null);

  // Generate session fingerprint on mount
  useEffect(() => {
    const fingerprint = btoa(`${navigator.userAgent}-${new Date().getTime()}`);
    setFormState(prev => ({ ...prev, sessionFingerprint: fingerprint }));
  }, []);

  /**
   * Handles form submission with rate limiting and security checks
   */
  const handleSubmit = useCallback(async (values: IUserCredentials) => {
    try {
      // Reset error state
      setError(null);

      // Check rate limiting
      if (formState.attempts >= maxAttempts) {
        const cooldownPeriod = 5 * 60 * 1000; // 5 minutes
        const timeSinceLastAttempt = formState.lastAttempt 
          ? Date.now() - formState.lastAttempt.getTime()
          : cooldownPeriod;

        if (timeSinceLastAttempt < cooldownPeriod) {
          throw new Error(`Too many login attempts. Please try again in ${
            Math.ceil((cooldownPeriod - timeSinceLastAttempt) / 60000)
          } minutes.`);
        }
        // Reset attempts after cooldown
        setFormState(prev => ({ ...prev, attempts: 0 }));
      }

      // Validate credentials format
      const validationResult = validateCredentials(values);
      if (!validationResult.isValid) {
        throw new Error(validationResult.errors[0]);
      }

      // Attempt login
      await login(values);

      // Reset form state on success
      setFormState({
        attempts: 0,
        lastAttempt: null,
        sessionFingerprint: formState.sessionFingerprint
      });

      // Call success callback
      onSuccess?.();

    } catch (err) {
      // Update attempt counter
      setFormState(prev => ({
        ...prev,
        attempts: prev.attempts + 1,
        lastAttempt: new Date()
      }));

      // Set error message
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  }, [login, onSuccess, maxAttempts, formState.sessionFingerprint]);

  return (
    <Form
      id="login-form"
      className={className}
      initialValues={{
        email: '',
        password: ''
      }}
      validationSchema={loginValidationSchema}
      onSubmit={handleSubmit}
      errorMessage={error}
    >
      <div className="login-form__fields">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          required
          aria-label="Email address"
          autoComplete="email"
        />

        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          required
          aria-label="Password"
          autoComplete="current-password"
        />
      </div>

      <div className="login-form__controls">
        <Button
          type="submit"
          variant="primary"
          loading={isLoading}
          disabled={formState.attempts >= maxAttempts}
          aria-label="Sign in to your account"
        >
          Sign In
        </Button>
      </div>

      {formState.attempts > 0 && (
        <div 
          className="login-form__attempts"
          aria-live="polite"
        >
          {`${maxAttempts - formState.attempts} attempts remaining`}
        </div>
      )}
    </Form>
  );
};

export default LoginForm;