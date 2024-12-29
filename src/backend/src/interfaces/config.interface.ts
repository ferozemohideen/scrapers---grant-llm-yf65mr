/**
 * @fileoverview Defines comprehensive TypeScript interfaces for application configuration
 * including database, authentication, scraping, and system settings.
 * @version 1.0.0
 */

import { SCRAPER_ENGINES } from '../constants/scraper.constants';

/**
 * PostgreSQL database configuration interface with connection pooling
 * and optimization settings
 */
export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  maxConnections: number;
  connectionTimeout: number; // milliseconds
  idleTimeout: number; // milliseconds
  ssl: boolean;
  poolConfig?: {
    minConnections: number;
    maxIdleTime: number; // milliseconds
    connectionTimeoutMillis: number;
    statementTimeout: number; // milliseconds
  };
  replication?: {
    master: string;
    slaves: string[];
    readPreference: 'primary' | 'secondary';
  };
}

/**
 * MongoDB configuration interface with advanced options
 * for replica sets and read preferences
 */
export interface MongoConfig {
  uri: string;
  database: string;
  options: MongoOptions;
  replicaSet?: string;
  readPreference: 'primary' | 'primaryPreferred' | 'secondary' | 'secondaryPreferred';
  writeConcern?: {
    w: number | 'majority';
    j: boolean;
    wtimeout: number;
  };
  poolSize?: number;
  serverSelectionTimeoutMS?: number;
  heartbeatFrequencyMS?: number;
}

/**
 * MongoDB connection options interface
 */
interface MongoOptions {
  useNewUrlParser: boolean;
  useUnifiedTopology: boolean;
  maxPoolSize: number;
  minPoolSize: number;
  connectTimeoutMS: number;
  socketTimeoutMS: number;
  compressors?: string[];
}

/**
 * Redis cache configuration interface with cluster
 * and persistence options
 */
export interface RedisConfig {
  host: string;
  port: number;
  ttl: number; // seconds
  cluster: boolean;
  password?: string;
  db?: number;
  keyPrefix?: string;
  clusterNodes?: string[];
  reconnectStrategy?: {
    retries: number;
    delay: number; // milliseconds
  };
  persistence?: {
    enabled: boolean;
    strategy: 'rdb' | 'aof';
    interval: number;
  };
}

/**
 * Scraper engine-specific configuration interface
 */
interface EngineConfig {
  timeout: number;
  userAgent: string;
  maxConcurrency: number;
  headless: boolean;
  proxyList: string[];
  customHeaders?: Record<string, string>;
  cookies?: Record<string, string>;
  downloadDelay?: number;
  respectRobotsTxt: boolean;
  maxResponseSize: number;
}

/**
 * Rate limiting configuration interface with institution-specific settings
 */
interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  cooldownPeriod: number; // seconds
  institutionSpecificLimits: Record<string, number>;
  rateLimitingStrategy: 'token-bucket' | 'leaky-bucket' | 'fixed-window';
  queueConfig?: {
    maxSize: number;
    timeout: number;
  };
}

/**
 * Retry strategy configuration interface for failed requests
 */
interface RetryStrategyConfig {
  maxAttempts: number;
  backoffMultiplier: number;
  initialDelay: number; // milliseconds
  retryableErrors: string[];
  jitter?: boolean;
  maxDelay?: number;
  retryCondition?: (error: Error) => boolean;
}

/**
 * Monitoring configuration interface for scraper operations
 */
interface MonitoringConfig {
  enabled: boolean;
  samplingRate: number;
  metrics: string[];
  alertThresholds?: {
    errorRate: number;
    responseTime: number;
    failureCount: number;
  };
  exporters?: {
    prometheus?: boolean;
    cloudWatch?: boolean;
    custom?: string;
  };
}

/**
 * JWT configuration interface with enhanced security options
 */
interface JWTConfig {
  secret: string;
  expiresIn: string;
  algorithm: 'HS256' | 'HS384' | 'HS512' | 'RS256' | 'RS384' | 'RS512';
  issuer?: string;
  audience?: string;
  refreshToken?: {
    secret: string;
    expiresIn: string;
  };
  blacklist?: {
    enabled: boolean;
    storage: 'redis' | 'database';
  };
}

/**
 * Session management configuration interface
 */
interface SessionConfig {
  secret: string;
  name: string;
  resave: boolean;
  saveUninitialized: boolean;
  cookie: {
    secure: boolean;
    httpOnly: boolean;
    maxAge: number;
    sameSite: 'strict' | 'lax' | 'none';
  };
  rolling: boolean;
  unset: 'destroy' | 'keep';
}

/**
 * Security configuration interface with advanced options
 */
interface SecurityConfig {
  cors: {
    enabled: boolean;
    origins: string[];
    methods: string[];
    credentials: boolean;
  };
  rateLimit: {
    windowMs: number;
    max: number;
  };
  helmet: {
    enabled: boolean;
    config: Record<string, unknown>;
  };
  csrf: {
    enabled: boolean;
    secret: string;
  };
}

/**
 * Multi-factor authentication configuration interface
 */
interface MFAConfig {
  enabled: boolean;
  methods: ('totp' | 'sms' | 'email')[];
  tokenValidityDuration: number;
  backupCodes?: {
    count: number;
    length: number;
  };
  issuer?: string;
  window?: number;
}

/**
 * Main scraper configuration interface combining all components
 */
export interface ScraperConfig {
  engines: Record<SCRAPER_ENGINES, EngineConfig>;
  rateLimits: RateLimitConfig;
  retryStrategies: RetryStrategyConfig;
  monitoring: MonitoringConfig;
  storage?: {
    type: 'file' | 's3' | 'gcs';
    path: string;
    compression?: boolean;
  };
  logging?: {
    level: string;
    format: string;
    destination: string;
  };
}

/**
 * Authentication configuration interface combining all auth-related settings
 */
export interface AuthConfig {
  jwt: JWTConfig;
  session: SessionConfig;
  security: SecurityConfig;
  mfa: MFAConfig;
  passwordPolicy?: {
    minLength: number;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    requireUppercase: boolean;
    maxAge: number;
  };
}