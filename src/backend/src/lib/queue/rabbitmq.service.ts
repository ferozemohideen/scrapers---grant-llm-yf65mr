import { injectable } from 'inversify';
import * as amqp from 'amqplib'; // ^0.10.0
import * as winston from 'winston'; // ^3.8.0
import { QueueConfig } from '../../config/queue.config';

/**
 * Interface for queue metrics collection
 */
interface QueueMetrics {
  publishedMessages: Map<string, number>;
  consumedMessages: Map<string, number>;
  errors: Map<string, number>;
  processingTimes: Map<string, number[]>;
  lastHealthCheck: Date;
}

/**
 * Interface for publish operation options
 */
interface PublishOptions {
  priority?: number;
  expiration?: string;
  persistent?: boolean;
  headers?: any;
}

/**
 * Interface for consume operation options
 */
interface ConsumeOptions {
  noAck?: boolean;
  exclusive?: boolean;
  consumerTag?: string;
  retryOnError?: boolean;
}

/**
 * Enterprise-grade RabbitMQ service implementation providing reliable message queue
 * functionality for distributed task processing with comprehensive monitoring and
 * error handling capabilities.
 */
@injectable()
export class RabbitMQService {
  private connection: amqp.Connection;
  private channel: amqp.Channel;
  private logger: winston.Logger;
  private config: QueueConfig;
  private connectionRetryCount: number = 0;
  private healthCheckInterval: NodeJS.Timer;
  private channelPool: Map<string, amqp.Channel>;
  private metrics: QueueMetrics;

  constructor(config: QueueConfig) {
    this.config = config;
    this.channelPool = new Map();
    this.initializeLogger();
    this.initializeMetrics();
  }

