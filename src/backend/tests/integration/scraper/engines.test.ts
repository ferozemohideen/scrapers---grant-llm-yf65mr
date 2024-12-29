/**
 * @fileoverview Integration tests for scraping engine implementations
 * Verifies functionality, rate limiting, error handling, and data extraction
 * capabilities across BeautifulSoup, Scrapy, and Selenium engines.
 * @version 1.0.0
 */

import { BeautifulSoupEngine } from '../../../src/scraper/engines/beautifulSoup.engine';
import { ScrapyEngine } from '../../../src/scraper/engines/scrapy.engine';
import { SeleniumEngine } from '../../../src/scraper/engines/selenium.engine';
import { 
  SCRAPER_ENGINES, 
  ERROR_TYPES, 
  SCRAPER_RATE_LIMITS, 
  RETRY_STRATEGIES 
} from '../../../src/constants/scraper.constants';
import nock from 'nock'; // v13.0.0
import testServer from 'supertest'; // v6.0.0

// Mock HTML content for testing
const mockHtml = `
  <div class="tech-title">Test Technology</div>
  <div class="tech-description">Test Description</div>
  <div class="tech-details">
    <span class="category">AI</span>
    <span class="status">Available</span>
  </div>
`;

// Mock dynamic content for Selenium tests
const mockDynamicHtml = `
  <div id="loading">Loading...</div>
  <script>
    setTimeout(() => {
      document.getElementById('content').innerHTML = 
        '<div class="tech-title">Dynamic Content</div>';
    }, 1000);
  </script>
  <div id="content"></div>
`;

