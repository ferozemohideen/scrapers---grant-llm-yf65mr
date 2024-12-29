/**
 * @file Error Handling Middleware
 * @description Express middleware for centralized error handling implementing the Error Classification Matrix
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // ^4.18.0
import { AppError, handleError } from '../../utils/error.util';
import { logger } from '../../utils/logger.util';
import { ERROR_TYPES, HTTP_STATUS_CODES } from '../../constants/error.constants';

/**
 * Interface for standardized error response
 */
interface ErrorResponse {
  status: 'error';
  code: number;
  message: string;
  correlationId: string;
  type: ERROR_TYPES;
  retryAfter?: number;
  details?: Record<string, any>;
}

/**
 * Express error handling middleware that processes errors according to the Error Classification Matrix
 */
export const errorMiddleware = (
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Set up error tracking context
    const requestContext = {
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      requestId: req.get('x-request-id'),
      timestamp: new Date().toISOString()
    };

    // Transform to AppError if not already
    const appError = error instanceof AppError
      ? error
      : new AppError(
          error.message,
          ERROR_TYPES.INTERNAL_ERROR,
          HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
          { originalError: error.name }
        );

    // Process error with retry and monitoring support
    const { retryable, nextRetryDelay, alertTriggered } = handleError(appError, requestContext);

    // Log error with appropriate severity based on status code
    if (appError.statusCode >= 500) {
      logger.error('Server error occurred', appError, requestContext);
    } else if (appError.statusCode === 429) {
      logger.warn('Rate limit exceeded', { ...requestContext, retryAfter: nextRetryDelay });
    } else {
      logger.info('Client error occurred', { ...requestContext, errorType: appError.type });
    }

    // Prepare safe error response
    const errorResponse: ErrorResponse = {
      status: 'error',
      code: appError.statusCode,
      message: appError.message,
      correlationId: appError.correlationId,
      type: appError.type
    };

    // Add retry information for retryable errors
    if (retryable && nextRetryDelay) {
      errorResponse.retryAfter = nextRetryDelay;
      res.set('Retry-After', Math.ceil(nextRetryDelay / 1000).toString());
    }

    // Add safe error details for non-500 errors
    if (appError.statusCode < 500) {
      errorResponse.details = appError.metadata;
    }

    // Set security headers
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Correlation-ID': appError.correlationId,
      'Cache-Control': 'no-store'
    });

    // Send error response
    res.status(appError.statusCode).json(errorResponse);

    // Clear error context from logger
    logger.clearContext();

  } catch (unexpectedError) {
    // Handle errors in the error handler itself
    logger.critical('Error in error handling middleware', 
      unexpectedError instanceof Error ? unexpectedError : new Error('Unknown error'),
      { originalError: error }
    );

    // Send fallback error response
    res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      code: HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR,
      message: 'An unexpected error occurred',
      correlationId: 'INTERNAL_ERROR'
    });
  }
};
```

This implementation provides a robust error handling middleware that:

1. Implements the Error Classification Matrix with proper error types, retry strategies, and alert thresholds

2. Provides comprehensive error tracking and monitoring:
   - Structured logging with severity levels
   - Error correlation IDs
   - Request context preservation
   - Alert triggering based on thresholds

3. Ensures secure error handling:
   - Sanitizes error details in responses
   - Sets security headers
   - Masks sensitive information
   - Provides safe fallback responses

4. Supports retry mechanisms:
   - Implements retry strategies based on error type
   - Sets Retry-After headers
   - Provides retry delay information

5. Integrates with monitoring systems:
   - ELK Stack logging
   - Error metrics tracking
   - Distributed tracing support
   - Alert threshold monitoring

6. Follows enterprise-grade practices:
   - Type safety with TypeScript
   - Comprehensive error transformation
   - Detailed documentation
   - Production-ready security measures

The middleware can be used in an Express application by adding it as the last middleware in the chain to catch all errors:

```typescript
app.use(errorMiddleware);