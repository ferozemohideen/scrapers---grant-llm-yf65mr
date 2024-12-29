/**
 * @fileoverview Integration tests for configuration management API endpoints
 * Verifies CRUD operations, environment-specific settings, security controls,
 * and performance requirements across development, staging, and production environments
 * @version 1.0.0
 */

import { describe, it, beforeEach, afterEach, expect } from 'jest'; // v29.0.0
import supertest from 'supertest'; // v6.3.0
import { PerformanceObserver } from 'perf_hooks';
import { ConfigController } from '../../src/api/controllers/config.controller';
import { 
  EnvironmentConfig, 
  SecurityConfig, 
  PerformanceConfig 
} from '../../src/interfaces/config.interface';

// Test environment configurations
const TEST_ENVIRONMENTS = ['development', 'staging', 'production'];
const PERFORMANCE_THRESHOLD = 2000; // 2 seconds in milliseconds

describe('Configuration API Integration Tests', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let performanceObserver: PerformanceObserver;
  let performanceMetrics: { duration: number; operation: string }[] = [];

  beforeEach(async () => {
    // Initialize performance monitoring
    performanceObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      entries.forEach(entry => {
        performanceMetrics.push({
          duration: entry.duration,
          operation: entry.name
        });
      });
    });
    performanceObserver.observe({ entryTypes: ['measure'] });

    // Setup test app and authentication
    app = await setupTestApp();
    request = supertest(app);
  });

  afterEach(async () => {
    // Cleanup and generate performance report
    performanceObserver.disconnect();
    await cleanupTestData();
  });

  describe('URL Configuration Management', () => {
    it('should create new URL configuration with validation', async () => {
      const testConfig = {
        name: "Stanford University",
        url: "https://techfinder.stanford.edu/",
        type: "html",
        active: true,
        selectors: {
          title: ".tech-title",
          description: ".tech-description"
        },
        rate_limit: 2
      };

      const response = await request
        .post('/api/config/urls')
        .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
        .send(testConfig)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.config).toMatchObject(testConfig);
    });

    it('should reject invalid URL configurations', async () => {
      const invalidConfig = {
        name: "Invalid University",
        url: "not-a-valid-url",
        type: "unknown"
      };

      const response = await request
        .post('/api/config/urls')
        .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
        .send(invalidConfig)
        .expect(400);

      expect(response.body.errors).toContain('Invalid URL format');
    });

    it('should enforce rate limiting rules', async () => {
      const testConfig = {
        name: "Test University",
        url: "https://test.edu/",
        type: "html",
        rate_limit: 100 // Exceeds allowed limit
      };

      const response = await request
        .post('/api/config/urls')
        .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
        .send(testConfig)
        .expect(400);

      expect(response.body.errors).toContain('Rate limit exceeds maximum allowed value');
    });
  });

  describe('Environment-Specific Configuration', () => {
    TEST_ENVIRONMENTS.forEach(env => {
      it(`should load correct configuration for ${env} environment`, async () => {
        const response = await request
          .get(`/api/config/environment`)
          .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
          .query({ environment: env })
          .expect(200);

        expect(response.body.environment).toBe(env);
        expect(response.body.config).toHaveProperty('database');
        expect(response.body.config).toHaveProperty('security');
      });

      it(`should validate environment-specific settings for ${env}`, async () => {
        const config = {
          environment: env,
          database: {
            maxConnections: env === 'production' ? 100 : 10
          }
        };

        const response = await request
          .put(`/api/config/environment`)
          .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
          .send(config)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.version).toBeDefined();
      });
    });

    it('should maintain environment isolation', async () => {
      // Update staging config
      await request
        .put('/api/config/environment')
        .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
        .send({
          environment: 'staging',
          testValue: 'staging-specific'
        })
        .expect(200);

      // Verify production remains unchanged
      const prodResponse = await request
        .get('/api/config/environment')
        .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
        .query({ environment: 'production' })
        .expect(200);

      expect(prodResponse.body.config.testValue).toBeUndefined();
    });
  });

  describe('Security Controls', () => {
    it('should enforce role-based access control', async () => {
      // Test with analyst role (insufficient permissions)
      await request
        .put('/api/config/security')
        .set('Authorization', `Bearer ${getTestToken('ANALYST')}`)
        .send({})
        .expect(403);

      // Test with admin role (sufficient permissions)
      await request
        .put('/api/config/security')
        .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
        .send({})
        .expect(200);
    });

    it('should validate security configurations', async () => {
      const securityConfig: SecurityConfig = {
        cors: {
          enabled: true,
          origins: ['https://trusted-domain.com'],
          methods: ['GET', 'POST'],
          credentials: true
        },
        rateLimit: {
          windowMs: 900000,
          max: 100
        }
      };

      const response = await request
        .put('/api/config/security')
        .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
        .send(securityConfig)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should maintain audit logs for configuration changes', async () => {
      const testChange = {
        setting: 'test-setting',
        value: 'test-value'
      };

      await request
        .put('/api/config/security')
        .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
        .send(testChange)
        .expect(200);

      const auditResponse = await request
        .get('/api/config/audit-log')
        .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
        .expect(200);

      expect(auditResponse.body.logs).toContainEqual(
        expect.objectContaining({
          action: 'UPDATE',
          setting: 'test-setting'
        })
      );
    });
  });

  describe('Performance Requirements', () => {
    it('should meet sub-2 second response time requirement', async () => {
      const startTime = Date.now();

      await request
        .get('/api/config/urls')
        .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
        .expect(200);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });

    it('should handle concurrent configuration requests', async () => {
      const requests = Array(10).fill(null).map(() => 
        request
          .get('/api/config/urls')
          .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
      );

      const responses = await Promise.all(requests);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should maintain performance under load', async () => {
      const iterations = 50;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        await request
          .get('/api/config/urls')
          .set('Authorization', `Bearer ${getTestToken('ADMIN')}`)
          .expect(200);
        durations.push(Date.now() - startTime);
      }

      const averageDuration = durations.reduce((a, b) => a + b) / iterations;
      expect(averageDuration).toBeLessThan(PERFORMANCE_THRESHOLD);
    });
  });
});

// Helper Functions

async function setupTestApp() {
  // Implementation for test app setup
}

async function cleanupTestData() {
  // Implementation for test data cleanup
}

function getTestToken(role: string): string {
  // Implementation for generating test JWT tokens
  return 'test-token';
}