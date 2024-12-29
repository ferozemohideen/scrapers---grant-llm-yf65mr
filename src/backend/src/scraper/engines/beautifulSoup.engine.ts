/**
 * @fileoverview BeautifulSoup scraping engine implementation using cheerio
 * Provides robust HTML parsing with comprehensive error handling, rate limiting,
 * and monitoring capabilities for scraping 375+ institutions.
 * @version 1.0.0
 */

import axios, { AxiosInstance } from 'axios'; // v1.4.0
import * as cheerio from 'cheerio'; // v1.0.0-rc.12
import rateLimit from 'axios-rate-limit'; // v1.3.0

import {
  ScraperEngine,
  ScraperJob,
  ScraperResult,
  ScraperError,
  RateLimitConfig,
  RateLimitStatus,
  PerformanceMetrics,
  ValidationResults
} from '../../interfaces/scraper.interface';

import {
  SCRAPER_ENGINES,
  ERROR_TYPES,
  SCRAPER_RATE_LIMITS,
  RETRY_CONFIG
} from '../../constants/scraper.constants';

import {
  AppError,
  createError,
  handleError,
  isRetryable,
  getRetryDelay
} from '../../utils/error.util';

/**
 * BeautifulSoup scraping engine implementation with enhanced capabilities
 */
export class BeautifulSoupEngine implements ScraperEngine {
  public readonly type = SCRAPER_ENGINES.BEAUTIFUL_SOUP;
  private httpClient: AxiosInstance;
  private rateLimitConfig: RateLimitConfig;
  private retryCounters: Map<string, number>;
  private cooldownTimers: Map<string, number>;

  constructor(rateLimitConfig: RateLimitConfig) {
    this.rateLimitConfig = rateLimitConfig;
    this.retryCounters = new Map();
    this.cooldownTimers = new Map();
    this.initializeHttpClient();
  }

