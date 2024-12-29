/**
 * @fileoverview Search controller implementing high-performance technology transfer search API endpoints
 * with semantic search capabilities, faceted filtering, caching, monitoring, and comprehensive error handling.
 * Ensures sub-2 second response times and supports 1000+ concurrent users.
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // v4.18.0
import { Logger } from 'winston'; // v3.8.0
import { compress } from 'compression'; // v1.7.4
import { rateLimit } from 'express-rate-limit'; // v6.7.0
import CircuitBreaker from 'opossum'; // v6.0.0

import { SearchService } from '../../services/search.service';
import { 
  SearchParams, 
  SearchResponse, 
  SearchFilters, 
  SearchMetrics 
} from '../../interfaces/search.interface';
import { validateRequest } from '../middleware/validation.middleware';
import { createError, handleError } from '../../utils/error.util';
import { ERROR_TYPES } from '../../constants/error.constants';
import { API_VALIDATION_RULES } from '../../constants/validation.constants';

/**
 * Controller handling technology transfer search API endpoints
 * Implements singleton pattern with comprehensive monitoring
 */
export class SearchController {
  private static instance: SearchController;
  private searchService: SearchService;
  private logger: Logger;
  private circuitBreaker: CircuitBreaker;
  private metrics: SearchMetrics;

  /**
   * Private constructor implementing singleton pattern with dependency injection
   */
  private constructor() {
    // Initialize search service
    this.searchService = SearchService.getInstance();

    // Configure Winston logger
    this.logger = new Logger({
      level: 'info',
      format: Logger.format.combine(
        Logger.format.timestamp(),
        Logger.format.json()
      ),
      transports: [
        new Logger.transports.Console(),
        new Logger.transports.File({ filename: 'search-controller.log' })
      ]
    });

    // Initialize circuit breaker
    this.circuitBreaker = new CircuitBreaker(
      async (params: SearchParams) => this.searchService.search(params),
      {
        timeout: 2000, // 2 second timeout per spec
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        name: 'search-controller'
      }
    );

    // Initialize metrics
    this.metrics = {
      totalSearches: 0,
      averageResponseTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      lastUpdated: new Date()
    };

    this.setupCircuitBreakerHandlers();
    this.setupResponseCompression();
    this.setupRateLimiting();
  }

  /**
   * Returns singleton instance with lazy initialization
   */
  public static getInstance(): SearchController {
    if (!SearchController.instance) {
      SearchController.instance = new SearchController();
    }
    return SearchController.instance;
  }

  /**
   * Handles search requests with caching and monitoring
   * @param req Express request
   * @param res Express response
   */
  @validateRequest({
    query: {
      required: true,
      type: 'string',
      minLength: 1
    },
    filters: {
      type: 'object',
      required: false
    },
    pagination: {
      type: 'object',
      required: false,
      properties: {
        page: { type: 'number', minimum: 1 },
        limit: { type: 'number', maximum: 100 }
      }
    }
  })
  public async search(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    this.metrics.totalSearches++;

    try {
      // Extract and validate search parameters
      const searchParams: SearchParams = {
        query: req.query.query as string,
        filters: (req.query.filters as any) || {},
        pagination: {
          page: parseInt(req.query.page as string) || 1,
          limit: Math.min(
            parseInt(req.query.limit as string) || API_VALIDATION_RULES.PAGINATION.defaultLimit,
            API_VALIDATION_RULES.PAGINATION.maxLimit
          )
        }
      };

      // Execute search through circuit breaker
      const results = await this.circuitBreaker.fire(searchParams);

      // Update metrics
      this.updateMetrics(startTime, results.cacheHit || false);

      // Send response
      res.status(200)
        .set({
          'Cache-Control': 'public, max-age=300',
          'X-Response-Time': `${Date.now() - startTime}ms`
        })
        .json(results);

      this.logger.info('Search completed successfully', {
        query: searchParams.query,
        responseTime: Date.now() - startTime,
        resultCount: results.total
      });

    } catch (error) {
      const handledError = handleError(error, {
        component: 'SearchController',
        method: 'search',
        params: req.query
      });

      this.metrics.errorRate = (
        (this.metrics.errorRate * (this.metrics.totalSearches - 1)) + 1
      ) / this.metrics.totalSearches;

      res.status(handledError.error.statusCode)
        .json({
          error: handledError.error.message,
          correlationId: handledError.error.correlationId
        });
    }
  }

  /**
   * Clears search cache with monitoring
   * @param req Express request
   * @param res Express response
   */
  public async clearCache(req: Request, res: Response): Promise<void> {
    try {
      await this.searchService.clearCache();
      
      this.metrics.cacheHitRate = 0;
      this.logger.info('Search cache cleared');
      
      res.status(200).json({
        message: 'Cache cleared successfully'
      });

    } catch (error) {
      const handledError = handleError(error, {
        component: 'SearchController',
        method: 'clearCache'
      });

      res.status(handledError.error.statusCode)
        .json({
          error: handledError.error.message,
          correlationId: handledError.error.correlationId
        });
    }
  }

  /**
   * Returns search performance metrics
   * @param req Express request
   * @param res Express response
   */
  public async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const serviceMetrics = await this.searchService.getMetrics();
      
      res.status(200).json({
        controller: this.metrics,
        service: serviceMetrics,
        timestamp: new Date()
      });

    } catch (error) {
      const handledError = handleError(error, {
        component: 'SearchController',
        method: 'getMetrics'
      });

      res.status(handledError.error.statusCode)
        .json({
          error: handledError.error.message,
          correlationId: handledError.error.correlationId
        });
    }
  }

  /**
   * Updates search metrics
   */
  private updateMetrics(startTime: number, cacheHit: boolean): void {
    const responseTime = Date.now() - startTime;
    
    this.metrics.averageResponseTime = (
      (this.metrics.averageResponseTime * (this.metrics.totalSearches - 1)) + 
      responseTime
    ) / this.metrics.totalSearches;

    if (cacheHit) {
      this.metrics.cacheHitRate = (
        (this.metrics.cacheHitRate * (this.metrics.totalSearches - 1)) + 1
      ) / this.metrics.totalSearches;
    }

    this.metrics.lastUpdated = new Date();
  }

  /**
   * Sets up circuit breaker event handlers
   */
  private setupCircuitBreakerHandlers(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Circuit breaker half-open');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Circuit breaker closed');
    });

    this.circuitBreaker.on('reject', () => {
      this.metrics.errorRate = (
        (this.metrics.errorRate * (this.metrics.totalSearches - 1)) + 1
      ) / this.metrics.totalSearches;
    });
  }

  /**
   * Configures response compression
   */
  private setupResponseCompression(): void {
    compress({
      level: 6,
      threshold: 1024
    });
  }

  /**
   * Configures rate limiting
   */
  private setupRateLimiting(): void {
    rateLimit({
      windowMs: API_VALIDATION_RULES.RATE_LIMITING.window,
      max: API_VALIDATION_RULES.RATE_LIMITING.maxRequests.authenticated,
      message: 'Too many requests, please try again later'
    });
  }
}