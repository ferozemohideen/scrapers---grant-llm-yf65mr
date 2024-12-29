/**
 * @fileoverview Centralizes and exports all worker implementations with comprehensive
 * error handling, monitoring, and graceful shutdown capabilities.
 * @version 1.0.0
 */

import { Logger } from '@nestjs/common'; // ^8.0.0
import { CircuitBreaker } from 'resilience4j-typescript'; // ^0.3.0
import { Counter, Gauge } from 'prom-client'; // ^14.0.0

import { GrantWorker } from './grant.worker';
import { ScraperWorker } from './scraper.worker';
import { SearchWorker } from './search.worker';

/**
 * Interface for worker configuration
 */
interface WorkerConfig {
  maxRetries: number;
  healthCheckInterval: number;
  shutdownTimeout: number;
  circuitBreaker: {
    failureThreshold: number;
    waitDurationInOpenState: number;
    ringBufferSizeInClosedState: number;
  };
}

/**
 * Interface for worker metrics
 */
interface WorkerMetrics {
  activeWorkers: Gauge<string>;
  jobsProcessed: Counter<string>;
  failedJobs: Counter<string>;
  processingTime: Gauge<string>;
  lastHealthCheck: Gauge<string>;
}

// Default configuration
const DEFAULT_CONFIG: WorkerConfig = {
  maxRetries: 3,
  healthCheckInterval: 30000, // 30 seconds
  shutdownTimeout: 10000, // 10 seconds
  circuitBreaker: {
    failureThreshold: 50,
    waitDurationInOpenState: 60000,
    ringBufferSizeInClosedState: 100
  }
};

// Initialize logger
const logger = new Logger('WorkerManager');

// Initialize metrics
const metrics: WorkerMetrics = {
  activeWorkers: new Gauge({
    name: 'workers_active_count',
    help: 'Number of active workers'
  }),
  jobsProcessed: new Counter({
    name: 'workers_jobs_processed_total',
    help: 'Total number of jobs processed',
    labelNames: ['worker_type']
  }),
  failedJobs: new Counter({
    name: 'workers_jobs_failed_total',
    help: 'Total number of failed jobs',
    labelNames: ['worker_type', 'error_type']
  }),
  processingTime: new Gauge({
    name: 'workers_processing_time_seconds',
    help: 'Job processing time in seconds',
    labelNames: ['worker_type']
  }),
  lastHealthCheck: new Gauge({
    name: 'workers_last_health_check_timestamp',
    help: 'Timestamp of last successful health check',
    labelNames: ['worker_type']
  })
};

// Worker instances
let grantWorker: GrantWorker | null = null;
let scraperWorker: ScraperWorker | null = null;
let searchWorker: SearchWorker | null = null;

// Circuit breakers for each worker type
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Initializes all workers with comprehensive error handling and monitoring
 * @param config Worker configuration
 */
export async function initializeWorkers(config: Partial<WorkerConfig> = {}): Promise<void> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  
  try {
    logger.log('Initializing workers...');

    // Initialize circuit breakers
    initializeCircuitBreakers(finalConfig.circuitBreaker);

    // Initialize workers with circuit breaker protection
    const initPromises = [
      initializeWorker('grant', () => new GrantWorker()),
      initializeWorker('scraper', () => new ScraperWorker()),
      initializeWorker('search', () => new SearchWorker())
    ];

    await Promise.all(initPromises);

    // Start health monitoring
    startHealthMonitoring(finalConfig.healthCheckInterval);

    metrics.activeWorkers.set(3); // All workers initialized
    logger.log('All workers initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize workers', error);
    metrics.activeWorkers.set(0);
    throw error;
  }
}

/**
 * Initializes circuit breakers for worker error handling
 */
function initializeCircuitBreakers(config: WorkerConfig['circuitBreaker']): void {
  ['grant', 'scraper', 'search'].forEach(workerType => {
    const breaker = new CircuitBreaker({
      failureRateThreshold: config.failureThreshold,
      waitDurationInOpenState: config.waitDurationInOpenState,
      ringBufferSizeInClosedState: config.ringBufferSizeInClosedState
    });

    breaker.onStateChange(state => {
      logger.warn(`Circuit breaker state changed for ${workerType}: ${state}`);
    });

    circuitBreakers.set(workerType, breaker);
  });
}

/**
 * Initializes a single worker with circuit breaker protection
 */
async function initializeWorker(
  type: string,
  factory: () => GrantWorker | ScraperWorker | SearchWorker
): Promise<void> {
  const breaker = circuitBreakers.get(type);
  if (!breaker) {
    throw new Error(`Circuit breaker not found for worker type: ${type}`);
  }

  try {
    const worker = await breaker.execute(async () => {
      const instance = factory();
      await instance.start();
      return instance;
    });

    switch (type) {
      case 'grant':
        grantWorker = worker as GrantWorker;
        break;
      case 'scraper':
        scraperWorker = worker as ScraperWorker;
        break;
      case 'search':
        searchWorker = worker as SearchWorker;
        break;
    }

    logger.log(`${type} worker initialized successfully`);
  } catch (error) {
    logger.error(`Failed to initialize ${type} worker`, error);
    throw error;
  }
}

/**
 * Starts periodic health monitoring of all workers
 */
function startHealthMonitoring(interval: number): void {
  setInterval(async () => {
    try {
      const checks = await Promise.all([
        checkWorkerHealth('grant', grantWorker),
        checkWorkerHealth('scraper', scraperWorker),
        checkWorkerHealth('search', searchWorker)
      ]);

      const activeCount = checks.filter(Boolean).length;
      metrics.activeWorkers.set(activeCount);

      logger.debug(`Health check completed. Active workers: ${activeCount}/3`);
    } catch (error) {
      logger.error('Health check failed', error);
    }
  }, interval);
}

/**
 * Checks health of a specific worker
 */
async function checkWorkerHealth(
  type: string,
  worker: GrantWorker | ScraperWorker | SearchWorker | null
): Promise<boolean> {
  if (!worker) return false;

  try {
    await worker.healthCheck();
    metrics.lastHealthCheck.labels(type).setToCurrentTime();
    return true;
  } catch (error) {
    logger.error(`Health check failed for ${type} worker`, error);
    return false;
  }
}

/**
 * Gracefully shuts down all workers
 */
export async function shutdownWorkers(): Promise<void> {
  logger.log('Initiating graceful shutdown of workers...');

  try {
    const shutdownPromises = [
      grantWorker?.stop(),
      scraperWorker?.stop(),
      searchWorker?.stop()
    ].filter(Boolean);

    await Promise.allSettled(shutdownPromises);

    // Clear worker instances
    grantWorker = null;
    scraperWorker = null;
    searchWorker = null;

    // Clear circuit breakers
    circuitBreakers.clear();

    // Update metrics
    metrics.activeWorkers.set(0);

    logger.log('All workers shut down successfully');
  } catch (error) {
    logger.error('Error during worker shutdown', error);
    throw error;
  }
}

// Export worker classes for external use
export { GrantWorker, ScraperWorker, SearchWorker };