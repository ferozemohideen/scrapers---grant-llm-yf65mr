/**
 * @fileoverview Advanced Scrapy engine implementation with sophisticated rate limiting,
 * error handling, and monitoring capabilities for processing 375+ institutional data sources.
 * @version 1.0.0
 */

import { Observable, Subject, from, timer } from 'rxjs'; // v7.0.0
import { retryWhen, delayWhen, tap, catchError } from 'rxjs/operators';
import * as scrapy from 'scrapy'; // v2.5.0

import { 
  ScraperEngine, 
  ScraperJob, 
  ScraperResult, 
  ScraperError,
  RateLimitConfig,
  RateLimitMetrics,
  RateLimitStatus,
  PerformanceMetrics
} from '../../interfaces/scraper.interface';

import {
  SCRAPER_ENGINES,
  ERROR_TYPES,
  SCRAPER_RATE_LIMITS,
  RETRY_CONFIG
} from '../../constants/scraper.constants';

import { logger } from '../../utils/logger.util';

/**
 * Interface for tracking rate limit metrics per institution
 */
interface RateLimitTracker {
  requestCount: number;
  lastRequestTime: Date;
  burstCount: number;
  cooldownStart?: Date;
}

/**
 * Advanced Scrapy engine implementation with sophisticated rate limiting and error handling
 */
export class ScrapyEngine implements ScraperEngine {
  private readonly type = SCRAPER_ENGINES.SCRAPY;
  private readonly rateLimitTracker: Map<string, RateLimitTracker>;
  private readonly errorSubject: Subject<ScraperError>;
  private readonly performanceMetrics: Map<string, PerformanceMetrics>;

  constructor(
    private readonly rateLimitConfig: RateLimitConfig,
    private readonly scrapyInstance: typeof scrapy
  ) {
    this.rateLimitTracker = new Map();
    this.errorSubject = new Subject();
    this.performanceMetrics = new Map();

    // Set up error monitoring
    this.setupErrorMonitoring();
  }

  /**
   * Initializes the scraping engine with configuration
   */
  public async initialize(): Promise<void> {
    logger.info('Initializing ScrapyEngine', {
      engineType: this.type,
      rateLimitConfig: this.rateLimitConfig
    });

    try {
      // Configure Scrapy middleware and settings
      await this.scrapyInstance.settings.update({
        CONCURRENT_REQUESTS: this.rateLimitConfig.burstLimit,
        DOWNLOAD_DELAY: 1 / this.rateLimitConfig.requestsPerSecond,
        ROBOTSTXT_OBEY: true,
        USER_AGENT: 'TechTransfer-Bot/1.0 (+http://example.com/bot)',
        COOKIES_ENABLED: true,
        RETRY_ENABLED: true,
        RETRY_TIMES: RETRY_CONFIG.MAX_RETRIES,
        RETRY_HTTP_CODES: [500, 502, 503, 504, 408, 429]
      });

      logger.info('ScrapyEngine initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize ScrapyEngine', error as Error);
      throw error;
    }
  }

  /**
   * Executes a scraping job with comprehensive error handling and rate limiting
   */
  public async scrape(job: ScraperJob): Promise<ScraperResult> {
    const startTime = new Date();
    logger.info('Starting scrape job', { jobId: job.id, url: job.url });

    try {
      // Check rate limits before proceeding
      await this.checkRateLimits(job.institutionType);

      // Create observable for scraping operation
      const scrapeObservable = this.createScrapeObservable(job);

      // Execute scraping with retry logic
      const data = await this.executeScrapeWithRetry(scrapeObservable, job);

      // Process and validate results
      const result = await this.processResults(data, job);

      // Update metrics
      this.updatePerformanceMetrics(job.id, startTime);

      return result;
    } catch (error) {
      const scrapingError = this.handleError(error as Error, job);
      throw scrapingError;
    }
  }

  /**
   * Checks rate limits for the given institution type
   */
  private async checkRateLimits(institutionType: string): Promise<void> {
    const tracker = this.getRateLimitTracker(institutionType);
    const limits = this.getInstitutionRateLimits(institutionType);

    if (this.isInCooldown(tracker)) {
      const cooldownRemaining = this.getCooldownRemaining(tracker);
      logger.warn('Rate limit cooldown in effect', { 
        institutionType, 
        cooldownRemaining 
      });
      await this.enforceDelay(cooldownRemaining);
    }

    if (this.exceedsBurstLimit(tracker, limits)) {
      logger.warn('Burst limit reached, entering cooldown', { 
        institutionType, 
        burstCount: tracker.burstCount 
      });
      this.initiateCooldown(tracker);
      await this.enforceDelay(limits.cooldownPeriod * 1000);
    }

    this.updateRateLimitTracker(tracker);
  }

  /**
   * Creates an observable for the scraping operation
   */
  private createScrapeObservable(job: ScraperJob): Observable<any> {
    return from(this.scrapyInstance.request({
      url: job.url,
      callback: this.parseResponse.bind(this),
      errback: this.handleRequestError.bind(this),
      meta: { jobId: job.id }
    })).pipe(
      retryWhen(errors => 
        errors.pipe(
          tap(error => this.logRetryAttempt(error, job)),
          delayWhen(() => timer(this.calculateRetryDelay(job.retryCount))),
          catchError(error => this.handleFatalError(error, job))
        )
      )
    );
  }

  /**
   * Processes and validates scraping results
   */
  private async processResults(data: any, job: ScraperJob): Promise<ScraperResult> {
    logger.info('Processing scrape results', { jobId: job.id });

    const validationResults = await this.validateData(data, job.validationRules);
    const rateLimitMetrics = this.getRateLimitMetrics(job.institutionType);
    const performanceMetrics = this.performanceMetrics.get(job.id) || {
      startTime: new Date(),
      endTime: new Date(),
      totalDuration: 0,
      networkTime: 0,
      processingTime: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };

    return {
      jobId: job.id,
      url: job.url,
      data,
      timestamp: new Date(),
      success: validationResults.isValid,
      rateLimitMetrics,
      performanceMetrics,
      validationResults
    };
  }

  /**
   * Sets up error monitoring and alerting
   */
  private setupErrorMonitoring(): void {
    this.errorSubject.subscribe(error => {
      logger.error('Scraping error occurred', error as Error, {
        jobId: error.jobId,
        url: error.url,
        type: error.type
      });

      if (this.shouldTriggerAlert(error)) {
        this.triggerErrorAlert(error);
      }
    });
  }

  /**
   * Handles and classifies errors
   */
  private handleError(error: Error, job: ScraperJob): ScraperError {
    const errorType = this.classifyError(error);
    const scrapingError: ScraperError = {
      type: errorType,
      message: error.message,
      jobId: job.id,
      url: job.url,
      timestamp: new Date(),
      stack: error.stack || '',
      retryAttempt: job.retryCount,
      rateLimitStatus: this.getRateLimitStatus(job.institutionType),
      recoverySuggestions: this.generateRecoverySuggestions(errorType)
    };

    this.errorSubject.next(scrapingError);
    return scrapingError;
  }

  /**
   * Cleans up resources
   */
  public async cleanup(): Promise<void> {
    logger.info('Cleaning up ScrapyEngine resources');
    this.rateLimitTracker.clear();
    this.performanceMetrics.clear();
    this.errorSubject.complete();
  }
}