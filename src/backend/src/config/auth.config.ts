// @package dotenv ^16.0.0
import { config } from 'dotenv';
import { UserRole, IAuthConfig } from '../interfaces/auth.interface';

// Initialize environment variables
config();

// Minimum length requirement for secure secrets
const MIN_SECRET_LENGTH = 32;

/**
 * Validates environment variables required for authentication
 * Ensures secrets meet security requirements for length and complexity
 * @throws Error if validation fails
 */
export function validateEnvironmentVariables(): void {
  // Check existence of required secrets
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
  }
  if (!process.env.REFRESH_TOKEN_SECRET) {
    throw new Error('REFRESH_TOKEN_SECRET environment variable is required');
  }

  // Validate secret lengths
  if (process.env.JWT_SECRET.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long`);
  }
  if (process.env.REFRESH_TOKEN_SECRET.length < MIN_SECRET_LENGTH) {
    throw new Error(`REFRESH_TOKEN_SECRET must be at least ${MIN_SECRET_LENGTH} characters long`);
  }

  // Validate secret complexity
  const complexityRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])/;
  if (!complexityRegex.test(process.env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must contain uppercase, lowercase, numbers, and special characters');
  }
  if (!complexityRegex.test(process.env.REFRESH_TOKEN_SECRET)) {
    throw new Error('REFRESH_TOKEN_SECRET must contain uppercase, lowercase, numbers, and special characters');
  }
}

/**
 * Validates the authentication configuration object
 * @param config - Authentication configuration object
 * @returns true if valid, throws error otherwise
 */
export function validateAuthConfig(config: IAuthConfig): boolean {
  // Validate JWT configuration
  if (!config.jwt?.accessToken || !config.jwt?.refreshToken) {
    throw new Error('JWT configuration is required');
  }

  // Validate session timeouts
  if (!config.session?.timeoutMs || config.session.timeoutMs < 300000) { // min 5 minutes
    throw new Error('Invalid session timeout configuration');
  }

  // Validate security settings
  if (!config.security?.passwordRequirements) {
    throw new Error('Password requirements configuration is required');
  }

  if (config.security.passwordMinLength < 12) {
    throw new Error('Minimum password length must be at least 12 characters');
  }

  return true;
}

/**
 * Authentication configuration object
 * Contains comprehensive settings for JWT, sessions, and security policies
 */
export const authConfig = {
  jwt: {
    accessToken: {
      secret: process.env.JWT_SECRET!,
      expiresIn: '15m',
      algorithm: 'HS256',
      issuer: 'tech-transfer-system',
      audience: 'tech-transfer-users'
    },
    refreshToken: {
      secret: process.env.REFRESH_TOKEN_SECRET!,
      expiresIn: '7d',
      algorithm: 'HS256',
      issuer: 'tech-transfer-system',
      audience: 'tech-transfer-users'
    }
  },
  session: {
    timeoutMs: 3600000, // 1 hour
    refreshThresholdMs: 300000, // 5 minutes
    maxConcurrentSessions: 5,
    inactivityTimeoutMs: 1800000, // 30 minutes
    absoluteTimeoutMs: 28800000 // 8 hours
  },
  security: {
    passwordMinLength: 12,
    passwordRequirements: {
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
      minUniqueChars: 8
    },
    maxLoginAttempts: 5,
    lockoutDurationMs: 900000, // 15 minutes
    passwordHistorySize: 5,
    mfaEnabled: true,
    rolePermissions: {
      [UserRole.ADMIN]: ['*'], // All permissions
      [UserRole.MANAGER]: [
        'read:*',
        'write:technology',
        'write:proposal',
        'manage:users'
      ],
      [UserRole.ANALYST]: [
        'read:technology',
        'read:proposal',
        'write:proposal'
      ],
      [UserRole.API_USER]: [
        'read:technology'
      ]
    }
  }
} as const;

// Validate environment variables on module load
validateEnvironmentVariables();

// Validate configuration on module load
validateAuthConfig(authConfig);

export default authConfig;