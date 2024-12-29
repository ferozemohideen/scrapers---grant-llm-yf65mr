/**
 * @fileoverview Search Worker implementation for handling asynchronous search operations
 * Provides high-performance search capabilities with sub-2 second response times,
 * comprehensive error handling, and monitoring.
 * @version 1.0.0
 */

import { ConsumeMessage } from 'amqplib'; // ^0.10.0
import { SearchParams, SearchResponse } from '../interfaces/search.interface';
import { RabbitMQService } from '../lib/queue/rabbitmq.service';
import { ElasticsearchService } from '../lib/search/elasticsearch.service';
import { logger } from '../utils/logger.util';
import { ERROR_TYPES, RETRY_STRATEGIES } from '../constants/error.constants';

// Queue configuration constants
const SEARCH_QUEUE = 'search_jobs';
const MAX_RETRIES = 3;
const CACHE_TTL = 300000; // 5 minutes
const CIRCUIT_BREAKER_THRESHOLD = 0.5;
const PERFORMANCE_THRESHOLD_MS = 2000;

/**
 * Interface for tracking search operation metrics
 */
interface SearchMetrics {
  totalRequests: number;
  successfulSearches: number;
  failedSearches: number;
  averageLatency: number;
  cacheHitRate: number;
  lastError?: Error;
}

/**
 * Circuit breaker for managing service health
 */
interface CircuitBreaker {
  failures: number;
  total: number;
  lastCheck: Date;
  isOpen: boolean;
}

/**
 * Worker class for processing search requests with enhanced error handling
 * and performance monitoring capabilities
 */
export class SearchWorker {
  private queueService: RabbitMQService;
  private searchService: ElasticsearchService;
  private searchCache: Map<string, SearchResponse>;
  private metrics: SearchMetrics;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    // Initialize services
    this.queueService = new RabbitMQService({
      connection: {
        protocol: 'amqp',
        hostname: process.env.RABBITMQ_HOST || 'localhost',
        port: parseInt(process.env.RABBITMQ_PORT || '5672'),
        username: process.env.RABBITMQ_USER || 'guest',
        password: process.env.RABBITMQ_PASS || 'guest',
        vhost: '/',
        heartbeat: 60
      },
      queues: {
        search: {
          name: SEARCH_QUEUE,
          options: {
            durable: true,
            deadLetterExchange: 'search_dlx'
          },
          deadLetter: 'search_dlq',
          retryDelay: 15000,
          maxRetries: MAX_RETRIES,
          priority: 7
        }
      },
      workers: {
        search: {
          concurrency: 3,
          prefetch: 1,
          maxMemory: 256,
          idleTimeout: 180000
        }
      }
    });

