/**
 * @fileoverview Controller handling HTTP endpoints for web scraping operations
 * with comprehensive error handling, rate limiting, and monitoring capabilities.
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // v6.0.1
import { Request, Response } from 'express'; // v4.18.0
import { Counter, Gauge, Histogram } from 'prometheus-client'; // v14.0.0

import { ScraperService } from '../../services/scraper.service';
import { 
  ScraperJob, 
  ScraperResult, 
  ScraperError, 
  ScraperMetrics 
} from '../../interfaces/scraper.interface';
import { 
  validateURLConfig, 
  validatePagination, 
  validateRateLimits 
} from '../middleware/validation.middleware';
import { logger } from '../../utils/logger.util';
import { ERROR_TYPES } from '../../constants/error.constants';
import { API_VALIDATION_RULES } from '../../constants/validation.constants';

/**
 * Controller handling web scraping operations across 375+ institutions
 * with comprehensive monitoring and error handling
 */
@injectable()
export class ScraperController {
  // Prometheus metrics
  private readonly scrapeRequestsTotal: Counter;
  private readonly activeScrapingJobs: Gauge;
  private readonly scrapingDuration: Histogram;
  private readonly errorRate: Counter;
  private readonly rateLimitHits: Counter;

  constructor(private readonly scraperService: ScraperService) {
    this.initializeMetrics();
  }

  /**
   * Initializes Prometheus metrics for monitoring
   */
  private initializeMetrics(): void {
    this.scrapeRequestsTotal = new Counter({
      name: 'scraper_requests_total',
      help: 'Total number of scraping requests',
      labelNames: ['institution_type', 'status']
    });

    this.activeScrapingJobs = new Gauge({
      name: 'scraper_active_jobs',
      help: 'Number of currently active scraping jobs',
      labelNames: ['institution_type']
    });

    this.scrapingDuration = new Histogram({
      name: 'scraper_duration_seconds',
      help: 'Duration of scraping operations',
      labelNames: ['institution_type'],
      buckets: [1, 5, 10, 30, 60, 120, 300]
    });

    this.errorRate = new Counter({
      name: 'scraper_errors_total',
      help: 'Total number of scraping errors',
      labelNames: ['institution_type', 'error_type']
    });

    this.rateLimitHits = new Counter({
      name: 'scraper_rate_limit_hits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['institution_type']
    });
  }

  /**
   * Handles POST request to schedule a new scraping job
   * @route POST /api/scraper/jobs
   */
  @validateURLConfig()
  @validateRateLimits()
  public async scheduleJob(req: Request, res: Response): Promise<Response> {
    const startTime = Date.now();
    const correlationId = req.headers['x-correlation-id'] as string;

    logger.setContext({ correlationId, operation: 'scheduleJob' });
    logger.info('Scheduling new scraping job', { body: req.body });

    try {
      const job: ScraperJob = {
        id: correlationId,
        url: req.body.url,
        institutionType: req.body.institution.type,
        config: req.body.scraperConfig,
        rateLimitConfig: req.body.rateLimitConfig,
        retryConfig: req.body.retryConfig,
        status: 'pending',
        retryCount: 0,
        validationRules: req.body.validationRules
      };

      // Update metrics before job start
      this.activeScrapingJobs.inc({ institution_type: job.institutionType });
      this.scrapeRequestsTotal.inc({ 
        institution_type: job.institutionType, 
        status: 'scheduled' 
      });

      const result = await this.scraperService.scheduleJob(job);

      // Record job duration
      const duration = (Date.now() - startTime) / 1000;
      this.scrapingDuration.observe(
        { institution_type: job.institutionType },
        duration
      );

      return res.status(202).json({
        success: true,
        jobId: job.id,
        status: 'scheduled',
        estimatedDuration: duration,
        _links: {
          status: `/api/scraper/jobs/${job.id}/status`,
          results: `/api/scraper/jobs/${job.id}/results`,
          cancel: `/api/scraper/jobs/${job.id}`
        }
      });

    } catch (error) {
      return this.handleError(error, res, job?.institutionType);
    } finally {
      logger.clearContext();
    }
  }

