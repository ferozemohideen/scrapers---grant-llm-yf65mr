/**
 * @fileoverview Central routing configuration file that aggregates and exports all API routes
 * with comprehensive security, monitoring, and performance optimizations.
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.0
import compression from 'compression'; // v1.7.4
import helmet from 'helmet'; // v7.0.0
import rateLimit from 'express-rate-limit'; // v6.7.0
import circuitBreaker from 'opossum'; // v7.1.0

import { authRouter } from './auth.routes';
import { configRouter } from './config.routes';
import { grantRouter } from './grant.routes';
import { searchRouter } from './search.routes';
import { errorHandler } from '../middleware/error.middleware';

// Rate limiting window and request limits
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 1000;

/**
 * Configures and returns the main Express router with comprehensive middleware stack
 * and mounted sub-routes
 */
function configureRoutes(): Router {
  const mainRouter = Router();

  // Apply compression middleware with threshold
  mainRouter.use(compression({
    threshold: 1024, // Only compress responses larger than 1KB
    level: 6 // Balanced compression level
  }));

  // Configure security headers using helmet
  mainRouter.use(helmet({
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
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    referrerPolicy: { policy: 'same-origin' }
  }));

  // Configure rate limiting per route type
  const apiLimiter = rateLimit({
    windowMs: RATE_LIMIT_WINDOW,
    max: MAX_REQUESTS_PER_WINDOW,
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again later'
  });

  // Apply rate limiting to all routes
  mainRouter.use(apiLimiter);

  // Initialize circuit breakers for downstream services
  const breaker = new circuitBreaker(Promise.resolve(), {
    timeout: 3000, // 3 second timeout
    errorThresholdPercentage: 50,
    resetTimeout: 30000
  });

  // Configure request correlation ID generation
  mainRouter.use((req, res, next) => {
    req.correlationId = req.headers['x-correlation-id'] as string || 
                       crypto.randomUUID();
    res.setHeader('X-Correlation-ID', req.correlationId);
    next();
  });

  // Setup metrics collection middleware
  mainRouter.use((req, res, next) => {
    const startTime = process.hrtime();
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;
      
      // Log request metrics
      console.log({
        method: req.method,
        path: req.path,
        status: res.statusCode,
        duration,
        correlationId: req.correlationId
      });
    });
    next();
  });

  // Mount authentication routes
  mainRouter.use('/auth', authRouter);

  // Mount configuration routes
  mainRouter.use('/config', configRouter);

  // Mount grant management routes
  mainRouter.use('/grants', grantRouter);

  // Mount search routes
  mainRouter.use('/search', searchRouter);

  // Health check endpoint
  mainRouter.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0'
    });
  });

  // Apply error handling middleware last
  mainRouter.use(errorHandler);

  return mainRouter;
}

// Export configured router
export default configureRoutes();