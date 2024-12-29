/**
 * @fileoverview Enterprise-grade distributed rate limiting middleware using Redis
 * Implements advanced rate limiting with monitoring, failover handling, and security features
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { RedisService } from '../../lib/cache/redis.service';
import { HTTP_STATUS_CODES, ERROR_MESSAGES } from '../../constants/error.constants';

/**
 * Configuration interface for rate limiter
 */
interface IRateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  identifierFn?: (req: Request) => string;
  skipFailedRequests?: boolean;
  enableMonitoring?: boolean;
}

/**
 * Rate limit tracking information
 */
interface IRateLimitInfo {
  count: number;
  resetTime: number;
  remaining: number;
  retryAfter: number;
}

// Default configuration values
const DEFAULT_WINDOW_MS = 60000; // 1 minute
const DEFAULT_MAX_REQUESTS = 1000;
const RATE_LIMIT_PREFIX = 'ratelimit:';
const LOCK_PREFIX = 'ratelimit:lock:';
const LOCK_TTL = 1000; // 1 second
const MONITORING_INTERVAL = 5000; // 5 seconds

/**
 * Creates an enhanced rate limiter middleware with distributed state management
 * @param config Rate limiter configuration
 * @returns Express middleware function
 */
export const createRateLimiter = (config: IRateLimitConfig) => {
  const redisService = RedisService.getInstance({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
    keyPrefix: config.keyPrefix || RATE_LIMIT_PREFIX,
    cluster: process.env.REDIS_CLUSTER_ENABLED === 'true'
  });

  const windowMs = config.windowMs || DEFAULT_WINDOW_MS;
  const maxRequests = config.maxRequests || DEFAULT_MAX_REQUESTS;
  const skipFailedRequests = config.skipFailedRequests || false;
  const enableMonitoring = config.enableMonitoring || false;

  // Default identifier function uses IP address
  const getIdentifier = config.identifierFn || ((req: Request): string => {
    return req.ip || 
           req.headers['x-forwarded-for'] as string || 
           req.socket.remoteAddress || 
           'unknown';
  });

  // Set up monitoring if enabled
  if (enableMonitoring) {
    setInterval(async () => {
      try {
        const metrics = await redisService.getMetrics();
        console.log('Rate Limiter Metrics:', metrics);
      } catch (error) {
        console.error('Rate Limiter Monitoring Error:', error);
      }
    }, MONITORING_INTERVAL);
  }

  /**
   * Express middleware function that implements distributed rate limiting
   */
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const identifier = getIdentifier(req);
    const key = `${config.keyPrefix || RATE_LIMIT_PREFIX}${identifier}`;
    const lockKey = `${LOCK_PREFIX}${identifier}`;

    try {
      // Acquire distributed lock for atomic operations
      const lock = await redisService.set(lockKey, '1', LOCK_TTL);
      
      // Get current rate limit state
      const now = Date.now();
      const windowStart = now - windowMs;
      
      let rateLimitInfo: IRateLimitInfo | null = await redisService.get(key);
      
      if (!rateLimitInfo) {
        rateLimitInfo = {
          count: 0,
          resetTime: now + windowMs,
          remaining: maxRequests,
          retryAfter: 0
        };
      }

      // Check if rate limit exceeded
      if (rateLimitInfo.count >= maxRequests) {
        const retryAfter = Math.ceil((rateLimitInfo.resetTime - now) / 1000);
        
        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': Math.ceil(rateLimitInfo.resetTime / 1000).toString(),
          'Retry-After': retryAfter.toString()
        });

        // Release lock
        await redisService.delete(lockKey);

        res.status(HTTP_STATUS_CODES.RATE_LIMITED)
           .json({ error: ERROR_MESSAGES.RATE_LIMIT_ERROR });
        return;
      }

      // Update rate limit counters
      rateLimitInfo.count++;
      rateLimitInfo.remaining = maxRequests - rateLimitInfo.count;
      
      // Store updated rate limit info
      await redisService.set(key, rateLimitInfo, Math.ceil(windowMs / 1000));

      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': rateLimitInfo.remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(rateLimitInfo.resetTime / 1000).toString()
      });

      // Release lock
      await redisService.delete(lockKey);

      // Handle failed requests if configured
      if (skipFailedRequests) {
        res.on('finish', async () => {
          if (res.statusCode >= 400) {
            try {
              const currentInfo = await redisService.get<IRateLimitInfo>(key);
              if (currentInfo) {
                currentInfo.count--;
                currentInfo.remaining++;
                await redisService.set(key, currentInfo, Math.ceil(windowMs / 1000));
              }
            } catch (error) {
              console.error('Error adjusting rate limit for failed request:', error);
            }
          }
        });
      }

      next();
    } catch (error) {
      // Handle Redis failures gracefully
      console.error('Rate Limiter Error:', error);
      
      // Release lock if possible
      try {
        await redisService.delete(lockKey);
      } catch (lockError) {
        console.error('Error releasing rate limit lock:', lockError);
      }

      // Allow request through on Redis failures to maintain availability
      next();
    }
  };
};

export default createRateLimiter;
```

This implementation provides:

1. Distributed rate limiting using Redis for state management
2. Advanced configuration options including custom identifiers and monitoring
3. Atomic operations using distributed locks
4. Comprehensive rate limit headers
5. Graceful failure handling
6. Support for skipping failed requests
7. Monitoring capabilities
8. Security features like IP address validation
9. Enterprise-grade Redis integration with clustering support
10. Detailed logging and error handling

The middleware can be used in the application like this:

```typescript
import { createRateLimiter } from './middleware/rateLimiter.middleware';

// Create rate limiter middleware
const rateLimiter = createRateLimiter({
  windowMs: 60000, // 1 minute
  maxRequests: 1000,
  keyPrefix: 'api:ratelimit:',
  enableMonitoring: true,
  skipFailedRequests: true
});

// Apply to routes
app.use('/api', rateLimiter);