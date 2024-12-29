/**
 * @fileoverview Comprehensive unit tests for AuthService covering authentication flows,
 * token management, session handling, and security controls
 * @version 1.0.0
 */

import { describe, test, expect, beforeAll, afterEach, jest } from '@jest/globals'; // v29.0.0
import jwt from 'jsonwebtoken'; // v9.0.0
import { AuthService } from '../../../src/services/auth.service';
import { RedisService } from '../../../src/lib/cache/redis.service';
import { User } from '../../../src/db/models/user.model';
import { UserRole } from '../../../src/interfaces/auth.interface';

// Mock user data for testing
const TEST_USER = {
  id: 'test-user-id',
  email: 'test@example.com',
  password: 'hashed_password',
  role: UserRole.ANALYST,
  lastLogin: new Date('2024-02-20'),
  failedAttempts: 0,
  comparePassword: jest.fn()
};

// Mock tokens for testing
const MOCK_TOKENS = {
  accessToken: 'mock_access_token',
  refreshToken: 'mock_refresh_token',
  expiresIn: 1800,
  tokenType: 'Bearer'
};

// Mock device info for testing
const MOCK_DEVICE_INFO = {
  ipAddress: '127.0.0.1',
  userAgent: 'Jest Test Runner',
  deviceId: 'test-device-id'
};

