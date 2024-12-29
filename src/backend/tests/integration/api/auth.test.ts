/**
 * @fileoverview Integration tests for authentication API endpoints with comprehensive security validation
 * @version 1.0.0
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals'; // v29.0.0
import supertest from 'supertest'; // v6.3.0
import Redis from 'redis-mock'; // v0.56.3
import { AuthController } from '../../../src/api/controllers/auth.controller';
import { AuthService } from '../../../src/services/auth.service';
import { createError } from '../../../src/utils/error.util';
import { ERROR_TYPES } from '../../../src/constants/error.constants';
import { API_VALIDATION_RULES } from '../../../src/constants/validation.constants';

// Test configuration constants
const TEST_SECURITY_CONFIG = {
  rateLimit: {
    window: 60000, // 1 minute
    maxRequests: {
      anonymous: 30,
      authenticated: 100
    }
  },
  tokenExpiry: 3600,
  maxLoginAttempts: 5
};

const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
};

describe('Auth API Security Integration Tests', () => {
  let app: any;
  let request: supertest.SuperTest<supertest.Test>;
  let authService: AuthService;
  let redisClient: any;

  beforeAll(async () => {
    // Initialize mock Redis client
    redisClient = Redis.createClient();
    
    // Initialize auth service with test configuration
    authService = AuthService.getInstance();
    
    // Initialize test app with security middleware
    const authController = new AuthController();
    app = await initializeTestApp(authController);
    request = supertest(app);
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  beforeEach(async () => {
    await redisClient.flushall();
  });

  describe('POST /auth/login', () => {
    test('should enforce rate limiting for anonymous users', async () => {
      const loginAttempts = Array(TEST_SECURITY_CONFIG.rateLimit.maxRequests.anonymous + 1)
        .fill(null)
        .map(() => 
          request
            .post('/auth/login')
            .send({
              email: 'test@example.com',
              password: 'TestPassword123!'
            })
        );

      const responses = await Promise.all(loginAttempts);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).toBe(429);
      expect(lastResponse.body.error.type).toBe(ERROR_TYPES.RATE_LIMIT_ERROR);
      expect(lastResponse.headers['retry-after']).toBeDefined();
    });

    test('should validate security headers on login response', async () => {
      const response = await request
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      // Verify security headers
      Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
        expect(response.headers[header.toLowerCase()]).toBe(value);
      });
    });

    test('should properly handle failed login attempts and account lockout', async () => {
      const attempts = Array(TEST_SECURITY_CONFIG.maxLoginAttempts + 1)
        .fill(null)
        .map(() => 
          request
            .post('/auth/login')
            .send({
              email: 'test@example.com',
              password: 'WrongPassword123!'
            })
        );

      const responses = await Promise.all(attempts);
      const lastResponse = responses[responses.length - 1];

      expect(lastResponse.status).toBe(401);
      expect(lastResponse.body.error.type).toBe(ERROR_TYPES.AUTHENTICATION_ERROR);
      expect(lastResponse.body.error.message).toContain('Account is temporarily locked');
    });

    test('should validate JWT token encryption and claims', async () => {
      const response = await request
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      expect(response.status).toBe(200);
      
      const { accessToken, refreshToken } = response.body.data;
      
      // Validate token encryption
      expect(await AuthService.validateTokenEncryption(accessToken)).toBe(true);
      expect(await AuthService.validateTokenEncryption(refreshToken)).toBe(true);

      // Validate secure cookie settings for refresh token
      expect(response.headers['set-cookie'][0]).toMatch(/HttpOnly/);
      expect(response.headers['set-cookie'][0]).toMatch(/Secure/);
      expect(response.headers['set-cookie'][0]).toMatch(/SameSite=Strict/);
    });
  });

  describe('POST /auth/refresh-token', () => {
    test('should validate refresh token rotation and blacklisting', async () => {
      // First login to get tokens
      const loginResponse = await request
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      const oldRefreshToken = loginResponse.headers['set-cookie']
        .find((cookie: string) => cookie.startsWith('refreshToken='))
        ?.split(';')[0]
        .split('=')[1];

      // Refresh token
      const refreshResponse = await request
        .post('/auth/refresh-token')
        .set('Cookie', `refreshToken=${oldRefreshToken}`);

      expect(refreshResponse.status).toBe(200);

      // Try to use old refresh token again
      const reusedTokenResponse = await request
        .post('/auth/refresh-token')
        .set('Cookie', `refreshToken=${oldRefreshToken}`);

      expect(reusedTokenResponse.status).toBe(401);
      expect(reusedTokenResponse.body.error.type).toBe(ERROR_TYPES.AUTHENTICATION_ERROR);
      expect(reusedTokenResponse.body.error.message).toContain('Token has been revoked');
    });
  });

  describe('POST /auth/logout', () => {
    test('should properly invalidate session and clear security tokens', async () => {
      // First login to get session
      const loginResponse = await request
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123!'
        });

      const accessToken = loginResponse.body.data.accessToken;

      // Perform logout
      const logoutResponse = await request
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(logoutResponse.status).toBe(204);

      // Verify cookie clearing
      expect(logoutResponse.headers['set-cookie']).toBeDefined();
      expect(logoutResponse.headers['set-cookie'][0]).toMatch(/refreshToken=;/);
      expect(logoutResponse.headers['set-cookie'][0]).toMatch(/Expires=/);

      // Verify token blacklisting
      const protectedResponse = await request
        .get('/api/protected')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(protectedResponse.status).toBe(401);
    });
  });
});

/**
 * Helper function to initialize test app with security configurations
 */
async function initializeTestApp(authController: AuthController): Promise<any> {
  // Implementation would initialize Express app with security middleware
  // This is a placeholder for the actual implementation
  return {};
}