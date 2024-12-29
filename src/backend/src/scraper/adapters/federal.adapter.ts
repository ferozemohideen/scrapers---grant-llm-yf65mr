/**
 * @fileoverview Specialized adapter for scraping federal research lab technology transfer websites
 * with enhanced security, authentication, and rate limiting features.
 * @version 1.0.0
 */

import { BaseAdapter } from './base.adapter';
import {
  ScraperEngine,
  ScraperJob,
  ScraperResult,
  RateLimitConfig,
  ValidationResults,
  RateLimitStatus
} from '../../interfaces/scraper.interface';
import {
  SCRAPER_ENGINES,
  SCRAPER_RATE_LIMITS,
  ERROR_TYPES
} from '../../constants/scraper.constants';
import { AppError, handleError } from '../../utils/error.util';
import axios, { AxiosInstance } from 'axios'; // v1.6.0

/**
 * Enhanced configuration interface for federal lab specific settings
 */
interface FederalLabConfig {
  apiKey: string;
  institutionId: string;
  securityProtocol: 'basic' | 'oauth' | 'api_key';
  dataSchema: Record<string, any>;
  validationRules: Record<string, any>;
}

/**
 * Specialized adapter for federal research lab data collection with enhanced security
 */
export class FederalAdapter extends BaseAdapter {
  private readonly httpClient: AxiosInstance;
  private readonly federalConfig: FederalLabConfig;
  private readonly securityHeaders: Record<string, string>;
  private retryAttempts: number = 0;
  private readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Initialize federal adapter with enhanced security configuration
   */
  constructor(engine: ScraperEngine, config: FederalLabConfig) {
    // Initialize with federal lab specific rate limits
    super(
      engine,
      SCRAPER_RATE_LIMITS.FEDERAL_LABS,
      {
        collectMetrics: true,
        enableAlerting: true,
        logLevel: 'debug'
      }
    );

    this.federalConfig = config;
    this.validateConfig();

    // Initialize secure HTTP client
    this.httpClient = axios.create({
      timeout: 30000,
      validateStatus: status => status < 500,
      headers: this.buildSecurityHeaders()
    });

    // Configure interceptors for rate limiting and error handling
    this.setupHttpInterceptors();
  }

  /**
   * Execute secure scraping operation for federal lab website
   */
  public async scrape(job: ScraperJob): Promise<ScraperResult> {
    try {
      // Validate job and security requirements
      this.validateJob(job);
      await this.validateSecurity(job);

      // Execute rate-limited scraping with enhanced security
      const result = await this.limiter.schedule(async () => {
        const data = await this.executeScrape(job);
        const validatedData = await this.validateData(data);
        return this.transformResult(job, validatedData);
      });

      // Handle pagination with rate limit awareness
      if (this.hasPagination(result)) {
        const allResults = await this.handlePagination(job, result);
        return this.combineResults(allResults);
      }

      return result;

    } catch (error) {
      return this.handleFederalError(error as Error, job);
    }
  }

  /**
   * Validate federal lab specific job configuration
   */
  protected validateJob(job: ScraperJob): void {
    super.validateJob(job);

    if (!job.config.headers?.['X-API-Key']) {
      throw new AppError(
        'Missing API key for federal lab access',
        ERROR_TYPES.AUTHENTICATION_ERROR,
        401,
        { jobId: job.id }
      );
    }

    if (!this.isValidFederalUrl(job.url)) {
      throw new AppError(
        'Invalid federal lab URL format',
        ERROR_TYPES.VALIDATION_ERROR,
        400,
        { url: job.url }
      );
    }
  }

  /**
   * Handle paginated results with rate limiting
   */
  private async handlePagination(
    job: ScraperJob,
    initialResult: ScraperResult
  ): Promise<ScraperResult[]> {
    const results: ScraperResult[] = [initialResult];
    const pagination = this.extractPaginationInfo(initialResult);

    for (let page = 2; page <= pagination.totalPages; page++) {
      // Check rate limit status before proceeding
      const rateLimitStatus = await this.checkRateLimitStatus();
      if (rateLimitStatus.isLimited) {
        await this.handleRateLimit(rateLimitStatus);
        continue;
      }

      const pageJob = this.createPageJob(job, page);
      const pageResult = await this.scrape(pageJob);
      results.push(pageResult);
    }

    return results;
  }

  /**
   * Setup secure HTTP interceptors for rate limiting and error handling
   */
  private setupHttpInterceptors(): void {
    this.httpClient.interceptors.request.use(
      config => {
        // Add timestamp and request ID for audit
        config.headers['X-Request-ID'] = this.generateRequestId();
        config.headers['X-Request-Timestamp'] = new Date().toISOString();
        return config;
      },
      error => Promise.reject(error)
    );

    this.httpClient.interceptors.response.use(
      response => {
        this.updateRateLimitMetrics(response);
        return response;
      },
      error => {
        if (this.isRateLimitError(error)) {
          return this.handleRateLimitError(error);
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Build security headers for federal lab requests
   */
  private buildSecurityHeaders(): Record<string, string> {
    return {
      'X-API-Key': this.federalConfig.apiKey,
      'X-Institution-ID': this.federalConfig.institutionId,
      'User-Agent': `TechTransfer-Scraper/1.0 (Federal Labs; Compliance)`,
      'Accept': 'application/json',
      'X-Security-Protocol': this.federalConfig.securityProtocol
    };
  }

  /**
   * Validate data against federal lab schema
   */
  private async validateData(data: any): Promise<ValidationResults> {
    const validation: ValidationResults = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Apply federal lab specific validation rules
    for (const [field, rule] of Object.entries(this.federalConfig.validationRules)) {
      if (!this.validateField(data[field], rule)) {
        validation.errors.push({
          field,
          rule: 'federal_compliance',
          message: `Field ${field} does not meet federal requirements`
        });
        validation.isValid = false;
      }
    }

    return validation;
  }

  /**
   * Handle federal lab specific errors
   */
  private async handleFederalError(
    error: Error,
    job: ScraperJob
  ): Promise<ScraperResult> {
    const { error: appError, retryable } = handleError(error, {
      jobId: job.id,
      institutionType: 'federal_lab',
      retryCount: this.retryAttempts
    });

    if (retryable && this.retryAttempts < this.MAX_RETRY_ATTEMPTS) {
      this.retryAttempts++;
      return this.scrape(job);
    }

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
          field: 'federal_scraping',
          rule: 'execution',
          message: appError.message
        }],
        warnings: []
      }
    };
  }

  /**
   * Generate unique request ID for audit trail
   */
  private generateRequestId(): string {
    return `fed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate federal lab URL format
   */
  private isValidFederalUrl(url: string): boolean {
    const federalDomains = ['.gov', '.mil'];
    return federalDomains.some(domain => url.includes(domain));
  }
}