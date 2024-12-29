/**
 * @fileoverview Enterprise-grade Redis caching service implementation using the Singleton pattern.
 * Provides advanced features including clustering, persistence, monitoring, and performance optimizations
 * to ensure sub-2 second search response times.
 * @version 1.0.0
 */

import Redis, { Cluster, ClusterOptions, RedisOptions } from 'ioredis'; // v5.0.0
import { Counter, Gauge, register } from 'prom-client'; // v14.0.0
import { RedisConfig } from '../../config/database.config';

/**
 * Interface for cache metrics
 */
interface CacheMetrics {
  hits: number;
  misses: number;
  latency: number;
  memoryUsage: number;
  connectedClients: number;
}

/**
 * Enterprise-grade Redis caching service implementing Singleton pattern
 * with advanced features for high availability and performance
 */
export class RedisService {
  private static instance: RedisService;
  private client: Redis | Cluster;
  private readonly config: RedisConfig;
  private readonly connectionPool: Map<string, Redis>;
  
  // Prometheus metrics
  private readonly metrics = {
    hits: new Counter({
      name: 'redis_cache_hits_total',
      help: 'Total number of cache hits'
    }),
    misses: new Counter({
      name: 'redis_cache_misses_total',
      help: 'Total number of cache misses'
    }),
    latency: new Gauge({
      name: 'redis_operation_latency_ms',
      help: 'Redis operation latency in milliseconds'
    }),
    memoryUsage: new Gauge({
      name: 'redis_memory_usage_bytes',
      help: 'Redis memory usage in bytes'
    })
  };

  /**
   * Private constructor implementing advanced Redis configuration
   * @param config Redis configuration object
   */
  private constructor(config: RedisConfig) {
    this.config = config;
    this.connectionPool = new Map();

    const baseOptions: RedisOptions = {
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db || 0,
      keyPrefix: config.keyPrefix,
      retryStrategy: (times: number) => {
        const delay = Math.min(
          times * (config.reconnectStrategy?.delay || 3000),
          30000
        );
        return delay;
      },
      enableReadyCheck: true,
      maxRetriesPerRequest: config.reconnectStrategy?.retries || 10,
      enableOfflineQueue: true,
      connectTimeout: 10000,
      lazyConnect: true
    };

    if (config.cluster) {
      const clusterOptions: ClusterOptions = {
        clusterRetryStrategy: (times: number) => {
          const delay = Math.min(times * 2000, 30000);
          return delay;
        },
        redisOptions: baseOptions,
        slotsRefreshTimeout: 10000,
        enableReadyCheck: true,
        scaleReads: 'slave'
      };

      this.client = new Redis.Cluster(
        config.clusterNodes?.map(node => {
          const [host, port] = node.split(':');
          return { host, port: parseInt(port, 10) };
        }) || [],
        clusterOptions
      );
    } else {
      this.client = new Redis(baseOptions);
    }

    this.setupEventHandlers();
    this.configurePersistence();
  }

  /**
   * Returns singleton instance with lazy initialization
   * @param config Redis configuration
   * @returns Singleton instance of RedisService
   */
  public static getInstance(config: RedisConfig): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService(config);
    }
    return RedisService.instance;
  }

  /**
   * Enhanced key-value caching with monitoring
   * @param key Cache key
   * @param value Value to cache
   * @param ttl Time to live in seconds
   */
  public async set(key: string, value: any, ttl?: number): Promise<void> {
    const startTime = Date.now();
    try {
      const serializedValue = this.serialize(value);
      if (ttl) {
        await this.client.setex(key, ttl, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
      this.metrics.latency.set(Date.now() - startTime);
    } catch (error) {
      console.error(`Redis SET error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Optimized cache retrieval with monitoring
   * @param key Cache key
   * @returns Cached value or null
   */
  public async get<T>(key: string): Promise<T | null> {
    const startTime = Date.now();
    try {
      const value = await this.client.get(key);
      this.metrics.latency.set(Date.now() - startTime);

      if (value) {
        this.metrics.hits.inc();
        return this.deserialize<T>(value);
      }

      this.metrics.misses.inc();
      return null;
    } catch (error) {
      console.error(`Redis GET error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Key removal with monitoring
   * @param key Cache key
   */
  public async delete(key: string): Promise<void> {
    const startTime = Date.now();
    try {
      await this.client.del(key);
      this.metrics.latency.set(Date.now() - startTime);
    } catch (error) {
      console.error(`Redis DELETE error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Safe cache clearing with monitoring
   */
  public async clear(): Promise<void> {
    const startTime = Date.now();
    try {
      await this.client.flushall();
      this.metrics.latency.set(Date.now() - startTime);
    } catch (error) {
      console.error('Redis CLEAR error:', error);
      throw error;
    }
  }

  /**
   * Retrieve cache performance metrics
   * @returns Cache metrics object
   */
  public async getMetrics(): Promise<CacheMetrics> {
    const info = await this.client.info();
    const metrics = {
      hits: parseInt(this.parseInfo(info, 'keyspace_hits') || '0'),
      misses: parseInt(this.parseInfo(info, 'keyspace_misses') || '0'),
      latency: parseFloat(await this.metrics.latency.get()),
      memoryUsage: parseInt(this.parseInfo(info, 'used_memory') || '0'),
      connectedClients: parseInt(this.parseInfo(info, 'connected_clients') || '0')
    };

    this.metrics.memoryUsage.set(metrics.memoryUsage);
    return metrics;
  }

  /**
   * Configure Redis persistence settings
   */
  private configurePersistence(): void {
    if (this.config.persistence?.enabled) {
      const { strategy, interval } = this.config.persistence;
      if (strategy === 'rdb') {
        this.client.config('SET', 'save', `${interval} 1`);
      } else if (strategy === 'aof') {
        this.client.config('SET', 'appendonly', 'yes');
        this.client.config('SET', 'appendfsync', 'everysec');
      }
    }
  }

  /**
   * Set up Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('error', (error) => {
      console.error('Redis client error:', error);
    });

    this.client.on('connect', () => {
      console.log('Redis client connected');
    });

    this.client.on('ready', () => {
      console.log('Redis client ready');
    });

    this.client.on('close', () => {
      console.log('Redis client connection closed');
    });
  }

  /**
   * Serialize value for storage
   * @param value Value to serialize
   * @returns Serialized value
   */
  private serialize(value: any): string {
    try {
      return JSON.stringify(value);
    } catch (error) {
      console.error('Redis serialization error:', error);
      throw error;
    }
  }

  /**
   * Deserialize value from storage
   * @param value Value to deserialize
   * @returns Deserialized value
   */
  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Redis deserialization error:', error);
      throw error;
    }
  }

  /**
   * Parse Redis INFO command output
   * @param info Redis INFO output
   * @param key Key to extract
   * @returns Extracted value
   */
  private parseInfo(info: string, key: string): string | null {
    const match = info.match(new RegExp(`^${key}:(.*)$`, 'm'));
    return match ? match[1].trim() : null;
  }
}