describe('Scraping Engine Integration Tests', () => {
  let beautifulSoupEngine: BeautifulSoupEngine;
  let scrapyEngine: ScrapyEngine;
  let seleniumEngine: SeleniumEngine;
  let mockServer: any;

  beforeAll(async () => {
    // Initialize test server
    mockServer = testServer.agent('http://localhost:3000');

    // Configure engines with test settings
    beautifulSoupEngine = new BeautifulSoupEngine({
      requestsPerSecond: 2,
      burstLimit: 5,
      cooldownPeriod: 60,
      institutionOverrides: {},
      burstHandling: { strategy: 'queue' }
    });

    scrapyEngine = new ScrapyEngine({
      requestsPerSecond: 5,
      burstLimit: 10,
      cooldownPeriod: 30,
      institutionOverrides: {},
      burstHandling: { strategy: 'queue' }
    });

    seleniumEngine = new SeleniumEngine({
      requestsPerSecond: 1,
      burstLimit: 3,
      cooldownPeriod: 120,
      institutionOverrides: {},
      burstHandling: { strategy: 'queue' }
    });

    // Initialize engines
    await Promise.all([
      beautifulSoupEngine.initialize(),
      scrapyEngine.initialize(),
      seleniumEngine.initialize()
    ]);
  });

  afterAll(async () => {
    // Cleanup resources
    await Promise.all([
      beautifulSoupEngine.cleanup(),
      scrapyEngine.cleanup(),
      seleniumEngine.cleanup()
    ]);
    nock.cleanAll();
    await mockServer.close();
  });

  beforeEach(() => {
    // Reset rate limiters and mocks
    nock.cleanAll();
    jest.clearAllMocks();
  });

  describe('BeautifulSoup Engine Tests', () => {
    test('should successfully scrape static HTML content', async () => {
      // Mock endpoint
      nock('http://test.university.edu')
        .get('/technologies')
        .reply(200, mockHtml);

      const job = {
        id: 'test-job-1',
        url: 'http://test.university.edu/technologies',
        institutionType: 'US_UNIVERSITIES',
        config: {
          selectors: {
            title: '.tech-title',
            description: '.tech-description'
          },
          timeout: 30000,
          userAgent: 'TestBot/1.0'
        },
        retryCount: 0,
        validationRules: {
          required: ['title', 'description'],
          patterns: {},
          customValidators: {},
          dataTypes: {}
        }
      };

      const result = await beautifulSoupEngine.scrape(job);

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Test Technology');
      expect(result.data.description).toBe('Test Description');
      expect(result.performanceMetrics.totalDuration).toBeLessThan(1000);
    });

    test('should handle rate limiting correctly', async () => {
      const requests = Array(10).fill(null).map((_, i) => ({
        id: `rate-limit-${i}`,
        url: 'http://test.university.edu/technologies',
        institutionType: 'US_UNIVERSITIES',
        config: {
          selectors: { title: '.tech-title' },
          timeout: 30000
        },
        retryCount: 0,
        validationRules: { required: ['title'], patterns: {} }
      }));

      nock('http://test.university.edu')
        .persist()
        .get('/technologies')
        .reply(200, mockHtml);

      const results = await Promise.all(
        requests.map(job => beautifulSoupEngine.scrape(job).catch(e => e))
      );

      const successfulRequests = results.filter(r => r.success).length;
      const rateLimitedRequests = results.filter(
        r => r instanceof Error && r.type === ERROR_TYPES.RATE_LIMITED
      ).length;

      expect(successfulRequests).toBeLessThanOrEqual(SCRAPER_RATE_LIMITS.US_UNIVERSITIES.burstLimit);
      expect(rateLimitedRequests).toBeGreaterThan(0);
    });
  });

  describe('Scrapy Engine Tests', () => {
    test('should handle concurrent scraping efficiently', async () => {
      const urls = Array(5).fill(null).map((_, i) => 
        `http://test.university.edu/tech/${i}`
      );

      urls.forEach(url => {
        nock(url).get('/').reply(200, mockHtml);
      });

      const jobs = urls.map((url, i) => ({
        id: `concurrent-${i}`,
        url,
        institutionType: 'FEDERAL_LABS',
        config: {
          selectors: { title: '.tech-title' },
          timeout: 30000
        },
        retryCount: 0,
        validationRules: { required: ['title'], patterns: {} }
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        jobs.map(job => scrapyEngine.scrape(job))
      );

      const totalTime = Date.now() - startTime;
      const allSuccessful = results.every(r => r.success);

      expect(allSuccessful).toBe(true);
      expect(totalTime).toBeLessThan(urls.length * 1000); // Should be faster than sequential
      results.forEach(result => {
        expect(result.data.title).toBe('Test Technology');
      });
    });

    test('should handle errors with proper recovery', async () => {
      nock('http://test.university.edu')
        .get('/error-test')
        .times(3)
        .reply(500)
        .get('/error-test')
        .reply(200, mockHtml);

      const job = {
        id: 'error-test',
        url: 'http://test.university.edu/error-test',
        institutionType: 'US_UNIVERSITIES',
        config: {
          selectors: { title: '.tech-title' },
          timeout: 30000
        },
        retryCount: 0,
        validationRules: { required: ['title'], patterns: {} }
      };

      const result = await scrapyEngine.scrape(job);

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Test Technology');
    });
  });

  describe('Selenium Engine Tests', () => {
    test('should handle dynamic JavaScript content', async () => {
      // Set up mock server with dynamic content
      mockServer.get('/dynamic', (_, res) => res.send(mockDynamicHtml));

      const job = {
        id: 'dynamic-test',
        url: 'http://localhost:3000/dynamic',
        institutionType: 'INTERNATIONAL_UNIVERSITIES',
        config: {
          selectors: { title: '.tech-title' },
          timeout: 30000
        },
        retryCount: 0,
        validationRules: { required: ['title'], patterns: {} }
      };

      const result = await seleniumEngine.scrape(job);

      expect(result.success).toBe(true);
      expect(result.data.title).toBe('Dynamic Content');
    });

    test('should manage browser resources efficiently', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Execute multiple scraping jobs
      const jobs = Array(5).fill(null).map((_, i) => ({
        id: `resource-${i}`,
        url: 'http://localhost:3000/dynamic',
        institutionType: 'INTERNATIONAL_UNIVERSITIES',
        config: {
          selectors: { title: '.tech-title' },
          timeout: 30000
        },
        retryCount: 0,
        validationRules: { required: ['title'], patterns: {} }
      }));

      await Promise.all(jobs.map(job => seleniumEngine.scrape(job)));
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB limit
    });
  });
});