/**
 * @fileoverview Central export point for all Express middleware components
 * Provides a unified interface for authentication, authorization, error handling,
 * rate limiting, and request validation middleware.
 * @version 1.0.0
 */

// Authentication and Authorization middleware
import { authenticate, authorize } from './auth.middleware';

// Error handling middleware with retry strategies and monitoring
import { errorMiddleware } from './error.middleware';

// Rate limiting middleware with distributed state management
import { createRateLimiter } from './rateLimiter.middleware';

// Request validation middleware
import {
  validateRequest,
  validateURLConfig,
  validatePagination
} from './validation.middleware';

// Default rate limiting configuration based on security controls
const defaultRateLimitConfig = {
  windowMs: 60000, // 1 minute window
  maxRequests: 1000, // 1000 requests per minute as per security controls
  keyPrefix: 'tech_transfer:ratelimit:',
  enableMonitoring: true,
  skipFailedRequests: true
};

// Create pre-configured rate limiter instance
const defaultRateLimiter = createRateLimiter(defaultRateLimitConfig);

/**
 * Export all middleware components with documentation
 */
export {
  // Authentication middleware for JWT token validation and session management
  authenticate,

  // Role-based authorization middleware with granular permission checks
  authorize,

  // Global error handling middleware implementing the Error Classification Matrix
  errorMiddleware,

  // Rate limiting middleware factory for custom rate limit configurations
  createRateLimiter,

  // Pre-configured rate limiter with default settings
  defaultRateLimiter,

  // Generic request validation middleware factory
  validateRequest,

  // Specialized URL configuration validation middleware
  validateURLConfig,

  // Pagination parameter validation middleware
  validatePagination
};

/**
 * Default middleware stack for protected routes
 * Combines authentication, rate limiting, and basic validation
 */
export const protectedRouteMiddleware = [
  authenticate,
  defaultRateLimiter,
  validatePagination
];

/**
 * Default middleware stack for admin routes
 * Adds role-based authorization for admin access
 */
export const adminRouteMiddleware = [
  authenticate,
  defaultRateLimiter,
  (req, res, next) => authorize(['ADMIN'])(req, res, next),
  validatePagination
];

/**
 * Default middleware stack for URL configuration routes
 * Includes specialized validation for URL configurations
 */
export const urlConfigRouteMiddleware = [
  authenticate,
  defaultRateLimiter,
  validateURLConfig
];

/**
 * Type definitions for middleware configuration
 */
export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
  enableMonitoring?: boolean;
  skipFailedRequests?: boolean;
};

export type ValidationSchema = {
  type: string;
  required?: boolean;
  properties?: Record<string, ValidationSchema>;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
};

/**
 * Re-export error types for consistent error handling
 */
export { ERROR_TYPES } from '../../constants/error.constants';