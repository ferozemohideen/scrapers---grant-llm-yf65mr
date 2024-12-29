/**
 * Search Service
 * Handles technology transfer search operations with advanced caching,
 * performance optimization, and monitoring capabilities.
 * 
 * @version 1.0.0
 */

import { ApiService } from './api.service';
import { API_ENDPOINTS } from '../constants/api.constants';
import { 
  SearchParams,
  SearchResponse,
  SearchFilters,
  SearchResult
} from '../interfaces/search.interface';
import CircuitBreaker from 'opossum'; // ^6.0.0
import { debounce } from 'lodash'; // ^4.17.21

/**
 * Configuration interface for SearchService
 */
interface SearchServiceConfig {
  cacheDuration: number;
  requestThrottleLimit: number;
  circuitBreakerOptions: {
    timeout: number;
    errorThresholdPercentage: number;
    resetTimeout: number;
  };
}

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

/**
 * Enterprise-grade search service with caching, circuit breaking, and performance optimization
 */
export class SearchService {
  private readonly apiService: ApiService;
  private readonly searchBreaker: CircuitBreaker;
  private readonly searchCache: Map<string, CacheEntry<any>>;
  private readonly cacheExpirationMs: number;
  private readonly requestThrottleLimit: number;

  /**
   * Initialize search service with configuration
   */
  constructor(
    apiService: ApiService,
    config: SearchServiceConfig = {
      cacheDuration: 5 * 60 * 1000, // 5 minutes
      requestThrottleLimit: 1000, // 1000 requests per second
      circuitBreakerOptions: {
        timeout: 30000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000
      }
    }
  ) {
    this.apiService = apiService;
    this.searchCache = new Map();
    this.cacheExpirationMs = config.cacheDuration;
    this.requestThrottleLimit = config.requestThrottleLimit;

    // Initialize circuit breaker for search operations
    this.searchBreaker = new CircuitBreaker(
      async (params: SearchParams) => {
        const response = await this.apiService.post<SearchResponse>(
          API_ENDPOINTS.SEARCH.QUERY,
          params
        );
        return response.data;
      },
      config.circuitBreakerOptions
    );

    // Circuit breaker event handlers
    this.searchBreaker.on('open', () => {
      console.warn('Search circuit breaker opened - too many failures');
    });

    this.searchBreaker.on('halfOpen', () => {
      console.info('Search circuit breaker attempting reset');
    });

    this.searchBreaker.on('close', () => {
      console.info('Search circuit breaker closed - service recovered');
    });
  }

  /**
   * Perform semantic search with caching and performance optimization
   */
  public async search(params: SearchParams): Promise<SearchResponse> {
    const cacheKey = this.generateCacheKey(params);
    const cachedResult = this.getCachedResult<SearchResponse>(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    try {
      const startTime = performance.now();
      const response = await this.searchBreaker.fire(params);
      const duration = performance.now() - startTime;

      // Cache successful results
      this.cacheResult(cacheKey, response);

      // Monitor performance
      if (duration > 2000) { // 2 second threshold
        console.warn('Search performance warning:', {
          duration,
          params,
          timestamp: new Date().toISOString()
        });
      }

      return response;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  /**
   * Get search suggestions with debouncing
   */
  public getSuggestions = debounce(
    async (query: string): Promise<string[]> => {
      const cacheKey = `suggestions:${query}`;
      const cachedSuggestions = this.getCachedResult<string[]>(cacheKey);

      if (cachedSuggestions) {
        return cachedSuggestions;
      }

      try {
        const response = await this.apiService.get<string[]>(
          API_ENDPOINTS.SEARCH.SUGGESTIONS,
          { query }
        );
        
        this.cacheResult(cacheKey, response.data);
        return response.data;
      } catch (error) {
        console.error('Suggestions error:', error);
        return [];
      }
    },
    300 // 300ms debounce delay
  );

  /**
   * Get available search filters with caching
   */
  public async getFilters(): Promise<SearchFilters> {
    const cacheKey = 'filters';
    const cachedFilters = this.getCachedResult<SearchFilters>(cacheKey);

    if (cachedFilters) {
      return cachedFilters;
    }

    try {
      const response = await this.apiService.get<SearchFilters>(
        API_ENDPOINTS.SEARCH.FILTERS
      );
      
      this.cacheResult(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('Filters error:', error);
      throw error;
    }
  }

  /**
   * Generate cache key from search parameters
   */
  private generateCacheKey(params: SearchParams): string {
    return `search:${JSON.stringify(params)}`;
  }

  /**
   * Get cached result if valid
   */
  private getCachedResult<T>(key: string): T | null {
    const cached = this.searchCache.get(key);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpirationMs) {
      return cached.data as T;
    }

    if (cached) {
      this.searchCache.delete(key);
    }

    return null;
  }

  /**
   * Cache result with timestamp
   */
  private cacheResult<T>(key: string, data: T): void {
    this.searchCache.set(key, {
      data,
      timestamp: Date.now()
    });

    // Cleanup old cache entries
    if (this.searchCache.size > 1000) { // Maximum cache size
      const oldestKey = Array.from(this.searchCache.entries())
        .reduce((oldest, current) => {
          return current[1].timestamp < oldest[1].timestamp ? current : oldest;
        })[0];
      this.searchCache.delete(oldestKey);
    }
  }

  /**
   * Clear search cache
   */
  public clearCache(): void {
    this.searchCache.clear();
  }
}

// Export singleton instance
export default new SearchService(new ApiService());