    this.searchService = ElasticsearchService.getInstance();
    this.searchCache = new Map();
    
    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulSearches: 0,
      failedSearches: 0,
      averageLatency: 0,
      cacheHitRate: 0
    };

    // Initialize circuit breaker
    this.circuitBreaker = {
      failures: 0,
      total: 0,
      lastCheck: new Date(),
      isOpen: false
    };
  }

  /**
   * Starts the search worker with connection and error handling
   */
  public async start(): Promise<void> {
    try {
      logger.info('Starting search worker...');
      
      // Connect to RabbitMQ
      await this.queueService.connect();
      
      // Set up consumer with retry mechanism
      await this.queueService.consume(
        SEARCH_QUEUE,
        this.handleMessage.bind(this),
        {
          noAck: false,
          exclusive: false,
          retryOnError: true
        }
      );

      // Start metrics collection
      this.startMetricsCollection();
      
      logger.info('Search worker started successfully');
    } catch (error) {
      logger.error('Failed to start search worker', error);
      throw error;
    }
  }

  /**
   * Handles incoming search request messages
   */
  private async handleMessage(msg: ConsumeMessage): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Parse message content
      const searchParams: SearchParams = JSON.parse(msg.content.toString());
      logger.info('Processing search request', { searchParams });

      // Check circuit breaker
      if (this.circuitBreaker.isOpen) {
        throw new Error(ERROR_TYPES.SERVICE_ERROR);
      }

      // Process search request
      const result = await this.processSearch(searchParams);
      
      // Update metrics
      this.updateMetrics(startTime);
      
      // Acknowledge message
      this.queueService.channel?.ack(msg);
      
      logger.info('Search request processed successfully', {
        processingTime: Date.now() - startTime
      });
    } catch (error) {
      this.handleSearchError(error, msg);
    }
  }

  /**
   * Processes search request with caching and performance monitoring
   */
  private async processSearch(params: SearchParams): Promise<SearchResponse> {
    const cacheKey = this.generateCacheKey(params);
    
    // Check cache
    const cachedResult = this.searchCache.get(cacheKey);
    if (cachedResult) {
      this.metrics.cacheHitRate++;
      return cachedResult;
    }

    // Execute search
    const result = await this.searchService.search(params);
    
    // Validate performance
    const searchTime = Date.now();
    if (searchTime > PERFORMANCE_THRESHOLD_MS) {
      logger.warn('Search operation exceeded performance threshold', {
        searchTime,
        threshold: PERFORMANCE_THRESHOLD_MS
      });
    }

    // Cache result
    this.searchCache.set(cacheKey, result);
    setTimeout(() => this.searchCache.delete(cacheKey), CACHE_TTL);

    return result;
  }

  /**
   * Handles search operation errors with retry logic
   */
  private handleSearchError(error: Error, msg: ConsumeMessage): void {
    logger.error('Search operation failed', error);
    
    // Update circuit breaker
    this.updateCircuitBreaker(error);
    
    // Update error metrics
    this.metrics.failedSearches++;
    this.metrics.lastError = error;

    // Get retry count from message headers
    const retryCount = (msg.properties.headers?.retryCount || 0) + 1;
    
    if (retryCount <= MAX_RETRIES) {
      // Retry with exponential backoff
      const delay = RETRY_STRATEGIES[ERROR_TYPES.SERVICE_ERROR].baseDelay * Math.pow(2, retryCount - 1);
      
      setTimeout(() => {
        this.queueService.channel?.nack(msg, false, true);
      }, delay);
    } else {
      // Send to dead letter queue
      this.queueService.channel?.nack(msg, false, false);
    }
  }

  /**
   * Updates circuit breaker status
   */
  private updateCircuitBreaker(error: Error): void {
    this.circuitBreaker.total++;
    if (error) {
      this.circuitBreaker.failures++;
    }

    // Check failure rate every 100 requests
    if (this.circuitBreaker.total >= 100) {
      const failureRate = this.circuitBreaker.failures / this.circuitBreaker.total;
      this.circuitBreaker.isOpen = failureRate > CIRCUIT_BREAKER_THRESHOLD;
      
      // Reset counters
      this.circuitBreaker.failures = 0;
      this.circuitBreaker.total = 0;
      this.circuitBreaker.lastCheck = new Date();
    }
  }

  /**
   * Updates performance metrics
   */
  private updateMetrics(startTime: number): void {
    const latency = Date.now() - startTime;
    this.metrics.totalRequests++;
    this.metrics.successfulSearches++;
    this.metrics.averageLatency = 
      (this.metrics.averageLatency * (this.metrics.totalRequests - 1) + latency) / 
      this.metrics.totalRequests;
  }

  /**
   * Starts periodic metrics collection
   */
  private startMetricsCollection(): void {
    setInterval(() => {
      logger.info('Search worker metrics', {
        metrics: this.metrics,
        circuitBreaker: {
          isOpen: this.circuitBreaker.isOpen,
          failureRate: this.circuitBreaker.failures / this.circuitBreaker.total
        }
      });
    }, 60000); // Log metrics every minute
  }

  /**
   * Generates cache key from search parameters
   */
  private generateCacheKey(params: SearchParams): string {
    return `search:${JSON.stringify(params)}`;
  }
}