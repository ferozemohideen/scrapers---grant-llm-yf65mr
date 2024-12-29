/**
 * @file Error Constants
 * @description Defines standardized error-related constants for consistent error handling across the application
 * @version 1.0.0
 */

/**
 * HTTP status codes for API responses
 */
export enum HTTP_STATUS_CODES {
  OK = 200,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  RATE_LIMITED = 429,
  INTERNAL_SERVER_ERROR = 500,
  SERVICE_UNAVAILABLE = 503
}

/**
 * Standardized error type classifications
 */
export enum ERROR_TYPES {
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  PARSE_ERROR = 'PARSE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  CONFLICT_ERROR = 'CONFLICT_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_ERROR = 'SERVICE_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR'
}

/**
 * Default error messages for each error type
 */
export const ERROR_MESSAGES = {
  [ERROR_TYPES.NETWORK_ERROR]: 'Network connection failed',
  [ERROR_TYPES.RATE_LIMIT_ERROR]: 'Rate limit exceeded',
  [ERROR_TYPES.PARSE_ERROR]: 'Failed to parse data',
  [ERROR_TYPES.VALIDATION_ERROR]: 'Invalid input data',
  [ERROR_TYPES.AUTHENTICATION_ERROR]: 'Authentication failed',
  [ERROR_TYPES.AUTHORIZATION_ERROR]: 'Insufficient permissions',
  [ERROR_TYPES.NOT_FOUND_ERROR]: 'Resource not found',
  [ERROR_TYPES.CONFLICT_ERROR]: 'Resource conflict',
  [ERROR_TYPES.INTERNAL_ERROR]: 'Internal server error',
  [ERROR_TYPES.SERVICE_ERROR]: 'Service unavailable',
  [ERROR_TYPES.DATABASE_ERROR]: 'Database operation failed'
} as const;

/**
 * Logging severity levels
 */
export enum LOG_LEVELS {
  INFO = 'INFO',
  WARNING = 'WARNING',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

/**
 * Retry configurations for different error types
 * @property maxRetries - Maximum number of retry attempts
 * @property baseDelay - Initial delay in milliseconds between retries
 * @property maxDelay - Maximum delay in milliseconds between retries
 */
export const RETRY_STRATEGIES = {
  [ERROR_TYPES.NETWORK_ERROR]: {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxDelay: 5000 // 5 seconds
  },
  [ERROR_TYPES.RATE_LIMIT_ERROR]: {
    maxRetries: 5,
    baseDelay: 2000, // 2 seconds
    maxDelay: 10000 // 10 seconds
  },
  [ERROR_TYPES.SERVICE_ERROR]: {
    maxRetries: 3,
    baseDelay: 2000, // 2 seconds
    maxDelay: 8000 // 8 seconds
  },
  [ERROR_TYPES.DATABASE_ERROR]: {
    maxRetries: 2,
    baseDelay: 1000, // 1 second
    maxDelay: 4000 // 4 seconds
  }
} as const;

/**
 * Alert thresholds for error monitoring
 * Defines the number of occurrences before triggering alerts
 */
export const ALERT_THRESHOLDS = {
  [ERROR_TYPES.NETWORK_ERROR]: 3,
  [ERROR_TYPES.RATE_LIMIT_ERROR]: 5,
  [ERROR_TYPES.PARSE_ERROR]: 1,
  [ERROR_TYPES.VALIDATION_ERROR]: 10,
  [ERROR_TYPES.AUTHENTICATION_ERROR]: 5,
  [ERROR_TYPES.AUTHORIZATION_ERROR]: 5,
  [ERROR_TYPES.NOT_FOUND_ERROR]: 10,
  [ERROR_TYPES.CONFLICT_ERROR]: 5,
  [ERROR_TYPES.INTERNAL_ERROR]: 1,
  [ERROR_TYPES.SERVICE_ERROR]: 3,
  [ERROR_TYPES.DATABASE_ERROR]: 2
} as const;