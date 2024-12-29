import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // v6.0.0
import validator from 'validator'; // v13.0.0
import Form from '../common/Form';
import Input from '../common/Input';
import Button from '../common/Button';
import { validateCredentials } from '../../utils/validation.util';
import { IUserCredentials, IUser, IAuthError } from '../../interfaces/auth.interface';
import { AUTH_STATES } from '../../constants/auth.constants';

/**
 * Props interface for the RegisterForm component
 */
export interface IRegisterFormProps {
  onSuccess: (user: IUser) => void;
  onError: (error: IAuthError) => void;
  className?: string;
  initialValues?: Partial<IRegisterFormValues>;
}

/**
 * Interface for registration form values
 */
export interface IRegisterFormValues {
  email: string;
  password: string;
  confirmPassword: string;
  agreeToTerms: boolean;
}

/**
 * Enhanced registration form component with comprehensive validation and security features
 */
const RegisterForm: React.FC<IRegisterFormProps> = ({
  onSuccess,
  onError,
  className,
  initialValues = {
    email: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  }
}) => {
  const navigate = useNavigate();
  const [formStatus, setFormStatus] = useState<AUTH_STATES>(AUTH_STATES.UNAUTHENTICATED);
  const [serverError, setServerError] = useState<string | null>(null);

  // Validation schema for form fields
  const validationSchema = {
    email: (value: string) => {
      if (!value) return 'Email is required';
      if (!validator.isEmail(value)) return 'Invalid email format';
      return undefined;
    },
    password: (value: string) => {
      const validation = validateCredentials({ email: '', password: value });
      if (!validation.isValid) return validation.errors[0];
      return undefined;
    },
    confirmPassword: (value: string, allValues: Record<string, any>) => {
      if (!value) return 'Please confirm your password';
      if (value !== allValues.password) return 'Passwords do not match';
      return undefined;
    },
    agreeToTerms: (value: boolean) => {
      if (!value) return 'You must agree to the terms and conditions';
      return undefined;
    }
  };

  // Handle form submission
  const handleSubmit = useCallback(async (values: Record<string, any>) => {
    try {
      setFormStatus(AUTH_STATES.LOADING);
      setServerError(null);

      // Validate credentials before submission
      const credentials: IUserCredentials = {
        email: values.email,
        password: values.password
      };

      const validation = validateCredentials(credentials);
      if (!validation.isValid) {
        throw new Error(validation.errors[0]);
      }

      // TODO: Replace with actual API call
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }

      const user = await response.json();
      setFormStatus(AUTH_STATES.AUTHENTICATED);
      onSuccess(user);
      navigate('/dashboard');

    } catch (error) {
      setFormStatus(AUTH_STATES.UNAUTHENTICATED);
      setServerError(error instanceof Error ? error.message : 'Registration failed');
      onError({ message: error instanceof Error ? error.message : 'Registration failed' });
    }
  }, [navigate, onSuccess, onError]);

  // Reset server error when form values change
  useEffect(() => {
    if (serverError) {
      setServerError(null);
    }
  }, [serverError]);

  return (
    <Form
      id="register-form"
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      className={`register-form ${className || ''}`}
      errorMessage={serverError}
      isLoading={formStatus === AUTH_STATES.LOADING}
    >
      <div className="register-form__field">
        <Input
          id="email"
          name="email"
          type="email"
          label="Email Address"
          required
          aria-label="Email Address"
        />
      </div>

      <div className="register-form__field">
        <Input
          id="password"
          name="password"
          type="password"
          label="Password"
          required
          aria-label="Password"
        />
      </div>

      <div className="register-form__field">
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          label="Confirm Password"
          required
          aria-label="Confirm Password"
        />
      </div>

      <div className="register-form__terms">
        <Input
          id="agreeToTerms"
          name="agreeToTerms"
          type="checkbox"
          label="I agree to the terms and conditions"
          required
          aria-label="Accept Terms and Conditions"
        />
      </div>

      <div className="register-form__submit">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={formStatus === AUTH_STATES.LOADING}
          disabled={formStatus === AUTH_STATES.LOADING}
          ariaLabel="Create Account"
        >
          Create Account
        </Button>
      </div>
    </Form>
  );
};

RegisterForm.displayName = 'RegisterForm';

export default RegisterForm;