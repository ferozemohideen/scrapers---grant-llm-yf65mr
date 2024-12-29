/**
 * @fileoverview High-performance search service implementation for technology transfer data
 * Provides semantic search with sub-2 second response times, advanced caching,
 * comprehensive monitoring, and resilient error handling
 * @version 1.0.0
 */

import { Logger } from 'winston'; // v3.8.0
import { compress } from 'compression'; // v1.7.4
import CircuitBreaker from 'opossum'; // v6.0.0
import { 
  SearchParams, 
  SearchResponse, 
  SearchMetrics 
} from '../interfaces/search.interface';
import { ElasticsearchService } from '../lib/search/elasticsearch.service';
import { RedisService } from '../lib/cache/redis.service';

/**
 * High-performance search service implementing singleton pattern
 * with advanced caching, monitoring and error handling
 */
export class SearchService {
  private static instance: SearchService;
  private elasticsearchService: ElasticsearchService;
  private cacheService: RedisService;
  private logger: Logger;
  private circuitBreaker: CircuitBreaker;
  private metrics: SearchMetrics;

  /**
   * Private constructor implementing singleton pattern with enhanced monitoring
   */
  private constructor() {
    // Initialize Elasticsearch service
    this.elasticsearchService = ElasticsearchService.getInstance();

    // Initialize Redis cache service
    this.cacheService = RedisService.getInstance({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      ttl: 3600,
      keyPrefix: 'search:'
    });

    // Configure advanced logging
    this.logger = new Logger({
      level: 'info',
      format: Logger.format.combine(
        Logger.format.timestamp(),
        Logger.format.json()
      ),
      transports: [
        new Logger.transports.Console(),
        new Logger.transports.File({ filename: 'search-service.log' })
      ]
    });

    // Initialize circuit breaker for resilience
    this.circuitBreaker = new CircuitBreaker(
      async (params: SearchParams) => this.executeSearch(params),
      {
        timeout: 2000, // 2 second timeout per spec
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        name: 'search-service'
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
  }

  /**
   * Returns singleton instance with health check
   */
  public static getInstance(): SearchService {
    if (!SearchService.instance) {
      SearchService.instance = new SearchService();
    }
    return SearchService.instance;
  }

  /**
   * Performs optimized semantic search with caching and monitoring
   * @param params Search parameters
   * @returns Search results with facets and metrics
   */
  public async search(params: SearchParams): Promise<SearchResponse> {
    const startTime = Date.now();
    this.metrics.totalSearches++;

    try {
      // Validate and normalize parameters
      this.validateSearchParams(params);
      const normalizedParams = this.normalizeSearchParams(params);
      
      // Generate cache key
      const cacheKey = this.generateCacheKey(normalizedParams);

      // Check cache first
      const cachedResult = await this.cacheService.get<SearchResponse>(cacheKey);
      if (cachedResult) {
        this.updateMetrics(startTime, true);
        this.logger.info('Cache hit for search query', { params });
        return this.compressResponse(cachedResult);
      }

      // Execute search via circuit breaker if cache miss
      const searchResult = await this.circuitBreaker.fire(normalizedParams);
      
      // Cache the result
      await this.cacheService.set(
        cacheKey,
        searchResult,
        3600 // 1 hour TTL
      );

      this.updateMetrics(startTime, false);
      return this.compressResponse(searchResult);

    } catch (error) {
      this.handleSearchError(error, params);
      throw error;
    }
  }

  /**
   * Returns current search performance metrics
   */
  public async getMetrics(): Promise<SearchMetrics> {
    return {
      ...this.metrics,
      lastUpdated: new Date()
    };
  }

  /**
   * Performs health check on search service dependencies
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const [elasticsearchHealth, cacheHealth] = await Promise.all([
        this.elasticsearchService.healthCheck(),
        this.cacheService.healthCheck()
      ]);

      return elasticsearchHealth && cacheHealth;
    } catch (error) {
      this.logger.error('Health check failed', { error });
      return false;
    }
  }

  /**
   * Executes actual search operation via Elasticsearch
   */
  private async executeSearch(params: SearchParams): Promise<SearchResponse> {
    return this.elasticsearchService.search(params);
  }

  /**
   * Validates search parameters
   */
  private validateSearchParams(params: SearchParams): void {
    if (!params.query?.trim()) {
      throw new Error('Search query is required');
    }

    if (params.pagination?.limit > 100) {
      throw new Error('Maximum page size is 100');
    }
  }

  /**
   * Normalizes search parameters for consistent caching
   */
  private normalizeSearchParams(params: SearchParams): SearchParams {
    return {
      query: params.query.trim().toLowerCase(),
      filters: {
        ...params.filters,
        institution: params.filters?.institution?.sort() || [],
        category: params.filters?.category?.sort() || [],
        country: params.filters?.country?.sort() || []
      },
      pagination: {
        page: params.pagination?.page || 1,
        limit: Math.min(params.pagination?.limit || 20, 100)
      }
    };
  }

  /**
   * Generates cache key from search parameters
   */
  private generateCacheKey(params: SearchParams): string {
    return `search:${JSON.stringify(params)}`;
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
  }

  /**
   * Handles search errors with logging and metrics
   */
  private handleSearchError(error: Error, params: SearchParams): void {
    this.metrics.errorRate = (
      (this.metrics.errorRate * (this.metrics.totalSearches - 1)) + 1
    ) / this.metrics.totalSearches;

    this.logger.error('Search error', {
      error,
      params,
      stack: error.stack
    });
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
   * Compresses search response for large result sets
   */
  private compressResponse(response: SearchResponse): SearchResponse {
    // Response compression handled by middleware
    return response;
  }
}