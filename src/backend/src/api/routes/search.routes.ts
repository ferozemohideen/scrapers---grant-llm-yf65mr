/**
 * @fileoverview Express router configuration for technology transfer search endpoints
 * Implements high-performance semantic search with faceted filtering, pagination,
 * request validation, authentication, cache management, and monitoring capabilities
 * @version 1.0.0
 */

import { Router, Request, Response, NextFunction } from 'express'; // v4.18.0
import { rateLimit } from 'express-rate-limit'; // v6.0.0
import { SearchController } from '../controllers/search.controller';
import { validateRequest, validatePagination } from '../middleware/validation.middleware';
import { authMiddleware, authorize } from '../middleware/auth.middleware';
import { logger } from '../../utils/logger.util';
import { UserRole } from '../../interfaces/auth.interface';
import { API_VALIDATION_RULES } from '../../constants/validation.constants';

// Initialize router
const searchRouter = Router();

// Get singleton instance of SearchController
const searchController = SearchController.getInstance();

// Request correlation middleware
const correlationMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.correlationId = req.headers['x-correlation-id'] as string || crypto.randomUUID();
  logger.setContext({ correlationId: req.correlationId });
  next();
};

// Request logging middleware
const requestLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logger.info('Search request completed', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
      correlationId: req.correlationId
    });
  });
  
  next();
};

// Search validation schema
const searchParamsSchema = {
  query: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 500
  },
  filters: {
    type: 'object',
    required: false,
    properties: {
      institution: { type: 'array' },
      category: { type: 'array' },
      country: { type: 'array' },
      dateRange: {
        type: 'object',
        properties: {
          start: { type: 'date' },
          end: { type: 'date' }
        }
      }
    }
  }
};

// Cache management schema
const clearCacheSchema = {
  type: 'object',
  properties: {
    pattern: {
      type: 'string',
      required: false
    }
  }
};

// Configure rate limiting
const searchRateLimit = rateLimit({
  windowMs: API_VALIDATION_RULES.RATE_LIMITING.window,
  max: API_VALIDATION_RULES.RATE_LIMITING.maxRequests.authenticated,
  message: 'Too many search requests, please try again later',
  standardHeaders: true,
  legacyHeaders: false
});

const adminRateLimit = rateLimit({
  windowMs: 300000, // 5 minutes
  max: 5,
  message: 'Too many admin requests, please try again later'
});

// Search endpoint with comprehensive middleware stack
searchRouter.get('/search',
  correlationMiddleware,
  requestLoggingMiddleware,
  searchRateLimit,
  authMiddleware,
  validateRequest(searchParamsSchema),
  validatePagination({ maxLimit: API_VALIDATION_RULES.PAGINATION.maxLimit }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await searchController.search(
        req.query.query as string,
        req.query.filters as any,
        {
          page: parseInt(req.query.page as string) || 1,
          limit: parseInt(req.query.limit as string) || API_VALIDATION_RULES.PAGINATION.defaultLimit
        }
      );

      res.status(200)
        .set({
          'Cache-Control': 'public, max-age=300',
          'X-Response-Time': `${Date.now() - (req as any).startTime}ms`,
          'X-Correlation-ID': req.correlationId
        })
        .json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Cache management endpoints (admin only)
searchRouter.post('/clear-cache',
  correlationMiddleware,
  requestLoggingMiddleware,
  adminRateLimit,
  authMiddleware,
  authorize([UserRole.ADMIN]),
  validateRequest(clearCacheSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await searchController.clearCache(req.body.pattern);
      
      logger.info('Cache cleared', {
        admin: (req as any).user.email,
        pattern: req.body.pattern
      });

      res.status(200).json({
        message: 'Cache cleared successfully',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

// Cache statistics endpoint (admin only)
searchRouter.get('/cache-stats',
  correlationMiddleware,
  requestLoggingMiddleware,
  authMiddleware,
  authorize([UserRole.ADMIN]),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await searchController.getCacheStats();
      
      res.status(200).json({
        ...stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      next(error);
    }
  }
);

export default searchRouter;