/**
 * @fileoverview Barrel file that exports the Redis caching service implementation.
 * Provides a centralized point for accessing caching functionality across the application.
 * Implements Redis 6+ with cluster mode support, persistence, and configurable eviction policies
 * to ensure sub-2 second search response times.
 * @version 1.0.0
 */

// Re-export the RedisService class and its methods for application-wide use
export { 
  RedisService,
  // Export the getInstance method for singleton access
  getInstance,
  // Export core caching operations
  set,
  get,
  delete,
  clear
} from './redis.service';

// Note: Using Redis v5.0.0 for enterprise-grade caching with cluster mode support
// Implements:
// - Cluster mode with replica scaling
// - Persistence with RDB/AOF options
// - Configurable eviction policies
// - Performance monitoring
// - Sub-2 second response times