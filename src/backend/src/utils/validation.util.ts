/**
 * @fileoverview Comprehensive validation utilities for the Technology Transfer Data Aggregation System
 * @version 1.0.0
 * @license MIT
 */

import { ERROR_TYPES, ERROR_MESSAGES } from '../constants/error.constants';
import {
  URL_VALIDATION_PATTERNS,
  INSTITUTION_VALIDATION_RULES,
  SCRAPER_VALIDATION_RULES
} from '../constants/validation.constants';

/**
 * Interface for validation performance metrics
 */
interface ValidationMetrics {
  executionTime: number;
  memoryUsage: number;
  timestamp: string;
}

/**
 * Interface for detailed validation errors
 */
interface ValidationError {
  code: string;
  message: string;
  field: string;
  value: any;
}

/**
 * Interface for validation results with enhanced metrics
 */
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  metrics: ValidationMetrics;
}

/**
 * Interface for institution configuration
 */
interface InstitutionConfig {
  name: string;
  url: string;
  type: string;
  active: boolean;
  selectors?: {
    title: string;
    description: string;
    pagination?: string;
  };
  rate_limit?: number;
}

/**
 * Interface for scraper configuration
 */
interface ScraperConfig {
  selector_type: string;
  rate_limit: number;
  retry_attempts: number;
  timeout: number;
  headers?: Record<string, string>;
  proxy?: string;
}

/**
 * Validates a URL string against defined patterns and security rules
 * @param url - URL string to validate
 * @returns ValidationResult object with validation status and details
 */
export function validateURL(url: string): ValidationResult {
  const startTime = performance.now();
  const errors: ValidationError[] = [];

  try {
    // Basic input validation
    if (!url || typeof url !== 'string') {
      errors.push({
        code: ERROR_TYPES.VALIDATION_ERROR,
        message: 'URL must be a non-empty string',
        field: 'url',
        value: url
      });
      return createValidationResult(false, errors, startTime);
    }

    // URL format validation
    if (!URL_VALIDATION_PATTERNS.URL_REGEX.test(url)) {
      errors.push({
        code: ERROR_TYPES.VALIDATION_ERROR,
        message: 'Invalid URL format',
        field: 'url',
        value: url
      });
      return createValidationResult(false, errors, startTime);
    }

    // Protocol validation
    const urlProtocol = new URL(url).protocol.replace(':', '');
    if (!URL_VALIDATION_PATTERNS.ALLOWED_PROTOCOLS.includes(urlProtocol)) {
      errors.push({
        code: ERROR_TYPES.VALIDATION_ERROR,
        message: 'URL must use HTTPS protocol',
        field: 'protocol',
        value: urlProtocol
      });
      return createValidationResult(false, errors, startTime);
    }

    // Security validations
    if (URL_VALIDATION_PATTERNS.SECURITY_CHECKS.preventIPAddresses && 
        /^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(url)) {
      errors.push({
        code: ERROR_TYPES.VALIDATION_ERROR,
        message: 'Direct IP addresses are not allowed',
        field: 'url',
        value: url
      });
      return createValidationResult(false, errors, startTime);
    }

    return createValidationResult(true, [], startTime);
  } catch (error) {
    errors.push({
      code: ERROR_TYPES.VALIDATION_ERROR,
      message: 'URL validation failed',
      field: 'url',
      value: url
    });
    return createValidationResult(false, errors, startTime);
  }
}

/**
 * Validates institution configuration with enhanced security checks
 * @param institutionConfig - Institution configuration object
 * @returns ValidationResult object with validation status and details
 */
export function validateInstitution(institutionConfig: InstitutionConfig): ValidationResult {
  const startTime = performance.now();
  const errors: ValidationError[] = [];

  try {
    // Name validation
    if (!institutionConfig.name || 
        institutionConfig.name.length < INSTITUTION_VALIDATION_RULES.NAME_CONSTRAINTS.minLength ||
        institutionConfig.name.length > INSTITUTION_VALIDATION_RULES.NAME_CONSTRAINTS.maxLength) {
      errors.push({
        code: ERROR_TYPES.VALIDATION_ERROR,
        message: `Institution name must be between ${INSTITUTION_VALIDATION_RULES.NAME_CONSTRAINTS.minLength} and ${INSTITUTION_VALIDATION_RULES.NAME_CONSTRAINTS.maxLength} characters`,
        field: 'name',
        value: institutionConfig.name
      });
    }

    // Type validation
    if (!INSTITUTION_VALIDATION_RULES.ALLOWED_TYPES.includes(institutionConfig.type as any)) {
      errors.push({
        code: ERROR_TYPES.VALIDATION_ERROR,
        message: `Invalid institution type. Allowed types: ${INSTITUTION_VALIDATION_RULES.ALLOWED_TYPES.join(', ')}`,
        field: 'type',
        value: institutionConfig.type
      });
    }

    // URL validation
    const urlValidation = validateURL(institutionConfig.url);
    if (!urlValidation.isValid) {
      errors.push(...urlValidation.errors);
    }

    // Selectors validation if present
    if (institutionConfig.selectors) {
      if (!institutionConfig.selectors.title || !institutionConfig.selectors.description) {
        errors.push({
          code: ERROR_TYPES.VALIDATION_ERROR,
          message: 'Title and description selectors are required',
          field: 'selectors',
          value: institutionConfig.selectors
        });
      }
    }

    // Rate limit validation
    if (institutionConfig.rate_limit !== undefined) {
      const { maxRequestsPerSecond } = SCRAPER_VALIDATION_RULES.RATE_LIMITS;
      const maxRate = maxRequestsPerSecond[institutionConfig.type as keyof typeof maxRequestsPerSecond] || 
                     maxRequestsPerSecond.default;
      
      if (institutionConfig.rate_limit > maxRate) {
        errors.push({
          code: ERROR_TYPES.VALIDATION_ERROR,
          message: `Rate limit cannot exceed ${maxRate} requests per second for ${institutionConfig.type}`,
          field: 'rate_limit',
          value: institutionConfig.rate_limit
        });
      }
    }

    return createValidationResult(errors.length === 0, errors, startTime);
  } catch (error) {
    errors.push({
      code: ERROR_TYPES.VALIDATION_ERROR,
      message: 'Institution validation failed',
      field: 'institution',
      value: institutionConfig
    });
    return createValidationResult(false, errors, startTime);
  }
}

