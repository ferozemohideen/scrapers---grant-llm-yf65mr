/**
 * @fileoverview Enhanced Authentication Service implementing secure user authentication,
 * JWT token management, and session handling with advanced security features
 * @version 1.0.0
 */

import jwt from 'jsonwebtoken'; // v9.0.0
import crypto from 'crypto';
import winston from 'winston'; // v3.8.0
import { User } from '../db/models/user.model';
import { RedisService } from '../lib/cache/redis.service';
import { 
  IUserCredentials, 
  IAuthTokens, 
  IAuthPayload, 
  UserRole,
  TOKEN_TYPE 
} from '../interfaces/auth.interface';

// Security constants
const ACCESS_TOKEN_EXPIRY = 1800; // 30 minutes
const REFRESH_TOKEN_EXPIRY = 604800; // 7 days
const TOKEN_ISSUER = 'tech-transfer-platform';
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 900; // 15 minutes
const RATE_LIMIT_WINDOW = 300; // 5 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Interface for device information used in authentication
 */
interface IDeviceInfo {
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
}

/**
 * Enhanced Authentication Service implementing the Singleton pattern
 * with comprehensive security features
 */
export class AuthService {
  private static instance: AuthService;
  private readonly redisService: RedisService;
  private readonly logger: winston.Logger;
  private readonly rateLimiter: Map<string, { count: number; timestamp: number }>;

