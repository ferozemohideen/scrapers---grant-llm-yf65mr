/**
 * @fileoverview Integration tests for scraper adapters verifying proper functionality
 * of university and federal lab scraping implementations.
 * @version 1.0.0
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import nock from 'nock'; // v13.0.0
import { UniversityAdapter } from '../../../src/scraper/adapters/university.adapter';
import { FederalAdapter } from '../../../src/scraper/adapters/federal.adapter';
import {
  SCRAPER_ENGINES,
  ERROR_TYPES,
  SCRAPER_RATE_LIMITS
} from '../../../src/constants/scraper.constants';
import {
  ScraperEngine,
  ScraperJob,
  ScraperResult
} from '../../../src/interfaces/scraper.interface';

// Mock the scraper engine
jest.mock('../../../src/scraper/engines/index.ts');

// Extend test timeout for rate limit tests
jest.setTimeout(30000);

describe('Scraper Adapters Integration Tests', () => {
  let mockEngine: ScraperEngine;
  let universityAdapter: UniversityAdapter;
  let federalAdapter: FederalAdapter;

  beforeAll(async () => {
    // Disable real HTTP requests
    nock.disableNetConnect();

    // Initialize mock engine
    mockEngine = {
      type: SCRAPER_ENGINES.BEAUTIFUL_SOUP,
      initialize: jest.fn().mockResolvedValue(undefined),
      scrape: jest.fn(),
      cleanup: jest.fn().mockResolvedValue(undefined),
      handleRateLimit: jest.fn().mockResolvedValue(undefined)
    };
  });

  afterAll(async () => {
    nock.enableNetConnect();
    nock.cleanAll();
  });

  beforeEach(() => {
    // Reset all mocks and nock interceptors
    jest.clearAllMocks();
    nock.cleanAll();

    // Initialize fresh adapter instances
    universityAdapter = new UniversityAdapter(
      mockEngine,
      SCRAPER_RATE_LIMITS.US_UNIVERSITIES,
      {
        type: 'US',
        selectors: {
          title: '.tech-title',
          description: '.tech-description'
        },
        dataValidation: {
          required: ['title', 'description'],
          patterns: {},
          customValidators: {},
          dataTypes: {}
        }
      }
    );

    federalAdapter = new FederalAdapter(
      mockEngine,
      {
        apiKey: 'test-api-key',
        institutionId: 'test-institution',
        securityProtocol: 'api_key',
        dataSchema: {},
        validationRules: {}
      }
    );
  });

  describe('UniversityAdapter', () => {
    test('should respect rate limits for US universities', async () => {
      const mockUrl = 'https://test.edu/technologies';
      const mockData = { title: 'Test Tech', description: 'Test Description' };
      
      // Mock successful scraping response
      mockEngine.scrape.mockResolvedValue({ html: '<div>Test</div>' });

      // Create multiple concurrent scraping jobs
      const jobs: ScraperJob[] = Array(5).fill(null).map((_, i) => ({
        id: `job-${i}`,
        url: `${mockUrl}/${i}`,
        institutionType: 'US_UNIVERSITY',
        config: {
          selectors: { title: '.tech-title', description: '.tech-description' },
          timeout: 5000,
          userAgent: 'test-agent',
          followRedirects: true,
          maxRedirects: 3,
          validateSSL: true
        },
        rateLimitConfig: SCRAPER_RATE_LIMITS.US_UNIVERSITIES,
        retryConfig: { maxRetries: 3, initialDelay: 1000, maxDelay: 5000, backoffFactor: 2, retryableErrors: [] },
        status: 'pending',
        retryCount: 0,
        validationRules: { required: ['title', 'description'], patterns: {}, customValidators: {}, dataTypes: {} }
      }));

      // Execute jobs and measure timing
      const startTime = Date.now();
      const results = await Promise.all(jobs.map(job => universityAdapter.scrape(job)));
      const duration = Date.now() - startTime;

      // Verify rate limiting (2 req/sec for US universities)
      expect(duration).toBeGreaterThanOrEqual(2000); // Should take at least 2 seconds for 5 requests
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    test('should handle international university content correctly', async () => {
      const mockUrl = 'https://test.ac.uk/technologies';
      const mockHtml = `
        <div class="tech-title">International Technology</div>
        <div class="tech-description">国际技术描述</div>
      `;

      mockEngine.scrape.mockResolvedValue({ html: mockHtml });

      const job: ScraperJob = {
        id: 'intl-job',
        url: mockUrl,
        institutionType: 'INTERNATIONAL_UNIVERSITY',
        config: {
          selectors: { title: '.tech-title', description: '.tech-description' },
          timeout: 5000,
          userAgent: 'test-agent',
          followRedirects: true,
          maxRedirects: 3,
          validateSSL: true,
          headers: { 'Accept-Language': 'en,zh' }
        },
        rateLimitConfig: SCRAPER_RATE_LIMITS.INTERNATIONAL_UNIVERSITIES,
        retryConfig: { maxRetries: 3, initialDelay: 1000, maxDelay: 5000, backoffFactor: 2, retryableErrors: [] },
        status: 'pending',
        retryCount: 0,
        validationRules: { required: ['title', 'description'], patterns: {}, customValidators: {}, dataTypes: {} }
      };

      const result = await universityAdapter.scrape(job);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('title', 'International Technology');
      expect(result.data).toHaveProperty('description');
      expect(result.validationResults.isValid).toBe(true);
    });
  });

  describe('FederalAdapter', () => {
    test('should handle API authentication and rate limits', async () => {
      const mockUrl = 'https://test.gov/api/technologies';
      
      // Mock API responses with authentication checks
      nock('https://test.gov')
        .get('/api/technologies')
        .matchHeader('X-API-Key', 'test-api-key')
        .reply(200, {
          data: { title: 'Federal Tech', description: 'Federal Description' },
          pagination: { currentPage: 1, totalPages: 2 }
        });

      const job: ScraperJob = {
        id: 'fed-job',
        url: mockUrl,
        institutionType: 'FEDERAL_LAB',
        config: {
          timeout: 5000,
          userAgent: 'test-agent',
          followRedirects: true,
          maxRedirects: 3,
          validateSSL: true,
          headers: { 'X-API-Key': 'test-api-key' }
        },
        rateLimitConfig: SCRAPER_RATE_LIMITS.FEDERAL_LABS,
        retryConfig: { maxRetries: 3, initialDelay: 1000, maxDelay: 5000, backoffFactor: 2, retryableErrors: [] },
        status: 'pending',
        retryCount: 0,
        validationRules: { required: ['title', 'description'], patterns: {}, customValidators: {}, dataTypes: {} }
      };

      const result = await federalAdapter.scrape(job);

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('title', 'Federal Tech');
      expect(nock.isDone()).toBe(true);
    });

    test('should handle pagination with rate limiting', async () => {
      const mockUrl = 'https://test.gov/api/technologies';
      const totalPages = 3;

      // Mock paginated API responses
      for (let page = 1; page <= totalPages; page++) {
        nock('https://test.gov')
          .get(`/api/technologies`)
          .query({ page })
          .reply(200, {
            data: { title: `Federal Tech ${page}`, description: `Description ${page}` },
            pagination: { currentPage: page, totalPages }
          });
      }

      const job: ScraperJob = {
        id: 'fed-pagination-job',
        url: mockUrl,
        institutionType: 'FEDERAL_LAB',
        config: {
          timeout: 5000,
          userAgent: 'test-agent',
          followRedirects: true,
          maxRedirects: 3,
          validateSSL: true,
          headers: { 'X-API-Key': 'test-api-key' }
        },
        rateLimitConfig: SCRAPER_RATE_LIMITS.FEDERAL_LABS,
        retryConfig: { maxRetries: 3, initialDelay: 1000, maxDelay: 5000, backoffFactor: 2, retryableErrors: [] },
        status: 'pending',
        retryCount: 0,
        validationRules: { required: ['title', 'description'], patterns: {}, customValidators: {}, dataTypes: {} }
      };

      const startTime = Date.now();
      const result = await federalAdapter.scrape(job);
      const duration = Date.now() - startTime;

      // Verify rate limiting and pagination handling
      expect(duration).toBeGreaterThanOrEqual(400); // Should respect rate limits
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(totalPages);
      expect(nock.isDone()).toBe(true);
    });

    test('should handle rate limit errors with exponential backoff', async () => {
      const mockUrl = 'https://test.gov/api/technologies';

      // Mock rate limit response followed by success
      nock('https://test.gov')
        .get('/api/technologies')
        .reply(429, { error: 'Rate limit exceeded' })
        .get('/api/technologies')
        .reply(200, { data: { title: 'Federal Tech', description: 'Description' } });

      const job: ScraperJob = {
        id: 'fed-ratelimit-job',
        url: mockUrl,
        institutionType: 'FEDERAL_LAB',
        config: {
          timeout: 5000,
          userAgent: 'test-agent',
          followRedirects: true,
          maxRedirects: 3,
          validateSSL: true,
          headers: { 'X-API-Key': 'test-api-key' }
        },
        rateLimitConfig: SCRAPER_RATE_LIMITS.FEDERAL_LABS,
        retryConfig: { maxRetries: 3, initialDelay: 1000, maxDelay: 5000, backoffFactor: 2, retryableErrors: [ERROR_TYPES.RATE_LIMITED] },
        status: 'pending',
        retryCount: 0,
        validationRules: { required: ['title', 'description'], patterns: {}, customValidators: {}, dataTypes: {} }
      };

      const startTime = Date.now();
      const result = await federalAdapter.scrape(job);
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(1000); // Should include backoff delay
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('title', 'Federal Tech');
      expect(nock.isDone()).toBe(true);
    });
  });
});