/**
 * Validates scraper configuration settings with performance optimizations
 * @param scraperConfig - Scraper configuration object
 * @returns ValidationResult object with validation status and details
 */
export function validateScraperConfig(scraperConfig: ScraperConfig): ValidationResult {
  const startTime = performance.now();
  const errors: ValidationError[] = [];

  try {
    // Selector type validation
    if (!SCRAPER_VALIDATION_RULES.SELECTOR_RULES.allowedTypes.includes(scraperConfig.selector_type as any)) {
      errors.push({
        code: ERROR_TYPES.VALIDATION_ERROR,
        message: `Invalid selector type. Allowed types: ${SCRAPER_VALIDATION_RULES.SELECTOR_RULES.allowedTypes.join(', ')}`,
        field: 'selector_type',
        value: scraperConfig.selector_type
      });
    }

    // Rate limit validation
    if (scraperConfig.rate_limit < SCRAPER_VALIDATION_RULES.RATE_LIMITS.minDelay) {
      errors.push({
        code: ERROR_TYPES.VALIDATION_ERROR,
        message: `Rate limit cannot be less than ${SCRAPER_VALIDATION_RULES.RATE_LIMITS.minDelay}ms`,
        field: 'rate_limit',
        value: scraperConfig.rate_limit
      });
    }

    // Retry attempts validation
    if (scraperConfig.retry_attempts > SCRAPER_VALIDATION_RULES.RETRY_POLICY.maxAttempts) {
      errors.push({
        code: ERROR_TYPES.VALIDATION_ERROR,
        message: `Retry attempts cannot exceed ${SCRAPER_VALIDATION_RULES.RETRY_POLICY.maxAttempts}`,
        field: 'retry_attempts',
        value: scraperConfig.retry_attempts
      });
    }

    // Timeout validation
    if (scraperConfig.timeout <= 0) {
      errors.push({
        code: ERROR_TYPES.VALIDATION_ERROR,
        message: 'Timeout must be a positive number',
        field: 'timeout',
        value: scraperConfig.timeout
      });
    }

    // Custom headers validation if present
    if (scraperConfig.headers) {
      for (const [key, value] of Object.entries(scraperConfig.headers)) {
        if (typeof value !== 'string') {
          errors.push({
            code: ERROR_TYPES.VALIDATION_ERROR,
            message: 'Header values must be strings',
            field: `headers.${key}`,
            value: value
          });
        }
      }
    }

    // Proxy validation if present
    if (scraperConfig.proxy) {
      const proxyValidation = validateURL(scraperConfig.proxy);
      if (!proxyValidation.isValid) {
        errors.push({
          code: ERROR_TYPES.VALIDATION_ERROR,
          message: 'Invalid proxy URL',
          field: 'proxy',
          value: scraperConfig.proxy
        });
      }
    }

    return createValidationResult(errors.length === 0, errors, startTime);
  } catch (error) {
    errors.push({
      code: ERROR_TYPES.VALIDATION_ERROR,
      message: 'Scraper configuration validation failed',
      field: 'scraper_config',
      value: scraperConfig
    });
    return createValidationResult(false, errors, startTime);
  }
}

/**
 * Helper function to create a validation result with performance metrics
 * @param isValid - Validation status
 * @param errors - Array of validation errors
 * @param startTime - Start time of validation
 * @returns ValidationResult object
 */
function createValidationResult(
  isValid: boolean,
  errors: ValidationError[],
  startTime: number
): ValidationResult {
  return {
    isValid,
    errors,
    metrics: {
      executionTime: performance.now() - startTime,
      memoryUsage: process.memoryUsage().heapUsed,
      timestamp: new Date().toISOString()
    }
  };
}