  /**
   * Private constructor implementing singleton pattern with enhanced security initialization
   */
  private constructor() {
    this.redisService = RedisService.getInstance({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      ttl: 3600,
      cluster: false
    });

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'security.log' })
      ]
    });

    this.rateLimiter = new Map();
  }

  /**
   * Returns singleton instance of AuthService
   */
  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Enhanced user authentication with comprehensive security features
   * @param credentials User login credentials
   * @param deviceInfo Device information for security tracking
   */
  public async login(
    credentials: IUserCredentials,
    deviceInfo: IDeviceInfo
  ): Promise<IAuthTokens> {
    try {
      // Rate limiting check
      if (!this.checkRateLimit(deviceInfo.ipAddress)) {
        throw new Error('Rate limit exceeded');
      }

      // Find and validate user
      const user = await User.findOne({ email: credentials.email });
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check account lockout
      if (user.failedAttempts >= MAX_LOGIN_ATTEMPTS) {
        const lockoutTime = new Date(user.lastLogin.getTime() + LOCKOUT_DURATION * 1000);
        if (lockoutTime > new Date()) {
          throw new Error('Account is temporarily locked');
        }
      }

      // Verify password with progressive delays
      const delay = Math.min(user.failedAttempts * 1000, 5000);
      await new Promise(resolve => setTimeout(resolve, delay));

      const isValid = await user.comparePassword(credentials.password);
      if (!isValid) {
        await this.handleFailedLogin(user, deviceInfo);
        throw new Error('Invalid credentials');
      }

      // Generate secure tokens
      const accessToken = await this.generateAccessToken(user);
      const refreshToken = await this.generateRefreshToken(user, deviceInfo);

      // Update user security metrics
      user.lastLogin = new Date();
      user.failedAttempts = 0;
      await user.save();

      // Store device fingerprint
      const sessionKey = `session:${user.id}:${deviceInfo.deviceId}`;
      await this.redisService.set(sessionKey, {
        refreshToken,
        deviceInfo,
        lastActivity: new Date()
      }, REFRESH_TOKEN_EXPIRY);

      // Log successful login
      this.logger.info('Successful login', {
        userId: user.id,
        ip: deviceInfo.ipAddress,
        userAgent: deviceInfo.userAgent
      });

      return {
        accessToken,
        refreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRY,
        tokenType: TOKEN_TYPE
      };
    } catch (error) {
      this.logger.error('Login error', {
        error: error.message,
        ip: deviceInfo.ipAddress
      });
      throw error;
    }
  }

  /**
   * Enhanced token refresh with rotation and blacklisting
   * @param refreshToken Current refresh token
   * @param deviceInfo Device information for validation
   */
  public async refreshToken(
    refreshToken: string,
    deviceInfo: IDeviceInfo
  ): Promise<IAuthTokens> {
    try {
      // Verify refresh token
      const payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as IAuthPayload;
      
      // Validate device fingerprint
      const sessionKey = `session:${payload.userId}:${deviceInfo.deviceId}`;
      const session = await this.redisService.get(sessionKey);
      
      if (!session || session.refreshToken !== refreshToken) {
        throw new Error('Invalid refresh token');
      }

      // Check token blacklist
      const isBlacklisted = await this.redisService.get(`blacklist:${refreshToken}`);
      if (isBlacklisted) {
        throw new Error('Token has been revoked');
      }

      // Find user
      const user = await User.findById(payload.userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Generate new tokens
      const newAccessToken = await this.generateAccessToken(user);
      const newRefreshToken = await this.generateRefreshToken(user, deviceInfo);

      // Blacklist old refresh token
      await this.redisService.set(
        `blacklist:${refreshToken}`,
        true,
        REFRESH_TOKEN_EXPIRY
      );

      // Update session
      await this.redisService.set(sessionKey, {
        refreshToken: newRefreshToken,
        deviceInfo,
        lastActivity: new Date()
      }, REFRESH_TOKEN_EXPIRY);

      // Log token rotation
      this.logger.info('Token refreshed', {
        userId: user.id,
        ip: deviceInfo.ipAddress
      });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: ACCESS_TOKEN_EXPIRY,
        tokenType: TOKEN_TYPE
      };
    } catch (error) {
      this.logger.error('Token refresh error', {
        error: error.message,
        ip: deviceInfo.ipAddress
      });
      throw error;
    }
  }

  /**
   * Handles failed login attempts with security measures
   * @param user User document
   * @param deviceInfo Device information
   */
  private async handleFailedLogin(user: any, deviceInfo: IDeviceInfo): Promise<void> {
    user.failedAttempts += 1;
    user.lastLogin = new Date();
    await user.save();

    this.logger.warn('Failed login attempt', {
      userId: user.id,
      attempts: user.failedAttempts,
      ip: deviceInfo.ipAddress
    });
  }

  /**
   * Generates secure access token with user claims
   * @param user User document
   */
  private async generateAccessToken(user: any): Promise<string> {
    const payload: IAuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      permissions: this.getPermissions(user.role),
      sessionId: crypto.randomBytes(16).toString('hex')
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: ACCESS_TOKEN_EXPIRY,
      issuer: TOKEN_ISSUER,
      algorithm: 'HS512'
    });
  }

  /**
   * Generates secure refresh token with rotation support
   * @param user User document
   * @param deviceInfo Device information
   */
  private async generateRefreshToken(
    user: any,
    deviceInfo: IDeviceInfo
  ): Promise<string> {
    const payload: IAuthPayload = {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      permissions: [],
      sessionId: crypto.randomBytes(16).toString('hex')
    };

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: REFRESH_TOKEN_EXPIRY,
      issuer: TOKEN_ISSUER,
      algorithm: 'HS512'
    });
  }

  /**
   * Implements rate limiting for authentication requests
   * @param ipAddress Client IP address
   */
  private checkRateLimit(ipAddress: string): boolean {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW * 1000;
    
    const limit = this.rateLimiter.get(ipAddress);
    if (!limit || limit.timestamp < windowStart) {
      this.rateLimiter.set(ipAddress, { count: 1, timestamp: now });
      return true;
    }

    if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
      return false;
    }

    limit.count += 1;
    return true;
  }

  /**
   * Maps user roles to permissions
   * @param role User role
   */
  private getPermissions(role: UserRole): string[] {
    const permissions: Record<UserRole, string[]> = {
      [UserRole.ADMIN]: ['admin', 'manage_users', 'view_all'],
      [UserRole.MANAGER]: ['manage_content', 'view_all'],
      [UserRole.ANALYST]: ['view_content', 'create_reports'],
      [UserRole.API_USER]: ['api_access']
    };

    return permissions[role] || [];
  }
}