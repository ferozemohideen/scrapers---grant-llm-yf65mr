/**
 * useAuth Custom Hook
 * 
 * Provides secure authentication functionality and state management by consuming
 * the AuthContext. Implements JWT token-based authentication, session management,
 * role-based access control, and secure error handling with performance optimizations.
 * 
 * @version 1.0.0
 */

import { useCallback, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { 
  IUserCredentials, 
  IAuthState, 
  IUser 
} from '../interfaces/auth.interface';
import { 
  AUTH_STATES, 
  USER_ROLES, 
  TOKEN_CONFIG 
} from '../constants/auth.constants';

// Rate limiting configuration for login attempts
const LOGIN_RATE_LIMIT = {
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION: 300000, // 5 minutes in milliseconds
} as const;

/**
 * Interface for the useAuth hook return value
 */
interface UseAuthReturn {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: IUser | null;
  login: (credentials: IUserCredentials) => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (requiredRole: USER_ROLES) => boolean;
  refreshSession: () => Promise<void>;
}

/**
 * Custom hook that provides secure authentication functionality and state management
 * with performance optimizations
 */
export const useAuth = (): UseAuthReturn => {
  // Get authentication context
  const { authState, login: contextLogin, logout: contextLogout, refreshToken } = useAuthContext();

  /**
   * Memoized login handler with rate limiting
   */
  const login = useCallback(async (credentials: IUserCredentials): Promise<void> => {
    try {
      // Validate credentials format
      if (!credentials.email || !credentials.password) {
        throw new Error('Invalid credentials format');
      }

      // Check rate limiting
      const loginAttempts = JSON.parse(
        sessionStorage.getItem('loginAttempts') || '{"count": 0, "timestamp": 0}'
      );

      const now = Date.now();
      if (
        loginAttempts.count >= LOGIN_RATE_LIMIT.MAX_ATTEMPTS &&
        now - loginAttempts.timestamp < LOGIN_RATE_LIMIT.LOCKOUT_DURATION
      ) {
        throw new Error('Too many login attempts. Please try again later.');
      }

      // Attempt login
      await contextLogin(credentials);

      // Reset login attempts on successful login
      sessionStorage.removeItem('loginAttempts');
    } catch (error) {
      // Update login attempts
      const attempts = JSON.parse(
        sessionStorage.getItem('loginAttempts') || '{"count": 0, "timestamp": 0}'
      );
      sessionStorage.setItem('loginAttempts', JSON.stringify({
        count: attempts.count + 1,
        timestamp: Date.now()
      }));

      throw error;
    }
  }, [contextLogin]);

  /**
   * Memoized logout handler with session cleanup
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await contextLogout();
      // Clear any sensitive data from storage
      sessionStorage.clear();
      localStorage.clear();
    } catch (error) {
      console.error('Logout error:', error);
      // Force logout on error
      await contextLogout();
    }
  }, [contextLogout]);

  /**
   * Memoized permission check based on user role
   */
  const hasPermission = useCallback((requiredRole: USER_ROLES): boolean => {
    if (!authState.user) return false;

    const roleHierarchy = {
      [USER_ROLES.ADMIN]: 4,
      [USER_ROLES.MANAGER]: 3,
      [USER_ROLES.ANALYST]: 2,
      [USER_ROLES.API_USER]: 1
    };

    const userRoleLevel = roleHierarchy[authState.user.role] || 0;
    const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

    return userRoleLevel >= requiredRoleLevel;
  }, [authState.user]);

  /**
   * Memoized session refresh handler
   */
  const refreshSession = useCallback(async (): Promise<void> => {
    try {
      await refreshToken();
    } catch (error) {
      console.error('Session refresh error:', error);
      // Force logout on refresh error
      await logout();
    }
  }, [refreshToken, logout]);

  /**
   * Set up token refresh interval
   */
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;

    if (authState.status === AUTH_STATES.AUTHENTICATED && authState.tokens) {
      refreshInterval = setInterval(() => {
        refreshSession().catch(console.error);
      }, (TOKEN_CONFIG.TOKEN_REFRESH_THRESHOLD * 1000));
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [authState.status, authState.tokens, refreshSession]);

  // Compute derived state
  const isAuthenticated = authState.status === AUTH_STATES.AUTHENTICATED;
  const isLoading = authState.status === AUTH_STATES.LOADING;

  return {
    isAuthenticated,
    isLoading,
    error: authState.error,
    user: authState.user,
    login,
    logout,
    hasPermission,
    refreshSession
  };
};

export default useAuth;