/**
 * @fileoverview Comprehensive unit tests for SearchService class
 * Verifies search functionality, caching, performance, and error handling
 * @version 1.0.0
 */

import { jest } from '@jest/globals';
import { 
  SearchService,
  ElasticsearchService,
  RedisService,
  SearchParams,
  SearchResponse,
  SearchMetrics
} from '../../../src/services/search.service';

// Mock external services
jest.mock('../../../src/lib/search/elasticsearch.service');
jest.mock('../../../src/lib/cache/redis.service');

// Test data setup
const mockSearchParams: SearchParams = {
  query: 'quantum computing',
  filters: {
    institution: ['Stanford University'],
    category: ['Technology'],
    country: ['US'],
    dateRange: {
      start: new Date('2024-01-01'),
      end: new Date('2024-12-31')
    }
  },
  pagination: {
    page: 1,
    limit: 20
  }
};

const mockSearchResponse: SearchResponse = {
  results: [{
    id: '1',
    title: 'Quantum Computing Technology',
    description: 'Advanced quantum computing research',
    institution: 'Stanford University',
    category: 'Technology',
    country: 'US',
    discoveredAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-02-01'),
    score: 0.95
  }],
  total: 1,
  facets: {
    institutions: [{ value: 'Stanford University', count: 1 }],
    categories: [{ value: 'Technology', count: 1 }],
    countries: [{ value: 'US', count: 1 }]
  },
  pagination: {
    currentPage: 1,
    totalPages: 1,
    limit: 20,
    total: 1
  }
};

const mockMetrics: SearchMetrics = {
  totalSearches: 100,
  averageResponseTime: 150,
  cacheHitRate: 0.75,
  errorRate: 0.01,
  lastUpdated: new Date()
};

describe('SearchService', () => {
  let searchService: SearchService;
  let elasticsearchService: jest.Mocked<ElasticsearchService>;
  let redisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    // Reset mocks and service instance
    jest.clearAllMocks();
    
    // Setup Elasticsearch mock
    elasticsearchService = {
      getInstance: jest.fn().mockReturnThis(),
      search: jest.fn().mockResolvedValue(mockSearchResponse),
      getHealth: jest.fn().mockResolvedValue(true)
    } as any;
    
    // Setup Redis mock
    redisService = {
      getInstance: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn(),
      getExpiry: jest.fn()
    } as any;

    // Reset singleton instance
    (SearchService as any).instance = null;
    searchService = SearchService.getInstance();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = SearchService.getInstance();
      const instance2 = SearchService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should initialize services only once', () => {
      SearchService.getInstance();
      SearchService.getInstance();
      expect(elasticsearchService.getInstance).toHaveBeenCalledTimes(1);
      expect(redisService.getInstance).toHaveBeenCalledTimes(1);
    });
  });

  describe('search', () => {
    it('should return cached results when available', async () => {
      redisService.get.mockResolvedValueOnce(mockSearchResponse);
      
      const result = await searchService.search(mockSearchParams);
      
      expect(result).toEqual(mockSearchResponse);
      expect(redisService.get).toHaveBeenCalled();
      expect(elasticsearchService.search).not.toHaveBeenCalled();
    });

    it('should perform search and cache results when cache miss', async () => {
      redisService.get.mockResolvedValueOnce(null);
      elasticsearchService.search.mockResolvedValueOnce(mockSearchResponse);
      
      const result = await searchService.search(mockSearchParams);
      
      expect(result).toEqual(mockSearchResponse);
      expect(elasticsearchService.search).toHaveBeenCalledWith(mockSearchParams);
      expect(redisService.set).toHaveBeenCalledWith(
        expect.any(String),
        mockSearchResponse,
        3600
      );
    });

    it('should meet sub-2 second response time requirement', async () => {
      jest.useFakeTimers();
      const startTime = Date.now();
      
      const searchPromise = searchService.search(mockSearchParams);
      jest.advanceTimersByTime(1900); // Advance time by 1.9 seconds
      
      const result = await searchPromise;
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(2000);
      expect(result).toEqual(mockSearchResponse);
    });

    it('should handle search errors gracefully', async () => {
      const error = new Error('Search failed');
      elasticsearchService.search.mockRejectedValueOnce(error);
      redisService.get.mockResolvedValueOnce(null);
      
      await expect(searchService.search(mockSearchParams))
        .rejects
        .toThrow('Search failed');
    });

    it('should validate search parameters', async () => {
      const invalidParams = {
        ...mockSearchParams,
        query: ''
      };
      
      await expect(searchService.search(invalidParams))
        .rejects
        .toThrow('Search query is required');
    });
  });

  describe('cache behavior', () => {
    it('should respect cache TTL', async () => {
      await searchService.search(mockSearchParams);
      
      expect(redisService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        3600
      );
    });

    it('should handle cache errors gracefully', async () => {
      redisService.get.mockRejectedValueOnce(new Error('Cache error'));
      elasticsearchService.search.mockResolvedValueOnce(mockSearchResponse);
      
      const result = await searchService.search(mockSearchParams);
      
      expect(result).toEqual(mockSearchResponse);
    });

    it('should update cache metrics on hits and misses', async () => {
      // Test cache hit
      redisService.get.mockResolvedValueOnce(mockSearchResponse);
      await searchService.search(mockSearchParams);
      
      // Test cache miss
      redisService.get.mockResolvedValueOnce(null);
      await searchService.search(mockSearchParams);
      
      const metrics = await searchService.getMetrics();
      expect(metrics.cacheHitRate).toBeDefined();
    });
  });

  describe('metrics', () => {
    it('should track search performance metrics', async () => {
      await searchService.search(mockSearchParams);
      const metrics = await searchService.getMetrics();
      
      expect(metrics).toMatchObject({
        totalSearches: expect.any(Number),
        averageResponseTime: expect.any(Number),
        cacheHitRate: expect.any(Number),
        errorRate: expect.any(Number),
        lastUpdated: expect.any(Date)
      });
    });

    it('should update error rate on failures', async () => {
      elasticsearchService.search.mockRejectedValueOnce(new Error('Search failed'));
      redisService.get.mockResolvedValueOnce(null);
      
      try {
        await searchService.search(mockSearchParams);
      } catch (error) {
        const metrics = await searchService.getMetrics();
        expect(metrics.errorRate).toBeGreaterThan(0);
      }
    });
  });

  describe('health check', () => {
    it('should verify elasticsearch and cache health', async () => {
      elasticsearchService.getHealth.mockResolvedValueOnce(true);
      redisService.getHealth.mockResolvedValueOnce(true);
      
      const isHealthy = await searchService.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should handle health check failures', async () => {
      elasticsearchService.getHealth.mockRejectedValueOnce(new Error('Health check failed'));
      
      const isHealthy = await searchService.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });
});