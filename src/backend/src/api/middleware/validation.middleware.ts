/**
 * @fileoverview Express middleware for request validation with enhanced security and performance
 * @version 1.0.0
 * @license MIT
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { validateURL, validateInstitution, validateScraperConfig } from '../../utils/validation.util';
import { ERROR_TYPES, ERROR_MESSAGES } from '../../constants/error.constants';
import { AppError } from '../../utils/error.util';
import { API_VALIDATION_RULES } from '../../constants/validation.constants';

// Cache for validation results to improve performance
const validationCache = new Map<string, {
  result: boolean;
  timestamp: number;
  key: string;
}>();

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache TTL

/**
 * Interface for validation schema
 */
interface ValidationSchema {
  type: string;
  required?: boolean;
  properties?: Record<string, ValidationSchema>;
  pattern?: RegExp;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
}

/**
 * Generic request validation middleware factory with enhanced security
 * @param schema - Validation schema for request data
 * @returns Express middleware function
 */
export function validateRequest(schema: ValidationSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = req.body;
      const cacheKey = generateCacheKey(schema, data);

      // Check cache first
      const cachedResult = validationCache.get(cacheKey);
      if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
        if (!cachedResult.result) {
          throw new AppError(
            'Validation failed',
            ERROR_TYPES.VALIDATION_ERROR,
            400,
            { schema: schema.type }
          );
        }
        return next();
      }

      // Perform validation
      const isValid = await validateData(data, schema);
      
      // Update cache
      validationCache.set(cacheKey, {
        result: isValid,
        timestamp: Date.now(),
        key: cacheKey
      });

      if (!isValid) {
        throw new AppError(
          'Validation failed',
          ERROR_TYPES.VALIDATION_ERROR,
          400,
          { schema: schema.type }
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Enhanced URL configuration validation middleware
 */
export function validateURLConfig(req: Request, res: Response, next: NextFunction): void {
  try {
    const { url, institution, scraperConfig } = req.body;

    // Validate URL with enhanced security checks
    const urlValidation = validateURL(url);
    if (!urlValidation.isValid) {
      throw new AppError(
        'Invalid URL configuration',
        ERROR_TYPES.VALIDATION_ERROR,
        400,
        { errors: urlValidation.errors }
      );
    }

    // Validate institution configuration
    const institutionValidation = validateInstitution(institution);
    if (!institutionValidation.isValid) {
      throw new AppError(
        'Invalid institution configuration',
        ERROR_TYPES.VALIDATION_ERROR,
        400,
        { errors: institutionValidation.errors }
      );
    }

    // Validate scraper configuration
    const scraperValidation = validateScraperConfig(scraperConfig);
    if (!scraperValidation.isValid) {
      throw new AppError(
        'Invalid scraper configuration',
        ERROR_TYPES.VALIDATION_ERROR,
        400,
        { errors: scraperValidation.errors }
      );
    }

    // Log validation metrics
    logValidationMetrics({
      url: urlValidation.metrics,
      institution: institutionValidation.metrics,
      scraper: scraperValidation.metrics
    });

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Pagination parameters validation middleware with range enforcement
 */
export function validatePagination(req: Request, res: Response, next: NextFunction): void {
  try {
    const { page, limit } = req.query;
    const rules = API_VALIDATION_RULES.PAGINATION;

    // Validate and sanitize page number
    const pageNum = parseInt(page as string) || 1;
    if (pageNum < 1) {
      throw new AppError(
        'Invalid page number',
        ERROR_TYPES.VALIDATION_ERROR,
        400,
        { page: pageNum }
      );
    }

    // Validate and sanitize limit with range enforcement
    let limitNum = parseInt(limit as string) || rules.defaultLimit;
    if (limitNum > rules.maxLimit) {
      limitNum = rules.maxLimit;
    }

    // Attach sanitized pagination parameters to request
    req.query.page = pageNum.toString();
    req.query.limit = limitNum.toString();

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Helper function to validate data against schema
 */
async function validateData(data: any, schema: ValidationSchema): Promise<boolean> {
  try {
    // Check required fields
    if (schema.required && (data === undefined || data === null)) {
      return false;
    }

    // Validate type
    if (schema.type && typeof data !== schema.type) {
      return false;
    }

    // Validate string patterns
    if (schema.pattern && typeof data === 'string' && !schema.pattern.test(data)) {
      return false;
    }

    // Validate string length
    if (typeof data === 'string') {
      if (schema.minLength && data.length < schema.minLength) return false;
      if (schema.maxLength && data.length > schema.maxLength) return false;
    }

    // Validate number ranges
    if (typeof data === 'number') {
      if (schema.minimum !== undefined && data < schema.minimum) return false;
      if (schema.maximum !== undefined && data > schema.maximum) return false;
    }

    // Validate nested properties
    if (schema.properties && typeof data === 'object') {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (!(await validateData(data[key], propertySchema))) {
          return false;
        }
      }
    }

    return true;
  } catch (error) {
    console.error('Validation error:', error);
    return false;
  }
}

/**
 * Helper function to generate cache key for validation results
 */
function generateCacheKey(schema: ValidationSchema, data: any): string {
  return `${schema.type}:${JSON.stringify(data)}`;
}

/**
 * Helper function to log validation metrics
 */
function logValidationMetrics(metrics: Record<string, any>): void {
  console.log({
    timestamp: new Date().toISOString(),
    type: 'VALIDATION_METRICS',
    metrics
  });
}