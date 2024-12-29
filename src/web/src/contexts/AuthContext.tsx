/**
 * Authentication Context Provider
 * 
 * Implements secure JWT token-based authentication with enhanced security features
 * including automatic token refresh, secure storage, and role-based access control.
 * Provides authentication state management across the application.
 * 
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AuthService } from '../services/auth.service';
import { 
  IAuthContext, 
  IAuthState, 
  IUserCredentials 
} from '../interfaces/auth.interface';
import { 
  AUTH_STATES,
  TOKEN_CONFIG,
  AUTH_STORAGE_KEYS 
} from '../constants/auth.constants';

// Initial authentication state
const initialAuthState: IAuthState = {
  status: AUTH_STATES.LOADING,
  user: null,
  tokens: null,
  error: null
};

// Create the authentication context
const AuthContext = createContext<IAuthContext | null>(null);

// Session fingerprint key for enhanced security
const SESSION_FINGERPRINT_KEY = 'auth_session_fingerprint';

// Token refresh interval (5 minutes)
const TOKEN_REFRESH_INTERVAL = TOKEN_CONFIG.TOKEN_REFRESH_THRESHOLD * 1000;

// Rate limiting for token refresh attempts
const TOKEN_REFRESH_RATE_LIMIT = 1000; // 1 second

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Authentication Provider Component
 * Manages authentication state and provides auth-related functionality
 */
export const AuthProvider: React.FC<AuthProviderProps> = React.memo(({ children }) => {
  // Initialize auth state
  const [authState, setAuthState] = useState<IAuthState>(initialAuthState);
  
  // Create memoized AuthService instance
  const authService = useMemo(() => new AuthService(), []);

  // Create session fingerprint for security
  const createSessionFingerprint = useCallback((): string => {
    return btoa(`${navigator.userAgent}-${new Date().getTime()}`);
  }, []);

  /**
   * Validates session fingerprint
   */
  const validateSessionFingerprint = useCallback((): boolean => {
    const storedFingerprint = localStorage.getItem(SESSION_FINGERPRINT_KEY);
    return storedFingerprint === createSessionFingerprint();
  }, [createSessionFingerprint]);

  /**
   * Updates authentication state with new data
   */
  const updateAuthState = useCallback((newState: Partial<IAuthState>) => {
    setAuthState(prevState => ({
      ...prevState,
      ...newState
    }));
  }, []);

  /**
   * Handles user login
   */
  const login = useCallback(async (credentials: IUserCredentials): Promise<void> => {
    try {
      updateAuthState({ status: AUTH_STATES.LOADING, error: null });

      const tokens = await authService.login(credentials);
      const user = await authService.getCurrentUser();

      // Set session fingerprint
      localStorage.setItem(SESSION_FINGERPRINT_KEY, createSessionFingerprint());

      updateAuthState({
        status: AUTH_STATES.AUTHENTICATED,
        user,
        tokens,
        error: null
      });
    } catch (error) {
      updateAuthState({
        status: AUTH_STATES.UNAUTHENTICATED,
        user: null,
        tokens: null,
        error: error instanceof Error ? error.message : 'Login failed'
      });
      throw error;
    }
  }, [authService, createSessionFingerprint, updateAuthState]);

  /**
   * Handles user logout
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await authService.logout();
    } finally {
      // Clear session data
      localStorage.removeItem(SESSION_FINGERPRINT_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
      
      updateAuthState({
        status: AUTH_STATES.UNAUTHENTICATED,
        user: null,
        tokens: null,
        error: null
      });
    }
  }, [authService, updateAuthState]);

  /**
   * Refreshes authentication tokens
   */
  const refreshToken = useCallback(async (): Promise<void> => {
    if (!validateSessionFingerprint()) {
      await logout();
      return;
    }

    try {
      const tokens = await authService.refreshToken();
      updateAuthState({ tokens });
    } catch (error) {
      await logout();
    }
  }, [authService, logout, updateAuthState, validateSessionFingerprint]);

  /**
   * Validates user permissions
   */
  const checkPermission = useCallback((permission: string): boolean => {
    return authState.user?.permissions.includes(permission) || false;
  }, [authState.user]);

  /**
   * Initialize authentication state on mount
   */
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout;
    let isSubscribed = true;

    const initializeAuth = async () => {
      try {
        if (!validateSessionFingerprint()) {
          throw new Error('Invalid session fingerprint');
        }

        const user = await authService.getCurrentUser();
        if (isSubscribed) {
          updateAuthState({
            status: AUTH_STATES.AUTHENTICATED,
            user,
            error: null
          });

          // Set up token refresh interval
          refreshInterval = setInterval(() => {
            refreshToken().catch(console.error);
          }, TOKEN_REFRESH_INTERVAL);
        }
      } catch (error) {
        if (isSubscribed) {
          updateAuthState({
            status: AUTH_STATES.UNAUTHENTICATED,
            user: null,
            tokens: null,
            error: null
          });
        }
      }
    };

    initializeAuth();

    // Cleanup function
    return () => {
      isSubscribed = false;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [authService, refreshToken, updateAuthState, validateSessionFingerprint]);

  // Memoize context value
  const contextValue = useMemo<IAuthContext>(() => ({
    authState,
    login,
    logout,
    refreshToken,
    checkPermission
  }), [authState, login, logout, refreshToken, checkPermission]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
});

/**
 * Custom hook for accessing authentication context
 * @throws {Error} If used outside of AuthProvider
 */
export const useAuthContext = (): IAuthContext => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

// Export context for testing purposes
export { AuthContext };