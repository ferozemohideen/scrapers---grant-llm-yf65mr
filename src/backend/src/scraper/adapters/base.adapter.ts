/**
 * @fileoverview Abstract base adapter class providing comprehensive functionality for all scraper adapters
 * including configurable rate limiting, advanced error handling with circuit breaker pattern,
 * resource management, monitoring integration, and core scraping operations.
 * @version 1.0.0
 */

import { 
  ScraperEngine, 
  ScraperJob, 
  ScraperResult, 
  ScraperError,
  RateLimitConfig,
  MetricsCollector,
  RateLimitMetrics,
  PerformanceMetrics
} from '../../interfaces/scraper.interface';

import {
  SCRAPER_ENGINES,
  ERROR_TYPES,
  SCRAPER_RATE_LIMITS,
  RETRY_CONFIG
} from '../../constants/scraper.constants';

import {
  AppError,
  handleError,
  isRetryable,
  getRetryDelay
} from '../../utils/error.util';

import * as Bottleneck from 'bottleneck'; // v2.19.5
import * as prometheus from 'prom-client'; // v14.0.1

/**
 * Abstract base class providing comprehensive functionality for all scraper adapters
 */
export abstract class BaseAdapter {
  protected engine: ScraperEngine;
  protected rateLimitConfig: RateLimitConfig;
  protected limiter: Bottleneck;
  protected retryCount: number;
  protected metricsCollector: MetricsCollector;
  private performanceMetrics: PerformanceMetrics;
  private rateLimitMetrics: RateLimitMetrics;

  // Prometheus metrics
  private readonly scrapeCounter: prometheus.Counter;
  private readonly scrapeDurationHistogram: prometheus.Histogram;
  private readonly errorCounter: prometheus.Counter;
  private readonly rateLimitCounter: prometheus.Counter;

  /**
   * Initialize the base adapter with enhanced configuration
   */
  constructor(
    engine: ScraperEngine,
    rateLimitConfig: RateLimitConfig,
    metricsCollector: MetricsCollector
  ) {
    this.engine = engine;
    this.rateLimitConfig = rateLimitConfig;
    this.metricsCollector = metricsCollector;
    this.retryCount = 0;

    // Initialize rate limiter with dynamic adjustment
    this.limiter = new Bottleneck({
      minTime: 1000 / this.rateLimitConfig.requestsPerSecond,
      maxConcurrent: this.rateLimitConfig.burstLimit,
      reservoir: this.rateLimitConfig.burstLimit,
      reservoirRefreshAmount: this.rateLimitConfig.burstLimit,
      reservoirRefreshInterval: this.rateLimitConfig.cooldownPeriod * 1000
    });

    // Initialize Prometheus metrics
    this.scrapeCounter = new prometheus.Counter({
      name: 'scraper_requests_total',
      help: 'Total number of scrape requests',
      labelNames: ['institution', 'status']
    });

    this.scrapeDurationHistogram = new prometheus.Histogram({
      name: 'scraper_request_duration_seconds',
      help: 'Scraping request duration in seconds',
      labelNames: ['institution']
    });

    this.errorCounter = new prometheus.Counter({
      name: 'scraper_errors_total',
      help: 'Total number of scraping errors',
      labelNames: ['institution', 'error_type']
    });

    this.rateLimitCounter = new prometheus.Counter({
      name: 'scraper_rate_limits_total',
      help: 'Total number of rate limit hits',
      labelNames: ['institution']
    });

    // Initialize metrics
    this.resetMetrics();
  }