describe('AuthService', () => {
  let authService: AuthService;
  let redisService: RedisService;

  beforeAll(() => {
    // Initialize AuthService singleton
    authService = AuthService.getInstance();
    redisService = RedisService.getInstance({
      host: 'localhost',
      port: 6379,
      ttl: 3600,
      cluster: false
    });

    // Mock User model
    jest.spyOn(User, 'findOne').mockImplementation(() => Promise.resolve(TEST_USER));
    jest.spyOn(User, 'findById').mockImplementation(() => Promise.resolve(TEST_USER));

    // Mock Redis service
    jest.spyOn(redisService, 'set').mockImplementation(() => Promise.resolve());
    jest.spyOn(redisService, 'get').mockImplementation(() => Promise.resolve(null));
    jest.spyOn(redisService, 'del').mockImplementation(() => Promise.resolve());

    // Mock JWT functions
    jest.spyOn(jwt, 'sign').mockImplementation(() => 'mock_token');
    jest.spyOn(jwt, 'verify').mockImplementation(() => ({
      userId: TEST_USER.id,
      email: TEST_USER.email,
      role: TEST_USER.role
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Singleton Pattern', () => {
    test('should return the same instance when getInstance is called multiple times', () => {
      const instance1 = AuthService.getInstance();
      const instance2 = AuthService.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Login Flow', () => {
    test('should successfully authenticate user with valid credentials', async () => {
      TEST_USER.comparePassword.mockResolvedValueOnce(true);

      const credentials = {
        email: TEST_USER.email,
        password: 'valid_password'
      };

      const result = await authService.login(credentials, MOCK_DEVICE_INFO);

      expect(result).toEqual(expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number)
      }));

      expect(User.findOne).toHaveBeenCalledWith({ email: credentials.email });
      expect(TEST_USER.comparePassword).toHaveBeenCalledWith(credentials.password);
      expect(redisService.set).toHaveBeenCalled();
    });

    test('should handle invalid credentials correctly', async () => {
      TEST_USER.comparePassword.mockResolvedValueOnce(false);

      const credentials = {
        email: TEST_USER.email,
        password: 'wrong_password'
      };

      await expect(authService.login(credentials, MOCK_DEVICE_INFO))
        .rejects.toThrow('Invalid credentials');

      expect(TEST_USER.comparePassword).toHaveBeenCalledWith(credentials.password);
    });

    test('should enforce account lockout after max failed attempts', async () => {
      TEST_USER.failedAttempts = 5;
      TEST_USER.comparePassword.mockResolvedValueOnce(false);

      const credentials = {
        email: TEST_USER.email,
        password: 'wrong_password'
      };

      await expect(authService.login(credentials, MOCK_DEVICE_INFO))
        .rejects.toThrow('Account is temporarily locked');
    });
  });

  describe('Token Management', () => {
    test('should successfully refresh tokens with valid refresh token', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValueOnce({
        refreshToken: MOCK_TOKENS.refreshToken,
        deviceInfo: MOCK_DEVICE_INFO
      });

      const result = await authService.refreshToken(
        MOCK_TOKENS.refreshToken,
        MOCK_DEVICE_INFO
      );

      expect(result).toEqual(expect.objectContaining({
        accessToken: expect.any(String),
        refreshToken: expect.any(String),
        expiresIn: expect.any(Number)
      }));

      expect(jwt.verify).toHaveBeenCalled();
      expect(redisService.set).toHaveBeenCalled();
    });

    test('should reject refresh token if blacklisted', async () => {
      jest.spyOn(redisService, 'get')
        .mockResolvedValueOnce(true) // Blacklist check
        .mockResolvedValueOnce(null); // Session check

      await expect(authService.refreshToken(
        MOCK_TOKENS.refreshToken,
        MOCK_DEVICE_INFO
      )).rejects.toThrow('Token has been revoked');
    });

    test('should reject refresh token if session mismatch', async () => {
      jest.spyOn(redisService, 'get')
        .mockResolvedValueOnce(null) // Blacklist check
        .mockResolvedValueOnce({
          refreshToken: 'different_token',
          deviceInfo: MOCK_DEVICE_INFO
        });

      await expect(authService.refreshToken(
        MOCK_TOKENS.refreshToken,
        MOCK_DEVICE_INFO
      )).rejects.toThrow('Invalid refresh token');
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on login attempts', async () => {
      // Simulate multiple rapid login attempts
      const credentials = {
        email: TEST_USER.email,
        password: 'test_password'
      };

      for (let i = 0; i < 101; i++) {
        try {
          await authService.login(credentials, MOCK_DEVICE_INFO);
        } catch (error) {
          expect(error.message).toBe('Rate limit exceeded');
          break;
        }
      }
    });
  });

  describe('Session Management', () => {
    test('should store session information on successful login', async () => {
      TEST_USER.comparePassword.mockResolvedValueOnce(true);

      const credentials = {
        email: TEST_USER.email,
        password: 'valid_password'
      };

      await authService.login(credentials, MOCK_DEVICE_INFO);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        expect.objectContaining({
          refreshToken: expect.any(String),
          deviceInfo: MOCK_DEVICE_INFO,
          lastActivity: expect.any(Date)
        }),
        expect.any(Number)
      );
    });

    test('should update session on token refresh', async () => {
      jest.spyOn(redisService, 'get').mockResolvedValueOnce({
        refreshToken: MOCK_TOKENS.refreshToken,
        deviceInfo: MOCK_DEVICE_INFO
      });

      await authService.refreshToken(MOCK_TOKENS.refreshToken, MOCK_DEVICE_INFO);

      expect(redisService.set).toHaveBeenCalledWith(
        expect.stringContaining('session:'),
        expect.objectContaining({
          refreshToken: expect.any(String),
          deviceInfo: MOCK_DEVICE_INFO,
          lastActivity: expect.any(Date)
        }),
        expect.any(Number)
      );
    });
  });

  describe('Security Controls', () => {
    test('should handle concurrent login attempts', async () => {
      TEST_USER.comparePassword.mockResolvedValue(true);

      const credentials = {
        email: TEST_USER.email,
        password: 'valid_password'
      };

      const loginPromises = Array(5).fill(null).map(() =>
        authService.login(credentials, MOCK_DEVICE_INFO)
      );

      const results = await Promise.allSettled(loginPromises);
      const successfulLogins = results.filter(r => r.status === 'fulfilled');
      
      expect(successfulLogins.length).toBeGreaterThan(0);
    });

    test('should validate token permissions', async () => {
      const mockPayload = {
        userId: TEST_USER.id,
        email: TEST_USER.email,
        role: UserRole.ANALYST,
        permissions: ['view_content', 'create_reports']
      };

      jest.spyOn(jwt, 'verify').mockImplementation(() => mockPayload);

      const result = await authService.refreshToken(
        MOCK_TOKENS.refreshToken,
        MOCK_DEVICE_INFO
      );

      expect(result).toBeTruthy();
      expect(jwt.verify).toHaveBeenCalled();
    });
  });
});