/**
 * @file Error Utilities
 * @description Provides comprehensive error handling utilities for enterprise-grade error management
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid'; // v8.3.2
import {
  ERROR_TYPES,
  ERROR_MESSAGES,
  HTTP_STATUS_CODES,
  RETRY_STRATEGIES,
  ALERT_THRESHOLDS,
  LOG_LEVELS
} from '../constants/error.constants';

/**
 * Enhanced custom error class with monitoring and tracking capabilities
 */
export class AppError extends Error {
  public readonly type: ERROR_TYPES;
  public readonly statusCode: number;
  public readonly metadata: Record<string, any>;
  public readonly timestamp: Date;
  public readonly correlationId: string;
  public readonly fingerprint: string;
  public readonly context: Record<string, any>;

  constructor(
    message: string,
    type: ERROR_TYPES,
    statusCode: number,
    metadata: Record<string, any> = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.type = type;
    this.statusCode = statusCode;
    this.metadata = this.sanitizeMetadata(metadata);
    this.timestamp = new Date();
    this.correlationId = uuidv4();
    this.fingerprint = this.generateFingerprint();
    this.context = {};

    // Ensure proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
    
    // Capture stack trace with proper prototyping
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Generates a unique fingerprint for error aggregation
   */
  private generateFingerprint(): string {
    return `${this.type}:${this.message}`.replace(/[^a-zA-Z0-9:]/g, '_');
  }

  /**
   * Removes sensitive information from error metadata
   */
  private sanitizeMetadata(metadata: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['password', 'token', 'apiKey', 'secret'];
    return Object.entries(metadata).reduce((acc, [key, value]) => {
      if (!sensitiveKeys.includes(key.toLowerCase())) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
  }
}

/**
 * Creates an AppError instance with monitoring support
 */
export function createError(
  type: ERROR_TYPES,
  message?: string,
  metadata: Record<string, any> = {},
  context: Record<string, any> = {}
): AppError {
  if (!Object.values(ERROR_TYPES).includes(type)) {
    throw new Error(`Invalid error type: ${type}`);
  }

  const errorMessage = message || ERROR_MESSAGES[type];
  const statusCode = getHttpStatusCode(type);
  const enhancedMetadata = {
    ...metadata,
    systemInfo: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      ...context
    }
  };

  const error = new AppError(errorMessage, type, statusCode, enhancedMetadata);
  logErrorCreation(error);
  checkAlertThresholds(error);

  return error;
}

/**
 * Central error handling function with monitoring and retry support
 */
export function handleError(
  error: Error | AppError,
  context: Record<string, any> = {}
): {
  error: AppError;
  retryable: boolean;
  nextRetryDelay?: number;
  alertTriggered: boolean;
} {
  // Transform to AppError if needed
  const appError = error instanceof AppError
    ? error
    : createError(ERROR_TYPES.INTERNAL_ERROR, error.message, {}, context);

  // Enhance with distributed tracing context
  appError.context = {
    ...appError.context,
    ...context,
    handledAt: new Date().toISOString()
  };

  const retryCount = context.retryCount || 0;
  const retryable = isRetryable(appError, retryCount, context);
  const nextRetryDelay = retryable ? getRetryDelay(appError, retryCount, context) : undefined;
  const alertTriggered = checkAlertThresholds(appError);

  // Log error with correlation ID
  logError(appError);
  updateErrorMetrics(appError);

  return {
    error: appError,
    retryable,
    nextRetryDelay,
    alertTriggered
  };
}

/**
 * Determines if an operation should be retried
 */
export function isRetryable(
  error: AppError,
  retryCount: number,
  context: Record<string, any> = {}
): boolean {
  const strategy = RETRY_STRATEGIES[error.type];
  if (!strategy) {
    return false;
  }

  // Check system-wide retry state
  if (context.systemOverloaded || context.circuitBreakerOpen) {
    return false;
  }

  // Verify retry count against limits
  if (retryCount >= strategy.maxRetries) {
    return false;
  }

  // Check specific error conditions
  switch (error.type) {
    case ERROR_TYPES.NETWORK_ERROR:
    case ERROR_TYPES.RATE_LIMIT_ERROR:
    case ERROR_TYPES.SERVICE_ERROR:
    case ERROR_TYPES.DATABASE_ERROR:
      return true;
    default:
      return false;
  }
}

/**
 * Calculates optimal delay before next retry attempt
 */
export function getRetryDelay(
  error: AppError,
  retryCount: number,
  context: Record<string, any> = {}
): number {
  const strategy = RETRY_STRATEGIES[error.type];
  if (!strategy) {
    return 0;
  }

  // Calculate exponential backoff with jitter
  const baseDelay = strategy.baseDelay;
  const exponentialDelay = baseDelay * Math.pow(2, retryCount);
  const maxDelay = strategy.maxDelay;
  
  // Add jitter for distributed systems
  const jitter = Math.random() * 1000;
  
  // Consider system load
  const loadFactor = context.systemLoad ? Math.min(context.systemLoad, 2) : 1;
  
  const finalDelay = Math.min(
    (exponentialDelay * loadFactor) + jitter,
    maxDelay
  );

  return Math.floor(finalDelay);
}

/**
 * Maps error types to HTTP status codes
 */
function getHttpStatusCode(type: ERROR_TYPES): number {
  const statusCodeMap: Record<ERROR_TYPES, number> = {
    [ERROR_TYPES.NETWORK_ERROR]: HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
    [ERROR_TYPES.RATE_LIMIT_ERROR]: HTTP_STATUS_CODES.RATE_LIMITED,
    [ERROR_TYPES.PARSE_ERROR]: HTTP_STATUS_CODES.BAD_REQUEST,
    [ERROR_TYPES.VALIDATION_ERROR]: HTTP_STATUS_CODES.BAD_REQUEST,
    [ERROR_TYPES.AUTHENTICATION_ERROR]: HTTP_STATUS_CODES.UNAUTHORIZED,
    [ERROR_TYPES.AUTHORIZATION_ERROR]: HTTP_STATUS_CODES.FORBIDDEN,
    [ERROR_TYPES.NOT_FOUND_ERROR]: HTTP_STATUS_CODES.NOT_FOUND,
    [ERROR_TYPES.CONFLICT_ERROR]: HTTP_STATUS_CODES.CONFLICT,
    [ERROR_TYPES.INTERNAL_ERROR]: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
    [ERROR_TYPES.SERVICE_ERROR]: HTTP_STATUS_CODES.SERVICE_UNAVAILABLE,
    [ERROR_TYPES.DATABASE_ERROR]: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR
  };

  return statusCodeMap[type] || HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR;
}

/**
 * Logs error creation events
 */
function logErrorCreation(error: AppError): void {
  console.log({
    level: LOG_LEVELS.INFO,
    message: 'Error created',
    correlationId: error.correlationId,
    type: error.type,
    fingerprint: error.fingerprint,
    timestamp: error.timestamp
  });
}

/**
 * Logs error details with correlation ID
 */
function logError(error: AppError): void {
  console.error({
    level: LOG_LEVELS.ERROR,
    message: error.message,
    correlationId: error.correlationId,
    type: error.type,
    fingerprint: error.fingerprint,
    metadata: error.metadata,
    context: error.context,
    stack: error.stack
  });
}

/**
 * Updates error metrics for monitoring
 */
function updateErrorMetrics(error: AppError): void {
  // Implementation would integrate with monitoring system
  // Example: increment error counters, update error rates, etc.
}

/**
 * Checks if error frequency exceeds alert thresholds
 */
function checkAlertThresholds(error: AppError): boolean {
  const threshold = ALERT_THRESHOLDS[error.type];
  if (!threshold) {
    return false;
  }

  // Implementation would check error frequency against thresholds
  // and trigger alerts if exceeded
  return false;
}