  /**
   * Initializes axios HTTP client with rate limiting and interceptors
   */
  private initializeHttpClient(): void {
    this.httpClient = rateLimit(
      axios.create({
        timeout: 30000,
        headers: {
          'User-Agent': 'TechTransfer-Scraper/1.0',
          'Accept': 'text/html,application/xhtml+xml'
        }
      }),
      { maxRPS: this.rateLimitConfig.requestsPerSecond }
    );

    // Add request interceptor for monitoring
    this.httpClient.interceptors.request.use(
      (config) => {
        config.metadata = { startTime: new Date() };
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor for metrics
    this.httpClient.interceptors.response.use(
      (response) => {
        this.updatePerformanceMetrics(response.config);
        return response;
      },
      (error) => {
        if (error.config) {
          this.updatePerformanceMetrics(error.config);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Performs web scraping with comprehensive error handling
   */
  public async scrape(job: ScraperJob): Promise<ScraperResult> {
    const startTime = new Date();
    let performanceMetrics: PerformanceMetrics = this.initializePerformanceMetrics(startTime);

    try {
      // Check rate limits and cooldown
      const rateLimitStatus = await this.checkRateLimits(job);
      if (rateLimitStatus.isLimited) {
        throw createError(
          ERROR_TYPES.RATE_LIMITED,
          `Rate limit exceeded for ${job.institutionType}`,
          { rateLimitStatus }
        );
      }

      // Make HTTP request
      const response = await this.httpClient.get(job.url);
      const $ = cheerio.load(response.data);

      // Extract and validate data
      const extractedData = await this.extractData($, job.config.selectors);
      const validationResults = this.validateData(extractedData, job.validationRules);

      // Update performance metrics
      performanceMetrics = this.finalizePerformanceMetrics(performanceMetrics);

      return {
        jobId: job.id,
        url: job.url,
        data: extractedData,
        timestamp: new Date(),
        success: true,
        rateLimitMetrics: this.getRateLimitMetrics(),
        performanceMetrics,
        validationResults
      };

    } catch (error) {
      const handledError = await this.handleScrapingError(error, job);
      performanceMetrics = this.finalizePerformanceMetrics(performanceMetrics);

      if (handledError.retryable && job.retryCount < RETRY_CONFIG.MAX_RETRIES) {
        // Schedule retry with exponential backoff
        const delay = getRetryDelay(handledError.error, job.retryCount);
        await this.delay(delay);
        return this.scrape({ ...job, retryCount: job.retryCount + 1 });
      }

      throw handledError.error;
    }
  }

  /**
   * Extracts data using configured selectors
   */
  private async extractData(
    $: cheerio.CheerioAPI,
    selectors: Record<string, string>
  ): Promise<Record<string, any>> {
    const extracted: Record<string, any> = {};

    for (const [field, selector] of Object.entries(selectors)) {
      try {
        const elements = $(selector);
        if (elements.length === 0) {
          throw createError(
            ERROR_TYPES.PARSE_ERROR,
            `No elements found for selector: ${selector}`,
            { field, selector }
          );
        }

        extracted[field] = elements.length === 1
          ? this.cleanText(elements.first().text())
          : elements.map((_, el) => this.cleanText($(el).text())).get();

      } catch (error) {
        throw createError(
          ERROR_TYPES.PARSE_ERROR,
          `Failed to extract ${field}`,
          { field, selector, error: error.message }
        );
      }
    }

    return extracted;
  }

  /**
   * Handles scraping errors with sophisticated retry logic
   */
  private async handleScrapingError(
    error: any,
    job: ScraperJob
  ): Promise<{ error: AppError; retryable: boolean }> {
    const errorContext = {
      jobId: job.id,
      url: job.url,
      institutionType: job.institutionType,
      retryCount: job.retryCount
    };

    if (axios.isAxiosError(error)) {
      const errorType = this.classifyAxiosError(error);
      const enhancedError = createError(errorType, error.message, errorContext);
      return handleError(enhancedError, errorContext);
    }

    if (error instanceof AppError) {
      return handleError(error, errorContext);
    }

    const genericError = createError(
      ERROR_TYPES.INTERNAL_ERROR,
      'Unexpected scraping error',
      { ...errorContext, originalError: error.message }
    );
    return handleError(genericError, errorContext);
  }

  /**
   * Classifies Axios errors into appropriate error types
   */
  private classifyAxiosError(error: any): ERROR_TYPES {
    if (!error.response) {
      return ERROR_TYPES.NETWORK_ERROR;
    }

    switch (error.response.status) {
      case 429:
        return ERROR_TYPES.RATE_LIMIT_ERROR;
      case 401:
        return ERROR_TYPES.AUTHENTICATION_ERROR;
      case 403:
        return ERROR_TYPES.AUTHORIZATION_ERROR;
      case 404:
        return ERROR_TYPES.NOT_FOUND_ERROR;
      default:
        return ERROR_TYPES.SERVICE_ERROR;
    }
  }

  /**
   * Checks rate limits and cooldown periods
   */
  private async checkRateLimits(job: ScraperJob): Promise<RateLimitStatus> {
    const institutionLimits = this.rateLimitConfig.institutionOverrides[job.institutionType] 
      || SCRAPER_RATE_LIMITS.DEFAULT;

    const currentRequests = this.retryCounters.get(job.institutionType) || 0;
    const cooldownUntil = this.cooldownTimers.get(job.institutionType) || 0;

    const status: RateLimitStatus = {
      isLimited: false,
      remainingRequests: institutionLimits.requestsPerSecond - currentRequests,
      resetTime: new Date(cooldownUntil),
      currentBurst: currentRequests,
      inCooldown: Date.now() < cooldownUntil
    };

    if (status.inCooldown || currentRequests >= institutionLimits.burstLimit) {
      status.isLimited = true;
    } else {
      this.retryCounters.set(job.institutionType, currentRequests + 1);
      this.scheduleCooldownReset(job.institutionType, institutionLimits.cooldownPeriod);
    }

    return status;
  }

  /**
   * Schedules cooldown period reset
   */
  private scheduleCooldownReset(institutionType: string, cooldownPeriod: number): void {
    const resetTime = Date.now() + (cooldownPeriod * 1000);
    this.cooldownTimers.set(institutionType, resetTime);

    setTimeout(() => {
      this.retryCounters.set(institutionType, 0);
      this.cooldownTimers.delete(institutionType);
    }, cooldownPeriod * 1000);
  }

  /**
   * Utility methods
   */
  private cleanText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializePerformanceMetrics(startTime: Date): PerformanceMetrics {
    return {
      startTime,
      endTime: new Date(),
      totalDuration: 0,
      networkTime: 0,
      processingTime: 0,
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().user
    };
  }

  private finalizePerformanceMetrics(metrics: PerformanceMetrics): PerformanceMetrics {
    const endTime = new Date();
    return {
      ...metrics,
      endTime,
      totalDuration: endTime.getTime() - metrics.startTime.getTime(),
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().user
    };
  }

  private updatePerformanceMetrics(config: any): void {
    if (config.metadata) {
      const duration = Date.now() - config.metadata.startTime.getTime();
      config.metadata.duration = duration;
    }
  }

  private getRateLimitMetrics() {
    // Implementation for collecting rate limit metrics
    return {
      requestCount: 0,
      burstCount: 0,
      throttledRequests: 0,
      queuedRequests: 0,
      cooldownPeriods: 0,
      averageRequestTime: 0
    };
  }
}