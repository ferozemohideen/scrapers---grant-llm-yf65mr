/**
 * @fileoverview Central export point for all application constants
 * @description Consolidates and re-exports all constant values used throughout the application
 * including error handling, scraping configuration, and validation rules.
 * Provides type-safe access to application constants with comprehensive documentation.
 * @version 1.0.0
 */

// Error handling constants
export {
  HTTP_STATUS_CODES,
  ERROR_TYPES,
  ERROR_MESSAGES,
  LOG_LEVELS,
  RETRY_STRATEGIES,
  ALERT_THRESHOLDS
} from './error.constants';

// Scraper configuration constants
export {
  SCRAPER_ENGINES,
  SCRAPER_RATE_LIMITS,
  RETRY_CONFIG,
  type ErrorType,
  type ScraperEngine,
  type InstitutionType
} from './scraper.constants';

// Validation constants
export {
  URL_VALIDATION_PATTERNS,
  INSTITUTION_VALIDATION_RULES,
  SCRAPER_VALIDATION_RULES,
  USER_VALIDATION_RULES,
  FILE_VALIDATION_RULES,
  API_VALIDATION_RULES
} from './validation.constants';

/**
 * Type definitions for strongly-typed access to constants
 */

// Error handling types
export type HttpStatusCode = keyof typeof HTTP_STATUS_CODES;
export type ErrorType = keyof typeof ERROR_TYPES;
export type LogLevel = keyof typeof LOG_LEVELS;
export type RetryStrategy = keyof typeof RETRY_STRATEGIES;

// Validation rule types
export type InstitutionType = typeof INSTITUTION_VALIDATION_RULES.ALLOWED_TYPES[number];
export type UserRole = typeof USER_VALIDATION_RULES.PROFILE_RULES.role.allowedValues[number];
export type AllowedContentType = typeof FILE_VALIDATION_RULES.CONTENT_TYPES.allowed[number];
export type AllowedImageType = typeof FILE_VALIDATION_RULES.CONTENT_TYPES.image.allowed[number];
export type AllowedFileExtension = typeof FILE_VALIDATION_RULES.SECURITY_SCAN.allowedFileExtensions[number];
export type SelectorType = typeof SCRAPER_VALIDATION_RULES.SELECTOR_RULES.allowedTypes[number];

/**
 * Namespace containing all constant-related type definitions
 * for better organization and type safety
 */
export namespace Constants {
  export interface RateLimitConfig {
    requestsPerSecond: number;
    burstLimit: number;
    cooldownPeriod: number;
  }

  export interface RetryConfig {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
  }

  export interface ValidationPattern {
    pattern: RegExp;
    maxLength: number;
    required: boolean;
  }

  export interface SecurityConfig {
    requireSSL: boolean;
    maxLength: number;
    blacklistedDomains: string[];
    validateCertificate: boolean;
    preventIPAddresses: boolean;
    preventSpecialCharacters: boolean;
  }
}

// Ensure all exports are immutable
Object.freeze(HTTP_STATUS_CODES);
Object.freeze(ERROR_TYPES);
Object.freeze(ERROR_MESSAGES);
Object.freeze(LOG_LEVELS);
Object.freeze(RETRY_STRATEGIES);
Object.freeze(ALERT_THRESHOLDS);
Object.freeze(SCRAPER_ENGINES);
Object.freeze(SCRAPER_RATE_LIMITS);
Object.freeze(RETRY_CONFIG);
Object.freeze(URL_VALIDATION_PATTERNS);
Object.freeze(INSTITUTION_VALIDATION_RULES);
Object.freeze(SCRAPER_VALIDATION_RULES);
Object.freeze(USER_VALIDATION_RULES);
Object.freeze(FILE_VALIDATION_RULES);
Object.freeze(API_VALIDATION_RULES);