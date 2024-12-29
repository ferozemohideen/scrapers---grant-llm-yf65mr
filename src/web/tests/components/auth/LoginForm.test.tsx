import React from 'react';
import { render, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { axe, toHaveNoViolations } from '@axe-core/react';

import LoginForm from '../../../src/components/auth/LoginForm';
import { AuthProvider } from '../../../src/contexts/AuthContext';
import { IUserCredentials } from '../../../src/interfaces/auth.interface';

// Add jest-axe matchers
expect.extend(toHaveNoViolations);

// Mock auth service
jest.mock('../../../src/services/auth.service', () => ({
  login: jest.fn(),
  refreshToken: jest.fn(),
}));

// Test data
const mockCredentials: IUserCredentials = {
  email: 'test@example.com',
  password: 'SecureP@ssw0rd123'
};

// Helper function to render LoginForm with AuthProvider
const renderLoginForm = (props = {}) => {
  const mockAuthContext = {
    login: jest.fn(),
    isLoading: false,
  };

  return render(
    <AuthProvider>
      <LoginForm {...props} />
    </AuthProvider>
  );
};

describe('LoginForm Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Form Rendering and Validation', () => {
    it('renders form with all required fields and labels', () => {
      renderLoginForm();

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('displays validation errors for invalid email format', async () => {
      renderLoginForm();
      const emailInput = screen.getByLabelText(/email/i);

      await userEvent.type(emailInput, 'invalid-email');
      fireEvent.blur(emailInput);

      await waitFor(() => {
        expect(screen.getByText(/invalid email format/i)).toBeInTheDocument();
      });
    });

    it('enforces password complexity requirements', async () => {
      renderLoginForm();
      const passwordInput = screen.getByLabelText(/password/i);

      await userEvent.type(passwordInput, 'weak');
      fireEvent.blur(passwordInput);

      await waitFor(() => {
        expect(screen.getByText(/password must be at least 12 characters/i)).toBeInTheDocument();
      });
    });

    it('sanitizes user inputs', async () => {
      renderLoginForm();
      const emailInput = screen.getByLabelText(/email/i);

      const maliciousInput = '<script>alert("xss")</script>test@example.com';
      await userEvent.type(emailInput, maliciousInput);

      expect(emailInput).toHaveValue('test@example.com');
    });
  });

  describe('Authentication Flow', () => {
    it('handles successful login with JWT token', async () => {
      const onSuccess = jest.fn();
      renderLoginForm({ onSuccess });

      await userEvent.type(screen.getByLabelText(/email/i), mockCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockCredentials.password);
      
      const submitButton = screen.getByRole('button', { name: /sign in/i });
      await userEvent.click(submitButton);

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalled();
      });
    });

    it('manages rate limiting and cooldown periods', async () => {
      renderLoginForm();
      const maxAttempts = 5;

      for (let i = 0; i < maxAttempts + 1; i++) {
        await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
      }

      await waitFor(() => {
        expect(screen.getByText(/too many login attempts/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /sign in/i })).toBeDisabled();
      });
    });

    it('validates session fingerprinting', async () => {
      renderLoginForm();

      await userEvent.type(screen.getByLabelText(/email/i), mockCredentials.email);
      await userEvent.type(screen.getByLabelText(/password/i), mockCredentials.password);
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        const fingerprint = sessionStorage.getItem('loginAttempts');
        expect(fingerprint).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('displays network error messages', async () => {
      const mockError = new Error('Network error');
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(mockError);

      renderLoginForm();
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('handles timeout scenarios', async () => {
      jest.useFakeTimers();
      const mockTimeout = new Error('Request timeout');
      jest.spyOn(global, 'fetch').mockImplementationOnce(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(mockTimeout), 30000);
        })
      );

      renderLoginForm();
      await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
      jest.runAllTimers();

      await waitFor(() => {
        expect(screen.getByText(/request timeout/i)).toBeInTheDocument();
      });
    });

    it('manages rate limit exceeded errors', async () => {
      renderLoginForm();
      const maxAttempts = 5;

      for (let i = 0; i < maxAttempts; i++) {
        await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
      }

      await waitFor(() => {
        expect(screen.getByText(/attempts remaining/i)).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility Features', () => {
    it('supports complete keyboard navigation', async () => {
      renderLoginForm();
      const form = screen.getByRole('form');

      // Test tab navigation
      await userEvent.tab();
      expect(screen.getByLabelText(/email/i)).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByLabelText(/password/i)).toHaveFocus();

      await userEvent.tab();
      expect(screen.getByRole('button', { name: /sign in/i })).toHaveFocus();
    });

    it('provides appropriate ARIA labels', () => {
      renderLoginForm();

      expect(screen.getByLabelText(/email/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByLabelText(/password/i)).toHaveAttribute('aria-required', 'true');
      expect(screen.getByRole('button', { name: /sign in/i })).toHaveAttribute('aria-label');
    });

    it('announces form states to screen readers', async () => {
      renderLoginForm();

      const emailInput = screen.getByLabelText(/email/i);
      await userEvent.type(emailInput, 'invalid');
      fireEvent.blur(emailInput);

      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('has no accessibility violations', async () => {
      const { container } = renderLoginForm();
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});