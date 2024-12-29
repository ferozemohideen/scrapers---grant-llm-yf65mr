/**
 * @fileoverview Authentication routes implementing secure JWT-based authentication flow
 * with comprehensive rate limiting, monitoring, and security controls.
 * @version 1.0.0
 */

import express, { Router } from 'express'; // v4.18.0
import cors from 'cors'; // v2.8.5
import helmet from 'helmet'; // v4.6.0
import { AuthController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/rateLimiter.middleware';
import { validateRequest } from '../middleware/validation.middleware';

// Initialize router with security middleware
const authRouter: Router = express.Router();

// Apply security headers
authRouter.use(helmet({
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  referrerPolicy: { policy: 'same-origin' }
}));

// Configure CORS
authRouter.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000',
  methods: ['POST'],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Initialize AuthController
const authController = new AuthController();

// Create rate limiters for different endpoints
const loginRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5, // 5 attempts per window
  keyPrefix: 'login:',
  skipFailedRequests: false,
  enableMonitoring: true
});

const refreshRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 10, // 10 refresh attempts per hour
  keyPrefix: 'refresh:',
  skipFailedRequests: false,
  enableMonitoring: true
});

/**
 * @route POST /auth/login
 * @description Authenticates user credentials and returns JWT tokens
 * @access Public
 */
authRouter.post('/login',
  loginRateLimiter,
  validateRequest({
    type: 'object',
    required: true,
    properties: {
      email: {
        type: 'string',
        required: true,
        pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
      },
      password: {
        type: 'string',
        required: true,
        minLength: 8
      }
    }
  }),
  authController.login
);

/**
 * @route POST /auth/logout
 * @description Securely invalidates user session and blacklists current tokens
 * @access Protected
 */
authRouter.post('/logout',
  authenticate,
  validateRequest({
    type: 'object',
    required: true,
    properties: {
      refreshToken: {
        type: 'string',
        required: true
      }
    }
  }),
  authController.logout
);

/**
 * @route POST /auth/refresh
 * @description Issues new access token using valid refresh token
 * @access Public
 */
authRouter.post('/refresh',
  refreshRateLimiter,
  validateRequest({
    type: 'object',
    required: true,
    properties: {
      refreshToken: {
        type: 'string',
        required: true
      }
    }
  }),
  authController.refreshToken
);

// Export the router
export default authRouter;