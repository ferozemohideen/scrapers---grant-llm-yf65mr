/**
 * Authentication Constants
 * 
 * Defines core authentication-related constants including token types,
 * authentication states, user roles, storage keys, API endpoints and
 * token configuration settings.
 * 
 * @version 1.0.0
 */

/**
 * Enum defining the types of authentication tokens used in the system
 */
export enum TOKEN_TYPES {
    ACCESS = 'access',
    REFRESH = 'refresh'
}

/**
 * Enum defining possible authentication states for the application
 */
export enum AUTH_STATES {
    AUTHENTICATED = 'authenticated',
    UNAUTHENTICATED = 'unauthenticated',
    LOADING = 'loading'
}

/**
 * Enum defining user roles for role-based access control (RBAC)
 * Based on the authorization matrix defined in the security specifications
 */
export enum USER_ROLES {
    ADMIN = 'admin',      // Full system access
    MANAGER = 'manager',  // Read/write access with limited system config
    ANALYST = 'analyst',  // Read-only access to data
    API_USER = 'api_user' // Limited API access only
}

/**
 * Enum defining local storage keys for authentication-related data
 * Used to maintain consistent key names across the application
 */
export enum AUTH_STORAGE_KEYS {
    ACCESS_TOKEN = 'access_token',
    REFRESH_TOKEN = 'refresh_token',
    USER = 'user'
}

/**
 * Enum defining authentication-related API endpoints
 * Centralized configuration for all auth-related API routes
 */
export enum AUTH_API_ENDPOINTS {
    LOGIN = '/auth/login',
    LOGOUT = '/auth/logout',
    REFRESH_TOKEN = '/auth/refresh',
    CURRENT_USER = '/auth/me'
}

/**
 * Token configuration constants
 * 
 * ACCESS_TOKEN_EXPIRY: 1 hour in seconds
 * REFRESH_TOKEN_EXPIRY: 7 days in seconds
 * TOKEN_REFRESH_THRESHOLD: 5 minutes in seconds (refresh token if less than this time remaining)
 */
export const TOKEN_CONFIG = {
    ACCESS_TOKEN_EXPIRY: 3600,        // 1 hour
    REFRESH_TOKEN_EXPIRY: 604800,     // 7 days
    TOKEN_REFRESH_THRESHOLD: 300      // 5 minutes
} as const;

/**
 * Type definitions for better TypeScript support
 */
export type TokenType = typeof TOKEN_TYPES[keyof typeof TOKEN_TYPES];
export type AuthState = typeof AUTH_STATES[keyof typeof AUTH_STATES];
export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];
export type StorageKey = typeof AUTH_STORAGE_KEYS[keyof typeof AUTH_STORAGE_KEYS];
export type AuthEndpoint = typeof AUTH_API_ENDPOINTS[keyof typeof AUTH_API_ENDPOINTS];

/**
 * Ensures token configuration values are read-only at runtime
 */
Object.freeze(TOKEN_CONFIG);