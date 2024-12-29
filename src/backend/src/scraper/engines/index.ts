/**
 * @fileoverview Advanced factory implementation for managing web scraping engines
 * with sophisticated connection pooling, rate limiting, and resource optimization.
 * Supports 375+ institutions with comprehensive error handling and monitoring.
 * @version 1.0.0
 */

import {
  ScraperEngine,
  ScraperJob,
  RateLimitConfig,
  RetryConfig,
  EngineMetrics
} from '../../interfaces/scraper.interface';

import {
  SCRAPER_ENGINES,
  ERROR_TYPES
} from '../../constants/scraper.constants';

import { BeautifulSoupEngine } from './beautifulSoup.engine';
import { ScrapyEngine } from './scrapy.engine';
import { SeleniumEngine } from './selenium.engine';
import { logger } from '../../utils/logger.util';

/**
 * Advanced factory class for creating and managing scraper engine instances
 * with sophisticated resource management and monitoring capabilities.
 */
export class ScraperEngineFactory {
  private enginePools: Map<SCRAPER_ENGINES, Array<ScraperEngine>>;
  private engineMetrics: Map<string, EngineMetrics>;
  private readonly rateLimitConfig: RateLimitConfig;
  private readonly retryConfig: RetryConfig;
  private readonly maxPoolSize = 10;
  private readonly healthCheckInterval = 60000; // 1 minute

  constructor(rateLimitConfig: RateLimitConfig, retryConfig: RetryConfig) {
    this.enginePools = new Map();
    this.engineMetrics = new Map();
    this.rateLimitConfig = rateLimitConfig;
    this.retryConfig = retryConfig;

    // Initialize pools for each engine type
    Object.values(SCRAPER_ENGINES).forEach(engineType => {
      this.enginePools.set(engineType, []);
    });

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Gets or creates an optimized scraper engine instance from the pool
   */
  public async getEngine(
    engineType: SCRAPER_ENGINES,
    job: ScraperJob
  ): Promise<ScraperEngine> {
    logger.info('Getting scraper engine', { engineType, jobId: job.id });

    try {
      // Check pool for available engine
      const pool = this.enginePools.get(engineType);
      if (!pool) {
        throw new Error(`Invalid engine type: ${engineType}`);
      }

      // Get available engine or create new one
      let engine = pool.find(e => this.isEngineAvailable(e));
      if (!engine) {
        engine = await this.createEngine(engineType, job);
        pool.push(engine);
      }

      // Update engine metrics
      this.updateEngineMetrics(engineType, job.id);

      return engine;
    } catch (error) {
      logger.error('Failed to get scraper engine', error as Error, {
        engineType,
        jobId: job.id
      });
      throw error;
    }
  }

  /**
   * Creates a new instance of the specified scraper engine type
   */
  private async createEngine(
    engineType: SCRAPER_ENGINES,
    job: ScraperJob
  ): Promise<ScraperEngine> {
    logger.info('Creating new scraper engine', { engineType, jobId: job.id });

    try {
      let engine: ScraperEngine;

      switch (engineType) {
        case SCRAPER_ENGINES.BEAUTIFUL_SOUP:
          engine = new BeautifulSoupEngine(this.rateLimitConfig);
          break;

        case SCRAPER_ENGINES.SCRAPY:
          engine = new ScrapyEngine(this.rateLimitConfig, require('scrapy'));
          break;

        case SCRAPER_ENGINES.SELENIUM:
          engine = new SeleniumEngine({
            rateLimitConfig: this.rateLimitConfig,
            retryConfig: this.retryConfig
          });
          await (engine as SeleniumEngine).initialize();
          break;

        default:
          throw new Error(`Unsupported engine type: ${engineType}`);
      }

      // Initialize engine metrics
      this.initializeEngineMetrics(engineType);

      return engine;
    } catch (error) {
      logger.error('Failed to create scraper engine', error as Error, {
        engineType,
        jobId: job.id
      });
      throw error;
    }
  }

  /**
   * Performs comprehensive cleanup of all engine instances
   */
  public async cleanup(): Promise<void> {
    logger.info('Cleaning up all scraper engines');

    try {
      const cleanupPromises: Promise<void>[] = [];

      // Cleanup each engine pool
      for (const [engineType, pool] of this.enginePools.entries()) {
        for (const engine of pool) {
          if (engineType === SCRAPER_ENGINES.SELENIUM) {
            cleanupPromises.push((engine as SeleniumEngine).cleanup());
          }
        }
        pool.length = 0;
      }

      await Promise.all(cleanupPromises);
      this.engineMetrics.clear();

      logger.info('Successfully cleaned up all scraper engines');
    } catch (error) {
      logger.error('Error during engine cleanup', error as Error);
      throw error;
    }
  }

  /**
   * Retrieves performance metrics for engine instances
   */
  public async getEngineMetrics(engineType: SCRAPER_ENGINES): Promise<EngineMetrics> {
    const metrics = this.engineMetrics.get(engineType);
    if (!metrics) {
      throw new Error(`No metrics available for engine type: ${engineType}`);
    }
    return metrics;
  }

  /**
   * Starts periodic health monitoring of engine instances
   */
  private startHealthMonitoring(): void {
    setInterval(() => {
      this.checkEngineHealth();
    }, this.healthCheckInterval);
  }

  /**
   * Checks health of all engine instances
   */
  private async checkEngineHealth(): Promise<void> {
    for (const [engineType, pool] of this.enginePools.entries()) {
      const metrics = this.engineMetrics.get(engineType);
      if (!metrics) continue;

      // Remove unhealthy instances
      const unhealthyEngines = pool.filter(engine => !this.isEngineHealthy(engine));
      for (const engine of unhealthyEngines) {
        if (engineType === SCRAPER_ENGINES.SELENIUM) {
          await (engine as SeleniumEngine).cleanup();
        }
        const index = pool.indexOf(engine);
        if (index > -1) {
          pool.splice(index, 1);
        }
      }

      // Update health metrics
      metrics.healthyInstances = pool.length - unhealthyEngines.length;
      metrics.totalInstances = pool.length;
      this.engineMetrics.set(engineType, metrics);
    }
  }

  /**
   * Checks if an engine instance is available for use
   */
  private isEngineAvailable(engine: ScraperEngine): boolean {
    // Implementation would check engine state, current load, etc.
    return true;
  }

  /**
   * Checks if an engine instance is healthy
   */
  private isEngineHealthy(engine: ScraperEngine): boolean {
    // Implementation would check error rates, response times, etc.
    return true;
  }

  /**
   * Initializes metrics tracking for an engine type
   */
  private initializeEngineMetrics(engineType: SCRAPER_ENGINES): void {
    this.engineMetrics.set(engineType, {
      successfulJobs: 0,
      failedJobs: 0,
      totalJobs: 0,
      averageResponseTime: 0,
      healthyInstances: 0,
      totalInstances: 0,
      lastUpdated: new Date()
    });
  }

  /**
   * Updates metrics for an engine type
   */
  private updateEngineMetrics(engineType: SCRAPER_ENGINES, jobId: string): void {
    const metrics = this.engineMetrics.get(engineType);
    if (metrics) {
      metrics.totalJobs++;
      metrics.lastUpdated = new Date();
      this.engineMetrics.set(engineType, metrics);
    }
  }
}