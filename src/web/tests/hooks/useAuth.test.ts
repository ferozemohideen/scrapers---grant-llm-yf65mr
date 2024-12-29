/**
 * useAuth Hook Test Suite
 * 
 * Comprehensive test suite for the useAuth custom hook that verifies authentication flow,
 * session management, token handling, and role-based access control according to security
 * specifications.
 * 
 * @version 1.0.0
 */

import { renderHook, act } from '@testing-library/react-hooks'; // ^8.0.1
import { render, waitFor, cleanup } from '@testing-library/react'; // ^14.0.0
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0

import { useAuth } from '../../src/hooks/useAuth';
import { AuthProvider } from '../../src/contexts/AuthContext';
import { AUTH_STATES, USER_ROLES, TOKEN_CONFIG } from '../../src/constants/auth.constants';
import type { IUserCredentials, IAuthTokens, IUser } from '../../src/interfaces/auth.interface';

// Mock data for testing
const mockUser: IUser = {
  id: '123',
  email: 'test@example.com',
  role: USER_ROLES.MANAGER,
  profile: {
    firstName: 'Test',
    lastName: 'User',
    organization: 'Test Org',
    lastLoginAt: new Date()
  },
  permissions: ['read:data', 'write:data']
};

const mockTokens: IAuthTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: TOKEN_CONFIG.ACCESS_TOKEN_EXPIRY,
  tokenType: 'Bearer'
};

const mockCredentials: IUserCredentials = {
  email: 'test@example.com',
  password: 'Test123!'
};

/**
 * Helper function to render useAuth hook within AuthProvider
 */
const renderAuthHook = (initialState = {}) => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );
  return renderHook(() => useAuth(), { wrapper });
};

describe('useAuth Hook', () => {
  // Setup and teardown
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Initial State Tests', () => {
    it('should initialize with unauthenticated state', () => {
      const { result } = renderAuthHook();
      
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('should restore authentication state from storage', async () => {
      // Setup stored auth state
      localStorage.setItem('access_token', JSON.stringify(mockTokens));
      
      const { result } = renderAuthHook();
      
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });
  });

  describe('Authentication Flow Tests', () => {
    it('should handle successful login', async () => {
      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login(mockCredentials);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.error).toBeNull();
      expect(localStorage.getItem('access_token')).toBeTruthy();
    });

    it('should handle login failure with invalid credentials', async () => {
      const { result } = renderAuthHook();
      const invalidCredentials = { ...mockCredentials, password: 'wrong' };

      await act(async () => {
        try {
          await result.current.login(invalidCredentials);
        } catch (error) {
          expect(error).toBeTruthy();
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeTruthy();
    });

    it('should enforce login rate limiting', async () => {
      const { result } = renderAuthHook();
      const attempts = 6; // Exceeds MAX_ATTEMPTS

      for (let i = 0; i < attempts; i++) {
        await act(async () => {
          try {
            await result.current.login(mockCredentials);
          } catch (error) {
            if (i >= 4) { // After max attempts
              expect(error.message).toContain('Too many login attempts');
            }
          }
        });
      }

      const loginAttempts = JSON.parse(sessionStorage.getItem('loginAttempts') || '{}');
      expect(loginAttempts.count).toBeGreaterThanOrEqual(5);
    });

    it('should handle logout correctly', async () => {
      const { result } = renderAuthHook();

      // First login
      await act(async () => {
        await result.current.login(mockCredentials);
      });

      // Then logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(localStorage.getItem('access_token')).toBeNull();
      expect(sessionStorage.getItem('loginAttempts')).toBeNull();
    });
  });

  describe('Token Management Tests', () => {
    it('should refresh token automatically when near expiry', async () => {
      const { result } = renderAuthHook();
      
      // Login and set near-expiry token
      await act(async () => {
        await result.current.login(mockCredentials);
      });

      // Fast-forward time to near token expiry
      jest.advanceTimersByTime(TOKEN_CONFIG.TOKEN_REFRESH_THRESHOLD * 900);

      await waitFor(() => {
        const storedTokens = JSON.parse(localStorage.getItem('access_token') || '{}');
        expect(storedTokens.accessToken).not.toBe(mockTokens.accessToken);
      });
    });

    it('should handle token refresh failure gracefully', async () => {
      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login(mockCredentials);
      });

      // Mock refresh token failure
      jest.spyOn(result.current, 'refreshSession').mockRejectedValueOnce(new Error());

      await act(async () => {
        try {
          await result.current.refreshSession();
        } catch (error) {
          expect(error).toBeTruthy();
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
  });

  describe('Permission Validation Tests', () => {
    it('should validate user permissions correctly', async () => {
      const { result } = renderAuthHook();

      await act(async () => {
        await result.current.login(mockCredentials);
      });

      expect(result.current.hasPermission(USER_ROLES.ANALYST)).toBe(true);
      expect(result.current.hasPermission(USER_ROLES.ADMIN)).toBe(false);
    });

    it('should handle permission inheritance', async () => {
      const { result } = renderAuthHook();

      // Login as admin
      await act(async () => {
        await result.current.login({
          ...mockCredentials,
          email: 'admin@example.com'
        });
      });

      expect(result.current.hasPermission(USER_ROLES.MANAGER)).toBe(true);
      expect(result.current.hasPermission(USER_ROLES.ANALYST)).toBe(true);
      expect(result.current.hasPermission(USER_ROLES.API_USER)).toBe(true);
    });
  });

  describe('Session Management Tests', () => {
    it('should maintain session across page reloads', async () => {
      const { result, rerender } = renderAuthHook();

      await act(async () => {
        await result.current.login(mockCredentials);
      });

      // Simulate page reload
      rerender();

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });

    it('should handle concurrent session management', async () => {
      const { result: result1 } = renderAuthHook();
      const { result: result2 } = renderAuthHook();

      await act(async () => {
        await result1.current.login(mockCredentials);
      });

      expect(result1.current.isAuthenticated).toBe(true);
      expect(result2.current.isAuthenticated).toBe(true);
      expect(result1.current.user).toEqual(result2.current.user);
    });
  });
});