/**
 * @fileoverview Worker implementation for processing distributed web scraping jobs
 * with advanced rate limiting, retry mechanisms, monitoring, and comprehensive error handling.
 * @version 1.0.0
 */

import { injectable } from 'inversify'; // v6.0.1
import * as winston from 'winston'; // v3.8.0
import circuitBreaker from 'opossum'; // v6.0.0

import { ScraperService } from '../services/scraper.service';
import { RabbitMQService } from '../lib/queue/rabbitmq.service';
import { ErrorUtils } from '../utils/error.util';
import { queueConfig } from '../config/queue.config';
import { logger } from '../utils/logger.util';

import {
  ScraperJob,
  ScraperError,
  RateLimitStatus,
  PerformanceMetrics
} from '../interfaces/scraper.interface';

import {
  ERROR_TYPES,
  RETRY_CONFIG,
  SCRAPER_RATE_LIMITS
} from '../constants/scraper.constants';

/**
 * Worker implementation for processing distributed web scraping jobs
 * with comprehensive error handling and monitoring capabilities.
 */
@injectable()
export class ScraperWorker {
  private readonly logger: winston.Logger;
  private readonly retryCountMap: Map<string, number>;
  private readonly rateLimitMap: Map<string, RateLimitStatus>;
  private readonly performanceMetrics: Map<string, PerformanceMetrics>;
  private readonly breaker: any;
  private isShuttingDown: boolean = false;

  constructor(
    private readonly scraperService: ScraperService,
    private readonly queueService: RabbitMQService
  ) {
    this.initializeLogger();
    this.retryCountMap = new Map();
    this.rateLimitMap = new Map();
    this.performanceMetrics = new Map();
    this.initializeCircuitBreaker();
  }

