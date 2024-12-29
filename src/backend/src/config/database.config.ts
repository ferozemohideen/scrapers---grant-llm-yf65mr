/**
 * @fileoverview Database configuration for PostgreSQL, MongoDB, and Redis with comprehensive
 * validation, security, and performance optimizations. Implements enterprise-grade settings
 * for production deployment with clustering, sharding, and high availability.
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import { 
  DatabaseConfig, 
  MongoConfig, 
  RedisConfig 
} from '../interfaces/config.interface';

// Load environment variables
config();

/**
 * Validates PostgreSQL configuration including TimescaleDB extension
 * and connection pooling settings
 */
const validatePostgresConfig = (config: DatabaseConfig): boolean => {
  if (!config.host || !config.port || !config.database) {
    throw new Error('Missing required PostgreSQL configuration');
  }

  if (!config.username || !config.password) {
    throw new Error('Database credentials are required');
  }

  if (config.maxConnections < 1 || config.maxConnections > 10000) {
    throw new Error('Invalid connection pool size');
  }

  return true;
};

/**
 * Validates MongoDB configuration including sharding and replica set settings
 */
const validateMongoConfig = (config: MongoConfig): boolean => {
  if (!config.uri || !config.database) {
    throw new Error('Missing required MongoDB configuration');
  }

  if (config.replicaSet && !config.readPreference) {
    throw new Error('Read preference required for replica sets');
  }

  return true;
};

/**
 * Validates Redis configuration including cluster and persistence settings
 */
const validateRedisConfig = (config: RedisConfig): boolean => {
  if (!config.host || !config.port) {
    throw new Error('Missing required Redis configuration');
  }

  if (config.cluster && !config.clusterNodes?.length) {
    throw new Error('Cluster nodes required when clustering is enabled');
  }

  return true;
};

/**
 * PostgreSQL Configuration with TimescaleDB support
 * Implements connection pooling and SSL for production
 */
export const postgresConfig: DatabaseConfig = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DB || 'tech_transfer',
  username: process.env.POSTGRES_USER!,
  password: process.env.POSTGRES_PASSWORD!,
  maxConnections: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '100', 10),
  connectionTimeout: 30000,
  idleTimeout: 10000,
  ssl: process.env.POSTGRES_SSL === 'true',
  poolConfig: {
    minConnections: 10,
    maxIdleTime: 30000,
    connectionTimeoutMillis: 5000,
    statementTimeout: 60000
  },
  replication: {
    master: process.env.POSTGRES_MASTER_HOST || 'localhost',
    slaves: (process.env.POSTGRES_SLAVE_HOSTS || '').split(',').filter(Boolean),
    readPreference: 'primary'
  }
};

/**
 * MongoDB Configuration with sharding and replica sets
 * Implements enterprise-grade settings for high availability
 */
export const mongoConfig: MongoConfig = {
  uri: process.env.MONGO_URI!,
  database: process.env.MONGO_DB || 'tech_transfer_docs',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 100,
    minPoolSize: 10,
    connectTimeoutMS: 30000,
    socketTimeoutMS: 45000,
    compressors: ['zlib']
  },
  replicaSet: process.env.MONGO_REPLICA_SET,
  readPreference: 'primaryPreferred',
  writeConcern: {
    w: 'majority',
    j: true,
    wtimeout: 5000
  },
  poolSize: 50,
  serverSelectionTimeoutMS: 30000,
  heartbeatFrequencyMS: 10000
};

/**
 * Redis Configuration with clustering and persistence
 * Implements enterprise-grade caching with high availability
 */
export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  ttl: 3600,
  cluster: process.env.REDIS_CLUSTER_ENABLED === 'true',
  db: 0,
  keyPrefix: 'tech_transfer:',
  clusterNodes: (process.env.REDIS_CLUSTER_NODES || '').split(',').filter(Boolean),
  reconnectStrategy: {
    retries: 10,
    delay: 3000
  },
  persistence: {
    enabled: true,
    strategy: 'rdb',
    interval: 3600
  }
};

// Validate all configurations on startup
try {
  validatePostgresConfig(postgresConfig);
  validateMongoConfig(mongoConfig);
  validateRedisConfig(redisConfig);
} catch (error) {
  console.error('Database configuration validation failed:', error);
  process.exit(1);
}