  /**
   * Handles GET request to retrieve job status
   * @route GET /api/scraper/jobs/:jobId/status
   */
  public async getJobStatus(req: Request, res: Response): Promise<Response> {
    const { jobId } = req.params;
    logger.setContext({ correlationId: jobId, operation: 'getJobStatus' });

    try {
      const status = await this.scraperService.getJobStatus(jobId);
      return res.status(200).json({
        success: true,
        jobId,
        ...status,
        _links: {
          self: `/api/scraper/jobs/${jobId}/status`,
          results: status.status === 'completed' 
            ? `/api/scraper/jobs/${jobId}/results` 
            : undefined
        }
      });

    } catch (error) {
      return this.handleError(error, res);
    } finally {
      logger.clearContext();
    }
  }

  /**
   * Handles DELETE request to cancel a running job
   * @route DELETE /api/scraper/jobs/:jobId
   */
  public async cancelJob(req: Request, res: Response): Promise<Response> {
    const { jobId } = req.params;
    logger.setContext({ correlationId: jobId, operation: 'cancelJob' });

    try {
      await this.scraperService.cancelJob(jobId);
      
      // Update metrics
      this.activeScrapingJobs.dec({ 
        institution_type: req.body.institutionType 
      });

      return res.status(200).json({
        success: true,
        jobId,
        status: 'cancelled',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      return this.handleError(error, res);
    } finally {
      logger.clearContext();
    }
  }

  /**
   * Handles GET request to retrieve job results with pagination
   * @route GET /api/scraper/jobs/:jobId/results
   */
  @validatePagination()
  public async getJobResults(req: Request, res: Response): Promise<Response> {
    const { jobId } = req.params;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || API_VALIDATION_RULES.PAGINATION.defaultLimit;

    logger.setContext({ correlationId: jobId, operation: 'getJobResults' });

    try {
      const results = await this.scraperService.getJobResults(jobId, page, limit);
      
      return res.status(200).json({
        success: true,
        jobId,
        data: results.data,
        pagination: {
          page,
          limit,
          total: results.total,
          pages: Math.ceil(results.total / limit)
        },
        _links: {
          self: `/api/scraper/jobs/${jobId}/results?page=${page}&limit=${limit}`,
          first: `/api/scraper/jobs/${jobId}/results?page=1&limit=${limit}`,
          last: `/api/scraper/jobs/${jobId}/results?page=${Math.ceil(results.total / limit)}&limit=${limit}`,
          next: page * limit < results.total 
            ? `/api/scraper/jobs/${jobId}/results?page=${page + 1}&limit=${limit}` 
            : undefined,
          prev: page > 1 
            ? `/api/scraper/jobs/${jobId}/results?page=${page - 1}&limit=${limit}` 
            : undefined
        }
      });

    } catch (error) {
      return this.handleError(error, res);
    } finally {
      logger.clearContext();
    }
  }

  /**
   * Handles GET request to retrieve scraping metrics
   * @route GET /api/scraper/metrics
   */
  public async getMetrics(req: Request, res: Response): Promise<Response> {
    logger.setContext({ operation: 'getMetrics' });

    try {
      const metrics = await this.scraperService.getMetrics();
      
      return res.status(200).json({
        success: true,
        timestamp: new Date().toISOString(),
        metrics: {
          activeJobs: this.activeScrapingJobs.values,
          totalRequests: this.scrapeRequestsTotal.values,
          errorRates: this.errorRate.values,
          rateLimitHits: this.rateLimitHits.values,
          performance: {
            averageDuration: this.scrapingDuration.values,
            ...metrics.performance
          },
          resourceUsage: metrics.resourceUsage
        }
      });

    } catch (error) {
      return this.handleError(error, res);
    } finally {
      logger.clearContext();
    }
  }

  /**
   * Centralized error handling with metrics update
   */
  private handleError(error: any, res: Response, institutionType?: string): Response {
    const errorResponse = {
      success: false,
      error: {
        type: error.type || ERROR_TYPES.INTERNAL_ERROR,
        message: error.message || 'An unexpected error occurred',
        code: error.statusCode || 500
      }
    };

    // Update error metrics
    if (institutionType) {
      this.errorRate.inc({ 
        institution_type: institutionType,
        error_type: errorResponse.error.type
      });

      if (error.type === ERROR_TYPES.RATE_LIMITED) {
        this.rateLimitHits.inc({ institution_type: institutionType });
      }
    }

    logger.error('Scraper operation failed', error);
    return res.status(errorResponse.error.code).json(errorResponse);
  }
}