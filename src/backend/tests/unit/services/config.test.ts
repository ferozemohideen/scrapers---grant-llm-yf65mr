/**
 * @fileoverview Comprehensive unit tests for ConfigService
 * Testing configuration management, validation, and event handling
 * @version 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'; // v29.0.0
import { ConfigService } from '../../src/services/config.service';
import {
  DatabaseConfig,
  ScraperConfig,
  AuthConfig,
  CacheConfig
} from '../../src/interfaces/config.interface';

describe('ConfigService', () => {
  let configService: ConfigService;
  let mockProcessEnv: NodeJS.ProcessEnv;

  // Mock configurations for testing
  const mockDatabaseConfig: DatabaseConfig = {
    host: 'localhost',
    port: 5432,
    database: 'tech_transfer',
    username: 'admin',
    password: 'secure_password',
    maxConnections: 100,
    connectionTimeout: 30000,
    idleTimeout: 10000,
    ssl: true,
    poolConfig: {
      minConnections: 10,
      maxIdleTime: 30000,
      connectionTimeoutMillis: 5000,
      statementTimeout: 60000
    }
  };

  const mockScraperConfig: ScraperConfig = {
    engines: {
      beautiful_soup: {
        timeout: 30000,
        userAgent: 'TestBot/1.0',
        maxConcurrency: 5,
        headless: true,
        proxyList: [],
        respectRobotsTxt: true,
        maxResponseSize: 5242880
      }
    },
    rateLimits: {
      requestsPerSecond: 2,
      burstLimit: 5,
      cooldownPeriod: 60,
      institutionSpecificLimits: {},
      rateLimitingStrategy: 'token-bucket'
    },
    monitoring: {
      enabled: true,
      samplingRate: 1,
      metrics: ['responseTime', 'errorRate']
    }
  };

  beforeEach(() => {
    // Store original process.env
    mockProcessEnv = { ...process.env };
    
    // Set up test environment variables
    process.env.NODE_ENV = 'test';
    process.env.CONFIG_VERSION = '1.0.0';
    
    // Initialize ConfigService
    configService = new ConfigService();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original process.env
    process.env = mockProcessEnv;
  });

  describe('Environment Configuration', () => {
    it('should load correct configuration for test environment', () => {
      const config = configService.getConfig('environment');
      expect(config).toBe('test');
    });

    it('should default to development environment if not specified', () => {
      delete process.env.NODE_ENV;
      const newConfigService = new ConfigService();
      const config = newConfigService.getConfig('environment');
      expect(config).toBe('development');
    });

    it('should handle environment variable overrides', async () => {
      process.env.DATABASE_HOST = 'custom-host';
      await configService.updateConfig('database', {
        ...mockDatabaseConfig,
        host: process.env.DATABASE_HOST
      });
      const config = configService.getConfig<DatabaseConfig>('database');
      expect(config.host).toBe('custom-host');
    });
  });

  describe('Database Configuration', () => {
    it('should validate database configuration successfully', async () => {
      const result = await configService.updateConfig('database', mockDatabaseConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid database configuration', async () => {
      const invalidConfig = { ...mockDatabaseConfig, port: -1 };
      const result = await configService.updateConfig('database', invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid port number');
    });

    it('should validate connection pool settings', async () => {
      const config = { ...mockDatabaseConfig, poolConfig: { minConnections: -1 } };
      const result = await configService.updateConfig('database', config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid pool configuration');
    });
  });

  describe('Scraper Configuration', () => {
    it('should validate scraper configuration successfully', async () => {
      const result = await configService.updateConfig('scraper', mockScraperConfig);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate rate limiting settings', async () => {
      const invalidConfig = {
        ...mockScraperConfig,
        rateLimits: { ...mockScraperConfig.rateLimits, requestsPerSecond: 0 }
      };
      const result = await configService.updateConfig('scraper', invalidConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid rate limit configuration');
    });

    it('should handle institution-specific rate limits', async () => {
      const customConfig = {
        ...mockScraperConfig,
        rateLimits: {
          ...mockScraperConfig.rateLimits,
          institutionSpecificLimits: {
            'stanford.edu': 5
          }
        }
      };
      const result = await configService.updateConfig('scraper', customConfig);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Security Configuration', () => {
    it('should enforce minimum security requirements', async () => {
      const config = {
        jwt: {
          secret: 'too-short',
          expiresIn: '15m'
        }
      };
      const result = await configService.updateConfig('security', config);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('JWT secret must be at least 32 characters');
    });

    it('should validate SSL configuration', async () => {
      const config = { ...mockDatabaseConfig, ssl: false };
      const result = await configService.updateConfig('database', config);
      expect(result.warnings).toContain('SSL is recommended for production use');
    });

    it('should validate authentication settings', async () => {
      const authConfig: AuthConfig = {
        jwt: {
          secret: 'very-long-and-secure-secret-key-for-testing',
          expiresIn: '15m',
          algorithm: 'HS256',
          issuer: 'test'
        },
        session: {
          secret: 'session-secret',
          name: 'test-session',
          resave: false,
          saveUninitialized: false,
          cookie: {
            secure: true,
            httpOnly: true,
            maxAge: 3600000,
            sameSite: 'strict'
          },
          rolling: true,
          unset: 'destroy'
        },
        security: {
          cors: {
            enabled: true,
            origins: ['https://example.com'],
            methods: ['GET', 'POST'],
            credentials: true
          },
          rateLimit: {
            windowMs: 900000,
            max: 100
          },
          helmet: {
            enabled: true,
            config: {}
          },
          csrf: {
            enabled: true,
            secret: 'csrf-secret'
          }
        },
        mfa: {
          enabled: true,
          methods: ['totp'],
          tokenValidityDuration: 300
        }
      };
      const result = await configService.updateConfig('auth', authConfig);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Cache Configuration', () => {
    it('should validate cache configuration', async () => {
      const cacheConfig: CacheConfig = {
        host: 'localhost',
        port: 6379,
        ttl: 3600,
        cluster: false,
        db: 0,
        keyPrefix: 'test:',
        persistence: {
          enabled: true,
          strategy: 'rdb',
          interval: 3600
        }
      };
      const result = await configService.updateConfig('cache', cacheConfig);
      expect(result.isValid).toBe(true);
    });

    it('should validate cluster configuration', async () => {
      const clusterConfig: CacheConfig = {
        host: 'localhost',
        port: 6379,
        ttl: 3600,
        cluster: true,
        clusterNodes: [],
        db: 0
      };
      const result = await configService.updateConfig('cache', clusterConfig);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Cluster nodes required when clustering is enabled');
    });
  });

  describe('Configuration Change Events', () => {
    it('should emit events on configuration changes', (done) => {
      const listener = jest.fn();
      configService.onConfigChange((event) => {
        listener(event);
        expect(event.key).toBe('database');
        expect(event.previousValue).toBeDefined();
        expect(event.newValue).toEqual(mockDatabaseConfig);
        done();
      });

      configService.updateConfig('database', mockDatabaseConfig);
    });

    it('should track configuration version changes', async () => {
      const initialVersion = configService.getConfig('version');
      await configService.updateConfig('database', mockDatabaseConfig);
      const newVersion = configService.getConfig('version');
      expect(newVersion).not.toBe(initialVersion);
    });
  });
});