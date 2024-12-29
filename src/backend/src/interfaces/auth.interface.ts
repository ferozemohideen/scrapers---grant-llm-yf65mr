// @package jsonwebtoken ^9.0.0
import { JwtPayload } from 'jsonwebtoken';

/**
 * Global constants for authentication configuration
 */
export const SESSION_TIMEOUT_MS = 3600000; // 1 hour
export const MAX_REFRESH_TOKEN_AGE_MS = 604800000; // 7 days
export const TOKEN_TYPE = 'Bearer';

/**
 * User role enumeration for role-based access control
 * Defines the hierarchical access levels in the system
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  ANALYST = 'ANALYST',
  API_USER = 'API_USER'
}

/**
 * Interface for user login credentials
 * Used for authentication requests
 */
export interface IUserCredentials {
  email: string;
  password: string;
}

/**
 * Interface for JWT authentication tokens
 * Includes both access and refresh tokens with metadata
 */
export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Extended JWT payload interface
 * Includes user identification, authorization, and session tracking
 */
export interface IAuthPayload extends JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  permissions: string[];
  sessionId: string;
}

/**
 * Comprehensive interface for user session management
 * Tracks session metadata and security information
 */
export interface IUserSession {
  userId: string;
  refreshToken: string;
  lastActivity: Date;
  expiresAt: Date;
  ipAddress: string;
  userAgent: string;
  isActive: boolean;
}

/**
 * Type guard to check if a value is a valid UserRole
 * @param role - The role value to check
 */
export function isValidUserRole(role: any): role is UserRole {
  return Object.values(UserRole).includes(role as UserRole);
}

/**
 * Type guard to check if a payload is a valid IAuthPayload
 * @param payload - The payload to validate
 */
export function isAuthPayload(payload: any): payload is IAuthPayload {
  return (
    typeof payload === 'object' &&
    typeof payload.userId === 'string' &&
    typeof payload.email === 'string' &&
    isValidUserRole(payload.role) &&
    Array.isArray(payload.permissions) &&
    typeof payload.sessionId === 'string'
  );
}

/**
 * Type guard to check if tokens object is valid IAuthTokens
 * @param tokens - The tokens object to validate
 */
export function isAuthTokens(tokens: any): tokens is IAuthTokens {
  return (
    typeof tokens === 'object' &&
    typeof tokens.accessToken === 'string' &&
    typeof tokens.refreshToken === 'string' &&
    typeof tokens.expiresIn === 'number' &&
    tokens.tokenType === TOKEN_TYPE
  );
}