/**
 * @fileoverview Queue module entry point that exports the RabbitMQ service implementation.
 * Provides centralized access to message queue functionality for distributed task processing
 * including scraping jobs, grant writing tasks, and search operations.
 * 
 * @version 1.0.0
 * @license MIT
 */

import { RabbitMQService } from './rabbitmq.service';

/**
 * Re-export the RabbitMQService class to maintain encapsulation of the queue module.
 * This provides a clean interface for other modules to access queue functionality
 * while hiding implementation details.
 */
export { RabbitMQService };

/**
 * Re-export specific types that consumers of the queue module may need.
 * These types are used for configuring and interacting with the queue service.
 */
export type {
  // Queue operation options
  PublishOptions,
  ConsumeOptions,
  
  // Metrics and monitoring
  QueueMetrics
} from './rabbitmq.service';

/**
 * Export queue-related constants and defaults
 */
export const QUEUE_TYPES = {
  SCRAPER: 'scraper_jobs',
  GRANT: 'grant_jobs',
  SEARCH: 'search_jobs'
} as const;

export const QUEUE_PRIORITIES = {
  HIGH: 10,
  MEDIUM: 5,
  LOW: 1
} as const;

export const QUEUE_DEFAULTS = {
  RETRY_COUNT: 3,
  TIMEOUT: 30000, // 30 seconds
  BATCH_SIZE: 10
} as const;

/**
 * Type guard to check if a queue type is valid
 */
export function isValidQueueType(type: string): type is keyof typeof QUEUE_TYPES {
  return Object.values(QUEUE_TYPES).includes(type as any);
}

/**
 * Helper function to create standardized queue message payload
 */
export function createQueueMessage<T>(
  data: T,
  priority: keyof typeof QUEUE_PRIORITIES = 'MEDIUM',
  options: { timeout?: number; retries?: number } = {}
) {
  return {
    data,
    metadata: {
      timestamp: new Date().toISOString(),
      priority: QUEUE_PRIORITIES[priority],
      timeout: options.timeout || QUEUE_DEFAULTS.TIMEOUT,
      maxRetries: options.retries || QUEUE_DEFAULTS.RETRY_COUNT
    }
  };
}

/**
 * Default export provides a convenient way to access the most commonly used queue functionality
 */
export default {
  Service: RabbitMQService,
  Types: QUEUE_TYPES,
  Priorities: QUEUE_PRIORITIES,
  Defaults: QUEUE_DEFAULTS,
  createMessage: createQueueMessage,
  isValidType: isValidQueueType
};