/**
 * @fileoverview Advanced worker implementation for processing grant-related tasks asynchronously
 * through RabbitMQ queues with comprehensive error handling and monitoring.
 * @version 1.0.0
 */

import { Injectable, Logger } from '@nestjs/common'; // ^8.0.0
import { CircuitBreaker } from 'opossum'; // ^6.0.0
import { Counter, Gauge, Histogram } from 'prom-client'; // ^14.0.0
import { RabbitMQService } from '../../lib/queue/rabbitmq.service';
import { GrantService } from '../../services/grant.service';
import { IProposalGeneration } from '../../interfaces/grant.interface';

/**
 * Interface for Prometheus metrics collection
 */
interface PrometheusMetrics {
  jobsProcessed: Counter;
  processingTime: Histogram;
  queueSize: Gauge;
  errorRate: Counter;
}

@Injectable()
export class GrantWorker {
  private readonly logger = new Logger(GrantWorker.name);
  private readonly metrics: PrometheusMetrics;
  private readonly circuitBreaker: CircuitBreaker;

  constructor(
    private readonly queueService: RabbitMQService,
    private readonly grantService: GrantService
  ) {
    // Initialize Prometheus metrics
    this.metrics = {
      jobsProcessed: new Counter({
        name: 'grant_worker_jobs_processed_total',
        help: 'Total number of grant jobs processed'
      }),
      processingTime: new Histogram({
        name: 'grant_worker_processing_time_seconds',
        help: 'Time spent processing grant jobs',
        buckets: [0.1, 0.5, 1, 2, 5, 10]
      }),
      queueSize: new Gauge({
        name: 'grant_worker_queue_size',
        help: 'Current size of the grant processing queue'
      }),
      errorRate: new Counter({
        name: 'grant_worker_errors_total',
        help: 'Total number of grant processing errors',
        labelNames: ['type']
      })
    };

    // Initialize circuit breaker for GPT-4 calls
    this.circuitBreaker = new CircuitBreaker(this.processJob.bind(this), {
      timeout: 30000, // 30 seconds
      errorThresholdPercentage: 50,
      resetTimeout: 30000,
      rollingCountTimeout: 10000
    });

    this.setupCircuitBreakerEvents();
  }

  /**
   * Starts the worker with comprehensive initialization and monitoring
   */
  async start(): Promise<void> {
    try {
      this.logger.log('Initializing grant worker...');

      // Connect to RabbitMQ
      await this.queueService.connect();

      // Set up queues with dead letter handling
      await this.setupQueues();

      // Start consuming messages
      await this.startConsuming();

      this.logger.log('Grant worker successfully initialized');
    } catch (error) {
      this.logger.error(`Failed to start grant worker: ${error.message}`);
      this.metrics.errorRate.inc({ type: 'initialization' });
      throw error;
    }
  }

  /**
   * Sets up required queues with dead letter handling
   * @private
   */
  private async setupQueues(): Promise<void> {
    try {
      const channel = await this.queueService.createChannel();

      // Assert main queue
      await channel.assertQueue('grant_jobs', {
        durable: true,
        deadLetterExchange: 'grant_dlx',
        maxPriority: 10
      });

      // Assert dead letter exchange and queue
      await channel.assertExchange('grant_dlx', 'direct', { durable: true });
      await channel.assertQueue('grant_dlq', { durable: true });
      await channel.bindQueue('grant_dlq', 'grant_dlx', 'grant_jobs');

    } catch (error) {
      this.logger.error(`Failed to setup queues: ${error.message}`);
      throw error;
    }
  }

  /**
   * Starts consuming messages from the queue
   * @private
   */
  private async startConsuming(): Promise<void> {
    try {
      await this.queueService.consume(
        'grant_jobs',
        async (msg) => {
          const startTime = Date.now();
          const data: IProposalGeneration = JSON.parse(msg.content.toString());

          try {
            await this.handleProposalGeneration(data);
            this.metrics.jobsProcessed.inc();
            this.metrics.processingTime.observe((Date.now() - startTime) / 1000);
          } catch (error) {
            this.handleProcessingError(error, msg, data);
          }
        },
        {
          noAck: false,
          prefetch: 1
        }
      );

      this.logger.log('Started consuming grant jobs');
    } catch (error) {
      this.logger.error(`Failed to start consuming: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processes a single grant job with circuit breaker protection
   * @private
   */
  private async processJob(data: IProposalGeneration): Promise<void> {
    const timer = this.metrics.processingTime.startTimer();

    try {
      await this.grantService.generateProposal(
        data.technologyId,
        data.requirements,
        {
          priority: data.priority || 5,
          userId: data.userId
        }
      );

      timer();
    } catch (error) {
      timer();
      throw error;
    }
  }

  /**
   * Handles proposal generation with comprehensive error handling
   * @private
   */
  private async handleProposalGeneration(data: IProposalGeneration): Promise<void> {
    try {
      await this.circuitBreaker.fire(data);
    } catch (error) {
      this.logger.error(
        `Failed to generate proposal for technology ${data.technologyId}: ${error.message}`
      );
      this.metrics.errorRate.inc({ type: 'generation' });
      throw error;
    }
  }

  /**
   * Handles processing errors with dead letter queue
   * @private
   */
  private handleProcessingError(error: Error, msg: any, data: IProposalGeneration): void {
    this.logger.error(
      `Error processing grant job for technology ${data.technologyId}: ${error.message}`
    );

    this.metrics.errorRate.inc({ type: error.name });

    // Send to dead letter queue
    this.queueService.publishToQueue('grant_dlq', {
      originalMessage: data,
      error: {
        message: error.message,
        stack: error.stack,
        timestamp: new Date()
      }
    });
  }

  /**
   * Sets up circuit breaker event handlers
   * @private
   */
  private setupCircuitBreakerEvents(): void {
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Circuit breaker opened - stopping grant processing');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.log('Circuit breaker half-open - testing grant processing');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.log('Circuit breaker closed - resuming normal grant processing');
    });

    this.circuitBreaker.on('fallback', () => {
      this.metrics.errorRate.inc({ type: 'circuit_breaker' });
    });
  }

  /**
   * Gracefully shuts down the worker
   */
  async onApplicationShutdown(): Promise<void> {
    try {
      await this.queueService.close();
      this.logger.log('Grant worker shutdown complete');
    } catch (error) {
      this.logger.error(`Error during shutdown: ${error.message}`);
    }
  }
}