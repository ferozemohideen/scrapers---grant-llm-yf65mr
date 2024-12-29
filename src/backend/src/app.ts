/**
 * @fileoverview Main Express application configuration implementing a production-ready API Gateway
 * with comprehensive security, monitoring, performance optimization, and error handling capabilities.
 * @version 1.0.0
 */

import express, { Express, Request, Response, NextFunction } from 'express'; // ^4.18.0
import cors from 'cors'; // ^2.8.5
import helmet from 'helmet'; // ^5.0.0
import compression from 'compression'; // ^1.7.4
import morgan from 'morgan'; // ^1.10.0
import { register } from 'prom-client'; // ^14.0.0
import expressRedisCache from 'express-redis-cache'; // ^1.1.3

import router from './api/routes';
import { 
  authenticate, 
  errorMiddleware, 
  createRateLimiter, 
  validateRequest 
} from './api/middleware';
import config from './config';

// Initialize Express application
const app: Express = express();

/**
 * Configures and applies all middleware to the Express application
 * @param app Express application instance
 */
function configureMiddleware(app: Express): void {
  // Security middleware
  app.use(helmet({
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

  // CORS configuration
  app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Response compression
  app.use(compression({
    threshold: 1024, // Only compress responses larger than 1KB
    level: 6 // Balanced compression level
  }));

  // Request logging
  app.use(morgan('combined', {
    skip: (req) => req.path === '/health' || req.path === '/metrics'
  }));

  // Prometheus metrics collection
  const metrics = register.metrics();
  app.get('/metrics', async (req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.send(await metrics);
  });

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Rate limiting
  const rateLimiter = createRateLimiter({
    windowMs: 60000, // 1 minute
    maxRequests: 1000, // 1000 requests per minute per IP
    keyPrefix: 'ratelimit:',
    skipFailedRequests: true,
    enableMonitoring: true
  });
  app.use(rateLimiter);

  // Redis caching
  const cache = expressRedisCache({
    host: config.database.redis.host,
    port: config.database.redis.port,
    auth_pass: config.database.redis.password,
    expire: 3600 // 1 hour cache
  });

  // Request correlation ID
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.correlationId = req.headers['x-correlation-id'] as string || 
                       crypto.randomUUID();
    res.setHeader('X-Correlation-ID', req.correlationId);
    next();
  });

  // Request timing
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startTime = process.hrtime();
    res.on('finish', () => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const duration = seconds * 1000 + nanoseconds / 1000000;
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
}

/**
 * Configures all API routes and monitoring endpoints
 * @param app Express application instance
 */
function configureRoutes(app: Express): void {
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0'
    });
  });

  // Mount main API router
  app.use('/api', router);

  // Error handling middleware
  app.use(errorMiddleware);

  // 404 handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      status: 'error',
      message: 'Resource not found',
      path: req.path
    });
  });
}

// Configure application
configureMiddleware(app);
configureRoutes(app);

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Starting graceful shutdown...');
  // Close server and database connections
  process.exit(0);
});

export default app;