import { Options } from 'amqplib'; // ^0.10.0

/**
 * Connection configuration interface for RabbitMQ
 */
interface ConnectionConfig {
  protocol: string;
  hostname: string;
  port: number;
  username: string;
  password: string;
  vhost: string;
  heartbeat: number;
  ssl: boolean;
  frameMax: number;
  channelMax: number;
  connectionTimeout: number;
}

/**
 * Queue definition interface with options and retry policies
 */
interface QueueDefinition {
  name: string;
  options: Options.AssertQueue;
  deadLetter: string;
  retryDelay: number;
  maxRetries: number;
  priority: number;
}

/**
 * Worker configuration interface for queue consumers
 */
interface WorkerConfig {
  concurrency: number;
  prefetch: number;
  maxMemory: number;
  idleTimeout: number;
}

/**
 * Queue definitions for different service types
 */
interface QueueDefinitions {
  scraper: QueueDefinition;
  grant: QueueDefinition;
  search: QueueDefinition;
}

/**
 * Worker configurations for different service types
 */
interface WorkerConfigurations {
  scraper: WorkerConfig;
  grant: WorkerConfig;
  search: WorkerConfig;
}

/**
 * Complete queue configuration interface
 */
export interface QueueConfig {
  connection: ConnectionConfig;
  queues: QueueDefinitions;
  workers: WorkerConfigurations;
}

/**
 * Production-ready queue configuration with environment-specific overrides
 */
export const queueConfig: QueueConfig = {
  connection: {
    protocol: 'amqp',
    hostname: process.env.RABBITMQ_HOST || 'localhost',
    port: parseInt(process.env.RABBITMQ_PORT) || 5672,
    username: process.env.RABBITMQ_USER || 'guest',
    password: process.env.RABBITMQ_PASS || 'guest',
    vhost: process.env.RABBITMQ_VHOST || '/',
    heartbeat: 60,
    ssl: process.env.NODE_ENV === 'production',
    frameMax: 0, // No frame size limit
    channelMax: 0, // No channel limit
    connectionTimeout: 30000, // 30 seconds
  },

  queues: {
    scraper: {
      name: 'scraper_jobs',
      options: {
        durable: true,
        deadLetterExchange: 'scraper_dlx',
        messageTtl: 86400000, // 24 hours
        maxLength: 10000,
        maxPriority: 10,
      },
      deadLetter: 'scraper_dlq',
      retryDelay: 30000, // 30 seconds
      maxRetries: 3,
      priority: 5,
    },

    grant: {
      name: 'grant_jobs',
      options: {
        durable: true,
        deadLetterExchange: 'grant_dlx',
        messageTtl: 172800000, // 48 hours
        maxLength: 5000,
        maxPriority: 10,
      },
      deadLetter: 'grant_dlq',
      retryDelay: 60000, // 1 minute
      maxRetries: 2,
      priority: 3,
    },

    search: {
      name: 'search_jobs',
      options: {
        durable: true,
        deadLetterExchange: 'search_dlx',
        messageTtl: 43200000, // 12 hours
        maxLength: 20000,
        maxPriority: 10,
      },
      deadLetter: 'search_dlq',
      retryDelay: 15000, // 15 seconds
      maxRetries: 3,
      priority: 7,
    },
  },

  workers: {
    scraper: {
      concurrency: 4, // 4 parallel workers
      prefetch: 1, // Process one message at a time
      maxMemory: 512, // 512MB memory limit
      idleTimeout: 300000, // 5 minutes
    },

    grant: {
      concurrency: 2, // 2 parallel workers
      prefetch: 1, // Process one message at a time
      maxMemory: 1024, // 1GB memory limit
      idleTimeout: 600000, // 10 minutes
    },

    search: {
      concurrency: 3, // 3 parallel workers
      prefetch: 1, // Process one message at a time
      maxMemory: 256, // 256MB memory limit
      idleTimeout: 180000, // 3 minutes
    },
  },
};