  /**
   * Core scraping method with comprehensive error handling and monitoring
   */
  public async scrape(job: ScraperJob): Promise<ScraperResult> {
    const startTime = Date.now();
    const end = this.scrapeDurationHistogram.startTimer();

    try {
      // Validate job parameters
      this.validateJob(job);

      // Increment scrape counter
      this.scrapeCounter.inc({ institution: job.institutionType });

      // Execute rate-limited scraping
      const data = await this.limiter.schedule(() => this.executeScrape(job));

      // Record success metrics
      const duration = Date.now() - startTime;
      end({ institution: job.institutionType });

      return {
        jobId: job.id,
        url: job.url,
        data,
        timestamp: new Date(),
        success: true,
        rateLimitMetrics: this.rateLimitMetrics,
        performanceMetrics: {
          ...this.performanceMetrics,
          totalDuration: duration
        },
        validationResults: {
          isValid: true,
          errors: [],
          warnings: []
        }
      };

    } catch (error) {
      return await this.handleError(error as Error, job);
    }
  }

  /**
   * Execute the actual scraping operation with monitoring
   */
  private async executeScrape(job: ScraperJob): Promise<Record<string, any>> {
    const startTime = process.hrtime();

    try {
      // Initialize engine with job configuration
      await this.engine.initialize(job.config);

      // Execute scraping
      const data = await this.engine.scrape(job.url);

      // Update performance metrics
      const [seconds, nanoseconds] = process.hrtime(startTime);
      this.performanceMetrics.processingTime = seconds * 1000 + nanoseconds / 1e6;

      return data;

    } finally {
      // Cleanup resources
      await this.engine.cleanup();
    }
  }

  /**
   * Enhanced error handling with monitoring integration
   */
  private async handleError(error: Error, job: ScraperJob): Promise<ScraperResult> {
    // Transform to AppError and handle
    const { error: appError, retryable, nextRetryDelay } = handleError(error, {
      jobId: job.id,
      url: job.url,
      institutionType: job.institutionType,
      retryCount: this.retryCount
    });

    // Update error metrics
    this.errorCounter.inc({
      institution: job.institutionType,
      error_type: appError.type
    });

    // Handle rate limiting specifically
    if (appError.type === ERROR_TYPES.RATE_LIMITED) {
      this.rateLimitCounter.inc({ institution: job.institutionType });
      await this.handleRateLimit(job);
    }

    // Attempt retry if applicable
    if (retryable && this.retryCount < job.retryConfig.maxRetries) {
      this.retryCount++;
      await new Promise(resolve => setTimeout(resolve, nextRetryDelay));
      return this.scrape(job);
    }

    // Return error result
    return {
      jobId: job.id,
      url: job.url,
      data: {},
      timestamp: new Date(),
      success: false,
      rateLimitMetrics: this.rateLimitMetrics,
      performanceMetrics: this.performanceMetrics,
      validationResults: {
        isValid: false,
        errors: [{
          field: 'scraping',
          rule: 'execution',
          message: appError.message
        }],
        warnings: []
      }
    };
  }

  /**
   * Handle rate limiting with dynamic adjustment
   */
  private async handleRateLimit(job: ScraperJob): Promise<void> {
    // Update rate limit metrics
    this.rateLimitMetrics.throttledRequests++;
    
    // Adjust rate limiter settings
    const newMinTime = this.limiter.currentReservoir
      ? (1000 / this.rateLimitConfig.requestsPerSecond) * 1.5
      : this.limiter.minTime;

    await this.limiter.updateSettings({
      minTime: newMinTime
    });

    // Wait for cooldown period
    await new Promise(resolve => 
      setTimeout(resolve, this.rateLimitConfig.cooldownPeriod * 1000)
    );
  }

  /**
   * Validate job parameters
   */
  private validateJob(job: ScraperJob): void {
    if (!job.url || !job.id || !job.institutionType) {
      throw new AppError(
        'Invalid job parameters',
        ERROR_TYPES.VALIDATION_ERROR,
        400,
        { job }
      );
    }
  }

  /**
   * Reset metrics for new scraping operation
   */
  private resetMetrics(): void {
    this.performanceMetrics = {
      startTime: new Date(),
      endTime: new Date(),
      totalDuration: 0,
      networkTime: 0,
      processingTime: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };

    this.rateLimitMetrics = {
      requestCount: 0,
      burstCount: 0,
      throttledRequests: 0,
      queuedRequests: 0,
      cooldownPeriods: 0,
      averageRequestTime: 0
    };
  }
}