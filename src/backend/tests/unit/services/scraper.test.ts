import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { ScraperService } from '../../../src/services/scraper.service';
import { 
  ScraperJob, 
  ScraperResult, 
  ScraperError, 
  RateLimitConfig,
  PerformanceMetrics 
} from '../../../src/interfaces/scraper.interface';
import { ScraperEngineFactory } from '../../../src/scraper/engines';
import { RabbitMQService } from '../../../src/lib/queue/rabbitmq.service';
import { 
  ERROR_TYPES, 
  SCRAPER_RATE_LIMITS 
} from '../../../src/constants/scraper.constants';

// Mock external dependencies
jest.mock('../../../src/scraper/engines');
jest.mock('../../../src/lib/queue/rabbitmq.service');

describe('ScraperService', () => {
  let scraperService: ScraperService;
  let mockEngineFactory: jest.Mocked<ScraperEngineFactory>;
  let mockQueueService: jest.Mocked<RabbitMQService>;

  beforeEach(() => {
    // Initialize mocks
    mockEngineFactory = {
      getEngine: jest.fn(),
      cleanup: jest.fn()
    } as any;

    mockQueueService = {
      publishToQueue: jest.fn(),
      consume: jest.fn(),
      removeJob: jest.fn()
    } as any;

    // Create service instance
    scraperService = new ScraperService(mockEngineFactory, mockQueueService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('scheduleJob', () => {
    test('should successfully schedule a job with rate limiting', async () => {
      // Arrange
      const job: ScraperJob = {
        id: 'test-job-1',
        url: 'https://techfinder.stanford.edu/',
        institutionType: 'US_UNIVERSITIES',
        config: {
          selectors: {
            title: '.tech-title',
            description: '.tech-description'
          },
          timeout: 30000,
          userAgent: 'TechTransfer-Bot/1.0',
          followRedirects: true,
          maxRedirects: 5,
          validateSSL: true
        },
        rateLimitConfig: SCRAPER_RATE_LIMITS.US_UNIVERSITIES,
        retryConfig: {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 30000,
          backoffFactor: 2,
          retryableErrors: [ERROR_TYPES.NETWORK_TIMEOUT, ERROR_TYPES.RATE_LIMITED]
        },
        status: 'pending',
        retryCount: 0,
        validationRules: {
          required: ['title', 'description'],
          patterns: {},
          customValidators: {},
          dataTypes: {
            title: 'string',
            description: 'string'
          }
        }
      };

      mockQueueService.publishToQueue.mockResolvedValue(true);

      // Act
      await scraperService.scheduleJob(job);

      // Assert
      expect(mockQueueService.publishToQueue).toHaveBeenCalledWith(
        'scraper_jobs',
        job,
        expect.any(Object)
      );
    });

    test('should handle rate limit exceeded scenarios', async () => {
      // Arrange
      const jobs = Array.from({ length: 6 }, (_, i) => ({
        id: `test-job-${i}`,
        url: 'https://techfinder.stanford.edu/',
        institutionType: 'US_UNIVERSITIES',
        status: 'pending',
        retryCount: 0
      }));

      // Act & Assert
      for (const job of jobs) {
        await scraperService.scheduleJob(job as ScraperJob);
      }

      expect(mockQueueService.publishToQueue).toHaveBeenCalledTimes(5); // Burst limit
    });
  });

  describe('processJob', () => {
    test('should successfully process a job and handle results', async () => {
      // Arrange
      const job: ScraperJob = {
        id: 'test-job-1',
        url: 'https://techfinder.stanford.edu/',
        institutionType: 'US_UNIVERSITIES',
        status: 'pending',
        retryCount: 0
      } as ScraperJob;

      const mockEngine = {
        scrape: jest.fn().mockResolvedValue({
          title: 'Test Technology',
          description: 'Test Description'
        })
      };

      mockEngineFactory.getEngine.mockResolvedValue(mockEngine);

      // Act
      const result = await scraperService.processJob(job.id);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEngine.scrape).toHaveBeenCalledWith(job);
    });

    test('should handle scraping errors with retry mechanism', async () => {
      // Arrange
      const job: ScraperJob = {
        id: 'test-job-1',
        url: 'https://techfinder.stanford.edu/',
        institutionType: 'US_UNIVERSITIES',
        status: 'pending',
        retryCount: 0
      } as ScraperJob;

      const mockError = new Error('Network timeout');
      const mockEngine = {
        scrape: jest.fn().mockRejectedValue(mockError)
      };

      mockEngineFactory.getEngine.mockResolvedValue(mockEngine);

      // Act & Assert
      await expect(scraperService.processJob(job.id)).rejects.toThrow('Network timeout');
      expect(job.retryCount).toBe(1);
    });
  });

  describe('rateLimiting', () => {
    test('should enforce institution-specific rate limits', async () => {
      // Arrange
      const usUniversityJob: ScraperJob = {
        id: 'us-job',
        institutionType: 'US_UNIVERSITIES',
        url: 'https://techfinder.stanford.edu/',
        status: 'pending',
        retryCount: 0
      } as ScraperJob;

      const intlUniversityJob: ScraperJob = {
        id: 'intl-job',
        institutionType: 'INTERNATIONAL_UNIVERSITIES',
        url: 'https://innovation.ox.ac.uk/',
        status: 'pending',
        retryCount: 0
      } as ScraperJob;

      // Act
      const startTime = Date.now();
      await scraperService.scheduleJob(usUniversityJob);
      await scraperService.scheduleJob(intlUniversityJob);
      const endTime = Date.now();

      // Assert
      const timeDiff = endTime - startTime;
      expect(timeDiff).toBeGreaterThanOrEqual(1000); // Minimum delay between requests
    });

    test('should handle burst limits correctly', async () => {
      // Arrange
      const jobs = Array.from({ length: 10 }, (_, i) => ({
        id: `burst-job-${i}`,
        institutionType: 'US_UNIVERSITIES',
        url: 'https://techfinder.stanford.edu/',
        status: 'pending',
        retryCount: 0
      } as ScraperJob));

      // Act
      const results = await Promise.allSettled(
        jobs.map(job => scraperService.scheduleJob(job))
      );

      // Assert
      const successfulJobs = results.filter(r => r.status === 'fulfilled').length;
      expect(successfulJobs).toBeLessThanOrEqual(SCRAPER_RATE_LIMITS.US_UNIVERSITIES.burstLimit);
    });
  });

  describe('errorHandling', () => {
    test('should handle network timeouts appropriately', async () => {
      // Arrange
      const job: ScraperJob = {
        id: 'timeout-job',
        url: 'https://techfinder.stanford.edu/',
        institutionType: 'US_UNIVERSITIES',
        status: 'pending',
        retryCount: 0
      } as ScraperJob;

      const mockEngine = {
        scrape: jest.fn().mockRejectedValue(new Error('Network timeout'))
      };

      mockEngineFactory.getEngine.mockResolvedValue(mockEngine);

      // Act & Assert
      await expect(scraperService.processJob(job.id)).rejects.toThrow('Network timeout');
      expect(job.retryCount).toBe(1);
    });

    test('should handle rate limit errors with exponential backoff', async () => {
      // Arrange
      const job: ScraperJob = {
        id: 'ratelimit-job',
        url: 'https://techfinder.stanford.edu/',
        institutionType: 'US_UNIVERSITIES',
        status: 'pending',
        retryCount: 0
      } as ScraperJob;

      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.name = ERROR_TYPES.RATE_LIMITED;

      mockEngineFactory.getEngine.mockResolvedValue({
        scrape: jest.fn().mockRejectedValue(rateLimitError)
      });

      // Act
      const startTime = Date.now();
      await expect(scraperService.processJob(job.id)).rejects.toThrow('Rate limit exceeded');
      const endTime = Date.now();

      // Assert
      const delay = endTime - startTime;
      expect(delay).toBeGreaterThanOrEqual(1000); // Minimum backoff delay
    });
  });

  describe('performanceMetrics', () => {
    test('should track and report performance metrics', async () => {
      // Arrange
      const job: ScraperJob = {
        id: 'metrics-job',
        url: 'https://techfinder.stanford.edu/',
        institutionType: 'US_UNIVERSITIES',
        status: 'pending',
        retryCount: 0
      } as ScraperJob;

      const mockEngine = {
        scrape: jest.fn().mockImplementation(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return { title: 'Test', description: 'Test' };
        })
      };

      mockEngineFactory.getEngine.mockResolvedValue(mockEngine);

      // Act
      const result = await scraperService.processJob(job.id);

      // Assert
      expect(result.performanceMetrics).toBeDefined();
      expect(result.performanceMetrics.totalDuration).toBeGreaterThanOrEqual(100);
      expect(result.performanceMetrics.memoryUsage).toBeGreaterThan(0);
    });
  });
});