  /**
   * Initializes structured logging with appropriate configuration
   */
  private initializeLogger(): void {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'scraper-worker-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'scraper-worker-combined.log' })
      ]
    });
  }

  /**
   * Initializes circuit breaker for fault tolerance
   */
  private initializeCircuitBreaker(): void {
    this.breaker = new circuitBreaker(this.processJob.bind(this), {
      timeout: 30000, // 30 seconds
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000
    });

    this.breaker.fallback(async (job: ScraperJob) => {
      await this.handleJobError(
        new Error('Circuit breaker open - service degraded'),
        job
      );
    });

    this.breaker.on('open', () => {
      this.logger.warn('Circuit breaker opened due to high error rate');
    });
  }

  /**
   * Starts the worker with comprehensive initialization
   */
  public async start(): Promise<void> {
    try {
      this.logger.info('Starting scraper worker');

      // Connect to message queue
      await this.queueService.connect();

      // Set up consumer with configured prefetch
      await this.queueService.consume(
        queueConfig.queues.scraper.name,
        this.processMessage.bind(this),
        {
          noAck: false,
          retryOnError: true
        }
      );

      // Register shutdown handlers
      this.registerShutdownHandlers();

      this.logger.info('Scraper worker started successfully');
    } catch (error) {
      this.logger.error('Failed to start scraper worker', error as Error);
      throw error;
    }
  }

  /**
   * Processes incoming job messages with comprehensive error handling
   */
  private async processMessage(message: any): Promise<void> {
    const startTime = new Date();
    let job: ScraperJob;

    try {
      // Parse and validate job message
      job = JSON.parse(message.content.toString());
      this.validateJob(job);

      // Check rate limits
      const rateLimitStatus = await this.checkRateLimits(job.institutionType);
      if (rateLimitStatus.isLimited) {
        await this.handleRateLimit(job, rateLimitStatus);
        return;
      }

      // Process job through circuit breaker
      await this.breaker.fire(job);

      // Acknowledge successful processing
      await this.queueService.channel.ack(message);

      // Update metrics
      this.updatePerformanceMetrics(job.id, startTime);
    } catch (error) {
      this.logger.error('Error processing message', error as Error);
      
      if (job) {
        await this.handleJobError(error as Error, job);
      }

      // Reject message for requeue if retryable
      if (ErrorUtils.isRetryableError(error as Error)) {
        await this.queueService.channel.nack(message, false, true);
      } else {
        // Move to dead letter queue if not retryable
        await this.queueService.channel.nack(message, false, false);
      }
    }
  }

  /**
   * Processes a scraping job with error handling and retries
   */
  private async processJob(job: ScraperJob): Promise<void> {
    this.logger.info('Processing scraping job', {
      jobId: job.id,
      url: job.url,
      institutionType: job.institutionType
    });

    try {
      // Execute scraping operation
      await this.scraperService.processJob(job);

      // Update success metrics
      this.updateJobMetrics(job.id, true);
    } catch (error) {
      this.logger.error('Job processing failed', error as Error);
      await this.handleJobError(error as Error, job);
    }
  }

  /**
   * Handles job errors with sophisticated retry logic
   */
  private async handleJobError(error: Error, job: ScraperJob): Promise<void> {
    const retryCount = this.retryCountMap.get(job.id) || 0;
    const errorType = ErrorUtils.isRetryableError(error) ? 
      ERROR_TYPES.RETRYABLE_ERROR : 
      ERROR_TYPES.PERMANENT_ERROR;

    const scraperError: ScraperError = {
      type: errorType,
      message: error.message,
      jobId: job.id,
      url: job.url,
      timestamp: new Date(),
      stack: error.stack || '',
      retryAttempt: retryCount,
      rateLimitStatus: this.rateLimitMap.get(job.institutionType),
      recoverySuggestions: this.getRecoverySuggestions(errorType)
    };

    if (retryCount < RETRY_CONFIG.MAX_RETRIES && ErrorUtils.isRetryableError(error)) {
      // Calculate backoff delay
      const delay = ErrorUtils.calculateBackoff(retryCount);
      this.retryCountMap.set(job.id, retryCount + 1);

      // Schedule retry
      setTimeout(async () => {
        await this.queueService.publishToQueue(
          queueConfig.queues.scraper.name,
          { ...job, retryCount: retryCount + 1 }
        );
      }, delay);

      this.logger.warn('Scheduling job retry', {
        jobId: job.id,
        retryCount: retryCount + 1,
        delay
      });
    } else {
      // Move to dead letter queue
      await this.queueService.publishToQueue(
        queueConfig.queues.scraper.deadLetter,
        { job, error: scraperError }
      );

      this.logger.error('Moving job to DLQ', {
        jobId: job.id,
        error: scraperError
      });
    }

    // Update error metrics
    this.updateJobMetrics(job.id, false);
  }

  /**
   * Checks rate limits for institution type
   */
  private async checkRateLimits(institutionType: string): Promise<RateLimitStatus> {
    const limits = SCRAPER_RATE_LIMITS[institutionType] || SCRAPER_RATE_LIMITS.DEFAULT;
    const status = this.rateLimitMap.get(institutionType) || {
      isLimited: false,
      remainingRequests: limits.requestsPerSecond,
      resetTime: new Date(),
      currentBurst: 0,
      inCooldown: false
    };

    return status;
  }

  /**
   * Handles rate limit exceeded scenarios
   */
  private async handleRateLimit(
    job: ScraperJob,
    status: RateLimitStatus
  ): Promise<void> {
    const delay = status.resetTime.getTime() - Date.now();
    
    this.logger.warn('Rate limit exceeded', {
      jobId: job.id,
      institutionType: job.institutionType,
      delay
    });

    // Requeue job with delay
    setTimeout(async () => {
      await this.queueService.publishToQueue(
        queueConfig.queues.scraper.name,
        job
      );
    }, delay);
  }

  /**
   * Updates performance metrics for monitoring
   */
  private updatePerformanceMetrics(
    jobId: string,
    startTime: Date
  ): void {
    const endTime = new Date();
    const metrics: PerformanceMetrics = {
      startTime,
      endTime,
      totalDuration: endTime.getTime() - startTime.getTime(),
      networkTime: 0, // Updated by service
      processingTime: endTime.getTime() - startTime.getTime(),
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().user
    };

    this.performanceMetrics.set(jobId, metrics);
  }

  /**
   * Updates job success/failure metrics
   */
  private updateJobMetrics(jobId: string, success: boolean): void {
    // Implementation would integrate with monitoring system
  }

  /**
   * Validates job configuration
   */
  private validateJob(job: ScraperJob): void {
    if (!job.id || !job.url || !job.institutionType) {
      throw new Error('Invalid job configuration');
    }
  }

  /**
   * Gets recovery suggestions based on error type
   */
  private getRecoverySuggestions(errorType: ERROR_TYPES): string[] {
    // Implementation would provide specific recovery suggestions
    return ['Retry operation', 'Check rate limits', 'Verify URL accessibility'];
  }

  /**
   * Registers process shutdown handlers
   */
  private registerShutdownHandlers(): void {
    process.on('SIGTERM', async () => {
      await this.stop();
    });

    process.on('SIGINT', async () => {
      await this.stop();
    });
  }

  /**
   * Stops the worker gracefully
   */
  public async stop(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    this.logger.info('Stopping scraper worker');

    try {
      // Stop accepting new jobs
      await this.queueService.close();

      // Clean up resources
      this.retryCountMap.clear();
      this.rateLimitMap.clear();
      this.performanceMetrics.clear();

      this.logger.info('Scraper worker stopped successfully');
    } catch (error) {
      this.logger.error('Error stopping scraper worker', error as Error);
      throw error;
    }
  }
}