  /**
   * Initializes the Winston logger with appropriate configuration
   */
  private initializeLogger(): void {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'rabbitmq-error.log', level: 'error' }),
        new winston.transports.File({ filename: 'rabbitmq-combined.log' })
      ]
    });
  }

  /**
   * Initializes metrics collection
   */
  private initializeMetrics(): void {
    this.metrics = {
      publishedMessages: new Map(),
      consumedMessages: new Map(),
      errors: new Map(),
      processingTimes: new Map(),
      lastHealthCheck: new Date()
    };
  }

  /**
   * Establishes connection to RabbitMQ server with retry mechanism
   */
  public async connect(): Promise<void> {
    try {
      const { connection } = this.config;
      const connectionOptions: amqp.Options.Connect = {
        protocol: connection.protocol,
        hostname: connection.hostname,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        vhost: connection.vhost,
        heartbeat: connection.heartbeat,
        frameMax: connection.frameMax,
        channelMax: connection.channelMax,
        ssl: connection.ssl
      };

      this.connection = await amqp.connect(connectionOptions);
      this.channel = await this.connection.createChannel();
      
      // Set up connection event handlers
      this.connection.on('error', this.handleConnectionError.bind(this));
      this.connection.on('close', this.handleConnectionClose.bind(this));

      // Initialize queues and exchanges
      await this.setupQueuesAndExchanges();
      
      // Start health monitoring
      this.startHealthCheck();

      this.logger.info('Successfully connected to RabbitMQ');
      this.connectionRetryCount = 0;
    } catch (error) {
      this.handleConnectionError(error);
    }
  }

  /**
   * Publishes a message to the specified queue with reliability guarantees
   */
  public async publishToQueue(
    queueName: string,
    message: object,
    options: PublishOptions = {}
  ): Promise<boolean> {
    try {
      const channel = await this.getOrCreateChannel(queueName);
      const queueConfig = this.getQueueConfig(queueName);
      
      const publishOptions: amqp.Options.Publish = {
        persistent: options.persistent ?? true,
        priority: options.priority ?? queueConfig.priority,
        expiration: options.expiration,
        headers: {
          ...options.headers,
          publishedAt: new Date().toISOString()
        }
      };

      const messageBuffer = Buffer.from(JSON.stringify(message));
      const published = channel.publish(
        '',
        queueName,
        messageBuffer,
        publishOptions
      );

      if (published) {
        this.updatePublishMetrics(queueName);
      }

      return published;
    } catch (error) {
      this.logger.error(`Error publishing to queue ${queueName}:`, error);
      this.updateErrorMetrics(queueName, error);
      throw error;
    }
  }

  /**
   * Sets up message consumer with comprehensive error handling
   */
  public async consume(
    queueName: string,
    callback: (msg: amqp.ConsumeMessage) => Promise<void>,
    options: ConsumeOptions = {}
  ): Promise<amqp.Replies.Consume> {
    try {
      const channel = await this.getOrCreateChannel(queueName);
      const queueConfig = this.getQueueConfig(queueName);

      // Set channel prefetch
      await channel.prefetch(this.config.workers[queueName].prefetch);

      const consumeOptions: amqp.Options.Consume = {
        noAck: options.noAck ?? false,
        exclusive: options.exclusive ?? false,
        consumerTag: options.consumerTag
      };

      return channel.consume(queueName, async (msg) => {
        if (!msg) return;

        const startTime = Date.now();
        try {
          await callback(msg);
          channel.ack(msg);
          this.updateConsumeMetrics(queueName, Date.now() - startTime);
        } catch (error) {
          this.handleConsumerError(channel, msg, error, queueConfig, options);
        }
      }, consumeOptions);
    } catch (error) {
      this.logger.error(`Error setting up consumer for queue ${queueName}:`, error);
      this.updateErrorMetrics(queueName, error);
      throw error;
    }
  }

  /**
   * Gracefully closes the RabbitMQ connection and cleans up resources
   */
  public async close(): Promise<void> {
    try {
      clearInterval(this.healthCheckInterval);

      // Close all channels in the pool
      for (const [queueName, channel] of this.channelPool.entries()) {
        try {
          await channel.close();
          this.logger.info(`Closed channel for queue ${queueName}`);
        } catch (error) {
          this.logger.error(`Error closing channel for queue ${queueName}:`, error);
        }
      }

      if (this.connection) {
        await this.connection.close();
        this.logger.info('RabbitMQ connection closed successfully');
      }

      // Export final metrics
      this.exportMetrics();
    } catch (error) {
      this.logger.error('Error during RabbitMQ shutdown:', error);
      throw error;
    }
  }

  /**
   * Sets up queues and exchanges with dead letter handling
   */
  private async setupQueuesAndExchanges(): Promise<void> {
    for (const [queueType, queueConfig] of Object.entries(this.config.queues)) {
      // Assert dead letter exchange
      await this.channel.assertExchange(queueConfig.options.deadLetterExchange, 'direct', {
        durable: true
      });

      // Assert main queue
      await this.channel.assertQueue(queueConfig.name, queueConfig.options);

      // Assert dead letter queue
      await this.channel.assertQueue(queueConfig.deadLetter, {
        durable: true
      });

      // Bind dead letter queue to exchange
      await this.channel.bindQueue(
        queueConfig.deadLetter,
        queueConfig.options.deadLetterExchange,
        queueConfig.name
      );

      this.logger.info(`Set up queue ${queueConfig.name} with dead letter handling`);
    }
  }

  /**
   * Handles connection errors with retry mechanism
   */
  private async handleConnectionError(error: Error): Promise<void> {
    this.logger.error('RabbitMQ connection error:', error);
    this.updateErrorMetrics('connection', error);

    if (this.connectionRetryCount < 5) {
      this.connectionRetryCount++;
      const delay = Math.min(1000 * Math.pow(2, this.connectionRetryCount), 30000);
      
      this.logger.info(`Retrying connection in ${delay}ms (attempt ${this.connectionRetryCount})`);
      setTimeout(() => this.connect(), delay);
    } else {
      this.logger.error('Max connection retry attempts reached');
      throw error;
    }
  }

  /**
   * Handles connection close events
   */
  private handleConnectionClose(): void {
    this.logger.warn('RabbitMQ connection closed');
    this.channelPool.clear();
    this.connect();
  }

  /**
   * Handles consumer errors with retry mechanism
   */
  private handleConsumerError(
    channel: amqp.Channel,
    msg: amqp.ConsumeMessage,
    error: Error,
    queueConfig: any,
    options: ConsumeOptions
  ): void {
    this.logger.error(`Consumer error for queue ${msg.fields.routingKey}:`, error);
    this.updateErrorMetrics(msg.fields.routingKey, error);

    const retryCount = (msg.properties.headers?.retryCount || 0) + 1;

    if (options.retryOnError && retryCount <= queueConfig.maxRetries) {
      const retryDelay = queueConfig.retryDelay * Math.pow(2, retryCount - 1);
      
      // Republish with retry information
      this.publishToQueue(msg.fields.routingKey, JSON.parse(msg.content.toString()), {
        headers: {
          ...msg.properties.headers,
          retryCount,
          error: error.message,
          originalTimestamp: msg.properties.headers?.originalTimestamp || new Date().toISOString()
        },
        expiration: retryDelay.toString()
      });

      channel.ack(msg);
    } else {
      // Send to dead letter queue
      channel.nack(msg, false, false);
    }
  }

  /**
   * Starts health check monitoring
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const channel = await this.getOrCreateChannel('health_check');
        await channel.checkQueue('health_check');
        this.metrics.lastHealthCheck = new Date();
      } catch (error) {
        this.logger.error('Health check failed:', error);
        this.updateErrorMetrics('health_check', error);
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Updates metrics for published messages
   */
  private updatePublishMetrics(queueName: string): void {
    const current = this.metrics.publishedMessages.get(queueName) || 0;
    this.metrics.publishedMessages.set(queueName, current + 1);
  }

  /**
   * Updates metrics for consumed messages
   */
  private updateConsumeMetrics(queueName: string, processingTime: number): void {
    const consumed = this.metrics.consumedMessages.get(queueName) || 0;
    this.metrics.consumedMessages.set(queueName, consumed + 1);

    const times = this.metrics.processingTimes.get(queueName) || [];
    times.push(processingTime);
    this.metrics.processingTimes.set(queueName, times);
  }

  /**
   * Updates error metrics
   */
  private updateErrorMetrics(queueName: string, error: Error): void {
    const current = this.metrics.errors.get(queueName) || 0;
    this.metrics.errors.set(queueName, current + 1);
  }

  /**
   * Gets or creates a channel for the specified queue
   */
  private async getOrCreateChannel(queueName: string): Promise<amqp.Channel> {
    if (!this.channelPool.has(queueName)) {
      const channel = await this.connection.createChannel();
      this.channelPool.set(queueName, channel);
    }
    return this.channelPool.get(queueName);
  }

  /**
   * Gets queue configuration by queue name
   */
  private getQueueConfig(queueName: string): any {
    const queueType = Object.entries(this.config.queues)
      .find(([_, config]) => config.name === queueName)?.[0];
    
    if (!queueType) {
      throw new Error(`Queue configuration not found for ${queueName}`);
    }

    return this.config.queues[queueType];
  }

  /**
   * Exports metrics for monitoring
   */
  private exportMetrics(): void {
    this.logger.info('Queue Metrics:', {
      published: Object.fromEntries(this.metrics.publishedMessages),
      consumed: Object.fromEntries(this.metrics.consumedMessages),
      errors: Object.fromEntries(this.metrics.errors),
      processingTimes: Object.fromEntries(
        Array.from(this.metrics.processingTimes.entries()).map(([queue, times]) => [
          queue,
          {
            avg: times.reduce((a, b) => a + b, 0) / times.length,
            min: Math.min(...times),
            max: Math.max(...times)
          }
        ])
      ),
      lastHealthCheck: this.metrics.lastHealthCheck
    });
  }
}