/**
 * @fileoverview Repository class for managing scraping job data access operations
 * with enhanced rate limiting and error handling capabilities. Supports 375+ institutions
 * with configurable scraping strategies and comprehensive metrics tracking.
 * @version 1.0.0
 */

import mongoose from 'mongoose';
import { ScrapeJob } from '../models/scrapeJob.model';
import {
  ScraperJob,
  ScraperResult,
  ScraperError,
  RateLimitMetrics
} from '../../interfaces/scraper.interface';
import {
  ERROR_TYPES,
  RETRY_CONFIG,
  SCRAPER_RATE_LIMITS
} from '../../constants/scraper.constants';

// Cache TTL for rate limit metrics (1 hour)
const RATE_LIMIT_CACHE_TTL = 3600000;

/**
 * Repository class for managing scraping job operations with enhanced
 * rate limiting and error handling capabilities
 */
export class ScrapeJobRepository {
  private _model: mongoose.Model<any>;
  private _rateLimitCache: Map<string, RateLimitMetrics>;

  constructor() {
    this._model = ScrapeJob;
    this._rateLimitCache = new Map<string, RateLimitMetrics>();

    // Setup periodic cache cleanup
    setInterval(() => this.cleanupRateLimitCache(), RATE_LIMIT_CACHE_TTL);
  }

  /**
   * Creates a new scraping job with enhanced validation and rate limit checking
   * @param jobData Job configuration and metadata
   * @returns Created job document
   */
  async createJob(jobData: ScraperJob): Promise<any> {
    try {
      // Validate institution-specific rate limits
      const rateLimits = SCRAPER_RATE_LIMITS[jobData.institutionType as keyof typeof SCRAPER_RATE_LIMITS] || 
        SCRAPER_RATE_LIMITS.DEFAULT;

      // Check current rate limit status
      const canProceed = await this.checkRateLimit(jobData.institutionType);
      if (!canProceed) {
        throw new Error(`Rate limit exceeded for institution: ${jobData.institutionType}`);
      }

      // Initialize rate limit metrics
      const rateLimitMetrics: RateLimitMetrics = {
        requestCount: 0,
        burstCount: 0,
        throttledRequests: 0,
        queuedRequests: 0,
        cooldownPeriods: 0,
        averageRequestTime: 0
      };

      // Create new job document
      const job = new this._model({
        ...jobData,
        config: {
          ...jobData.config,
          ...rateLimits
        },
        rateLimitMetrics
      });

      await job.save();
      return job;
    } catch (error) {
      throw new Error(`Failed to create scraping job: ${error.message}`);
    }
  }

  /**
   * Updates job status with enhanced rate limit tracking and metrics
   * @param jobId Unique job identifier
   * @param status New job status
   * @param result Scraping operation results
   * @returns Updated job document
   */
  async updateJobStatus(
    jobId: string,
    status: string,
    result?: ScraperResult
  ): Promise<any> {
    try {
      const job = await this._model.findById(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      // Update job status and metrics
      job.status = status;
      if (result) {
        job.itemsProcessed = result.data ? Object.keys(result.data).length : 0;
        job.rateLimitMetrics = {
          ...job.rateLimitMetrics,
          ...result.rateLimitMetrics
        };
        job.performanceMetrics = result.performanceMetrics;
      }

      // Update rate limit cache
      if (job.rateLimitMetrics) {
        this._rateLimitCache.set(job.institutionType, job.rateLimitMetrics);
      }

      await job.save();
      return job;
    } catch (error) {
      throw new Error(`Failed to update job status: ${error.message}`);
    }
  }

  /**
   * Handles job errors with institution-specific retry logic and recovery suggestions
   * @param jobId Unique job identifier
   * @param error Error information and context
   * @returns Updated job document
   */
  async handleJobError(jobId: string, error: ScraperError): Promise<any> {
    try {
      const job = await this._model.findById(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      // Generate recovery suggestions based on error type
      const recoverySuggestions = this.generateRecoverySuggestions(error);

      // Update error information
      job.error = {
        type: error.type,
        message: error.message,
        stack: error.stack,
        recoverySuggestion: recoverySuggestions[0] // Use first suggestion
      };

      // Check retry eligibility
      if (job.canRetry()) {
        job.retryCount += 1;
        job.status = 'retrying';
      } else {
        job.status = 'failed';
      }

      // Update rate limit status if applicable
      if (error.type === ERROR_TYPES.RATE_LIMITED) {
        job.rateLimitMetrics.isRateLimited = true;
        job.rateLimitMetrics.cooldownEndTime = new Date(
          Date.now() + (job.config.cooldownPeriod * 1000)
        );
      }

      await job.save();
      return job;
    } catch (error) {
      throw new Error(`Failed to handle job error: ${error.message}`);
    }
  }

  /**
   * Verifies rate limit status for an institution
   * @param institutionType Type of institution being scraped
   * @returns Boolean indicating if requests can proceed
   */
  async checkRateLimit(institutionType: string): Promise<boolean> {
    const rateLimits = SCRAPER_RATE_LIMITS[institutionType as keyof typeof SCRAPER_RATE_LIMITS] || 
      SCRAPER_RATE_LIMITS.DEFAULT;
    
    const metrics = this._rateLimitCache.get(institutionType);
    if (!metrics) {
      return true; // No rate limit data yet
    }

    // Check if in cooldown period
    if (metrics.isRateLimited) {
      return false;
    }

    // Check current request count against limits
    const currentRate = metrics.requestCount / rateLimits.requestsPerSecond;
    const withinBurst = metrics.burstCount < rateLimits.burstLimit;

    return currentRate <= 1 && withinBurst;
  }

  /**
   * Generates recovery suggestions based on error type and context
   * @param error Error information
   * @returns Array of recovery suggestions
   */
  private generateRecoverySuggestions(error: ScraperError): string[] {
    const suggestions: string[] = [];

    switch (error.type) {
      case ERROR_TYPES.NETWORK_TIMEOUT:
        suggestions.push('Check network connectivity and DNS resolution');
        suggestions.push('Verify proxy configuration if applicable');
        break;
      case ERROR_TYPES.RATE_LIMITED:
        suggestions.push(`Wait for cooldown period: ${error.rateLimitStatus.resetTime}`);
        suggestions.push('Adjust rate limit configuration for institution');
        break;
      case ERROR_TYPES.PARSE_ERROR:
        suggestions.push('Verify HTML structure and selectors');
        suggestions.push('Update scraping rules for changed layout');
        break;
      case ERROR_TYPES.AUTHENTICATION_ERROR:
        suggestions.push('Verify authentication credentials');
        suggestions.push('Check for expired sessions or tokens');
        break;
      default:
        suggestions.push('Review error logs for detailed information');
        suggestions.push('Contact system administrator if issue persists');
    }

    return suggestions;
  }

  /**
   * Cleans up expired rate limit cache entries
   */
  private cleanupRateLimitCache(): void {
    const now = Date.now();
    for (const [institutionType, metrics] of this._rateLimitCache.entries()) {
      if (metrics.cooldownEndTime && new Date(metrics.cooldownEndTime).getTime() < now) {
        this._rateLimitCache.delete(institutionType);
      }
    }
  }
}