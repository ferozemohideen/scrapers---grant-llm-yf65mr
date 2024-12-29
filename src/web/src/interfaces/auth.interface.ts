/**
 * Authentication Interfaces
 * 
 * Defines TypeScript interfaces for authentication-related data structures including
 * user credentials, authentication tokens, user data, and authentication state.
 * Implements type-safe interfaces for JWT token-based authentication flow and
 * role-based access control.
 * 
 * @version 1.0.0
 */

import { AUTH_STATES, USER_ROLES } from '../constants/auth.constants';

/**
 * User login credentials interface
 */
export interface IUserCredentials {
    email: string;
    password: string;
}

/**
 * JWT authentication tokens interface with security metadata
 */
export interface IAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
}

/**
 * User profile information interface
 */
export interface IUserProfile {
    firstName: string;
    lastName: string;
    organization: string;
    lastLoginAt: Date;
}

/**
 * Comprehensive user data interface with role-based access control
 */
export interface IUser {
    id: string;
    email: string;
    role: USER_ROLES;
    profile: IUserProfile;
    permissions: string[];
}

/**
 * Authentication state management interface
 */
export interface IAuthState {
    status: AUTH_STATES;
    user: IUser | null;
    tokens: IAuthTokens | null;
    error: string | null;
}

/**
 * Authentication context interface with security features
 */
export interface IAuthContext {
    /**
     * Current authentication state
     */
    authState: IAuthState;

    /**
     * Authenticates a user with provided credentials
     * @param credentials User login credentials
     * @throws {Error} If authentication fails
     */
    login: (credentials: IUserCredentials) => Promise<void>;

    /**
     * Logs out the current user and clears authentication state
     */
    logout: () => Promise<void>;

    /**
     * Refreshes the authentication tokens
     * @throws {Error} If token refresh fails
     */
    refreshToken: () => Promise<void>;

    /**
     * Checks if the current user has a specific permission
     * @param permission Permission to check
     * @returns boolean indicating if user has permission
     */
    checkPermission: (permission: string) => boolean;
}