/**
 * @fileoverview Service class for managing technology transfer opportunities
 * Implements business logic with optimized performance, caching, and comprehensive error handling
 * @version 1.0.0
 */

import { injectable, singleton } from 'tsyringe'; // ^4.7.0
import { Logger } from 'winston'; // ^3.8.0
import { CircuitBreaker } from 'opossum'; // ^6.0.0
import { validate } from 'class-validator'; // ^0.13.0
import { Technology } from '../db/models/technology.model';
import { TechnologyRepository } from '../db/repositories/technology.repository';
import { ElasticsearchService } from '../lib/search/elasticsearch.service';
import { CacheService } from 'redis'; // ^4.0.0
import { SearchParams, SearchResponse } from '../interfaces/search.interface';
import { ScraperResult } from '../interfaces/scraper.interface';

/**
 * Service class for managing technology transfer opportunities
 * Implements caching, validation, and performance optimization
 */
@injectable()
@singleton()
export class TechnologyService {
  private readonly searchCircuitBreaker: CircuitBreaker;
  private readonly CACHE_TTL = 3600; // 1 hour cache TTL
  private readonly SEARCH_TIMEOUT = 2000; // 2 second timeout

  /**
   * Initialize service with required dependencies and circuit breaker configuration
   */
  constructor(
    private readonly repository: TechnologyRepository,
    private readonly cacheService: CacheService,
    private readonly logger: Logger
  ) {
    // Initialize circuit breaker for search operations
    this.searchCircuitBreaker = new CircuitBreaker(
      async (params: SearchParams) => this.executeSearch(params),
      {
        timeout: this.SEARCH_TIMEOUT,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        name: 'technology-search'
      }
    );

    this.setupCircuitBreakerEvents();
  }

  /**
   * Creates a new technology entry from scraper results
   * Implements validation and error handling
   * @param scraperResult Validated scraper result data
   * @returns Newly created technology entity
   */
  public async createFromScraper(scraperResult: ScraperResult): Promise<Technology> {
    try {
      // Create technology entity from scraper result
      const technology = Technology.fromScraperResult(scraperResult);

      // Validate entity
      const errors = await validate(technology);
      if (errors.length > 0) {
        throw new Error(`Validation failed: ${JSON.stringify(errors)}`);
      }

      // Save to database
      const savedTechnology = await this.repository.create(technology);

      // Invalidate relevant caches
      await this.invalidateRelatedCaches(savedTechnology);

      this.logger.info('Technology created successfully', {
        id: savedTechnology.id,
        institution: savedTechnology.institution
      });

      return savedTechnology;
    } catch (error) {
      this.logger.error('Error creating technology:', error);
      throw error;
    }
  }

  /**
   * Performs optimized semantic search with caching and circuit breaker
   * Implements sub-2 second response time requirement
   * @param params Search parameters
   * @returns Search results with pagination
   */
  public async search(params: SearchParams): Promise<SearchResponse> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(params);
      const cachedResults = await this.cacheService.get(cacheKey);
      
      if (cachedResults) {
        this.logger.debug('Cache hit for search query', { params });
        return JSON.parse(cachedResults);
      }

      // Execute search with circuit breaker
      const results = await this.searchCircuitBreaker.fire(params);

      // Cache results
      await this.cacheService.setex(
        cacheKey,
        this.CACHE_TTL,
        JSON.stringify(results)
      );

      return results;
    } catch (error) {
      this.logger.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Executes search operation with performance optimization
   * @param params Search parameters
   * @returns Search results
   */
  private async executeSearch(params: SearchParams): Promise<SearchResponse> {
    const searchService = ElasticsearchService.getInstance();
    const optimizedParams = this.optimizeSearchParams(params);
    return searchService.search(optimizedParams);
  }

  /**
   * Optimizes search parameters for performance
   * @param params Original search parameters
   * @returns Optimized search parameters
   */
  private optimizeSearchParams(params: SearchParams): SearchParams {
    return {
      ...params,
      pagination: {
        ...params.pagination,
        limit: Math.min(params.pagination.limit, 100) // Enforce reasonable limit
      }
    };
  }

  /**
   * Generates cache key for search results
   * @param params Search parameters
   * @returns Cache key string
   */
  private generateCacheKey(params: SearchParams): string {
    return `search:${JSON.stringify(params)}`;
  }

  /**
   * Invalidates related caches when data changes
   * @param technology Modified technology entity
   */
  private async invalidateRelatedCaches(technology: Technology): Promise<void> {
    const patterns = [
      `search:*${technology.institution}*`,
      `search:*${technology.category}*`
    ];

    await Promise.all(
      patterns.map(pattern => this.cacheService.del(pattern))
    );
  }

  /**
   * Sets up circuit breaker event handlers
   */
  private setupCircuitBreakerEvents(): void {
    this.searchCircuitBreaker.on('timeout', () => {
      this.logger.warn('Search circuit breaker timeout');
    });

    this.searchCircuitBreaker.on('open', () => {
      this.logger.warn('Search circuit breaker opened');
    });

    this.searchCircuitBreaker.on('halfOpen', () => {
      this.logger.info('Search circuit breaker half-open');
    });

    this.searchCircuitBreaker.on('close', () => {
      this.logger.info('Search circuit breaker closed');
    });
  }
}