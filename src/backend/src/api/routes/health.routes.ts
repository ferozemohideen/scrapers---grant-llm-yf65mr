/**
 * @fileoverview Express router configuration for system health monitoring endpoints
 * Implements comprehensive health checks with Prometheus metrics integration
 * @version 1.0.0
 */

import express from 'express'; // ^4.18.0
import prometheusMiddleware from 'express-prometheus-middleware'; // ^1.2.0
import { withCorrelationId } from 'correlation-id'; // ^4.0.0
import rateLimit from 'express-rate-limit'; // ^6.0.0

import { HealthController } from '../controllers/health.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '../../interfaces/auth.interface';

// Initialize router
const router = express.Router();

// Initialize health controller
const healthController = HealthController.getInstance();

// Configure rate limiters
const basicHealthRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  message: 'Too many health check requests, please try again later'
});

const detailedHealthRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // 50 requests per 5 minutes
  standardHeaders: true,
  message: 'Too many detailed health check requests, please try again later'
});

// Configure Prometheus metrics middleware
const metricsMiddleware = prometheusMiddleware({
  metricsPath: '/metrics',
  collectDefaultMetrics: true,
  requestDurationBuckets: [0.1, 0.5, 1, 1.5, 2, 3, 5],
  requestLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400],
  responseLengthBuckets: [512, 1024, 5120, 10240, 51200, 102400]
});

/**
 * Initialize health monitoring routes with security and monitoring
 */
const initializeRoutes = (): express.Router => {
  // Add correlation ID middleware for request tracking
  router.use(withCorrelationId());

  // Add Prometheus metrics middleware
  router.use(metricsMiddleware);

  /**
   * @route GET /health
   * @description Basic health check endpoint with uptime metrics
   * @access Public
   */
  router.get(
    '/',
    basicHealthRateLimit,
    async (req, res, next) => {
      try {
        await healthController.checkHealth(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * @route GET /health/status
   * @description Detailed system status with comprehensive metrics
   * @access Protected - Requires authentication and ADMIN/MANAGER role
   */
  router.get(
    '/status',
    detailedHealthRateLimit,
    authenticate,
    authorize([UserRole.ADMIN, UserRole.MANAGER]),
    validateRequest({
      type: 'object',
      properties: {
        includeMetrics: { type: 'boolean' }
      }
    }),
    async (req, res, next) => {
      try {
        await healthController.getDetailedStatus(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * @route GET /health/component/:componentName
   * @description Component-specific health status with detailed metrics
   * @access Protected - Requires authentication and ADMIN role
   */
  router.get(
    '/component/:componentName',
    detailedHealthRateLimit,
    authenticate,
    authorize([UserRole.ADMIN]),
    validateRequest({
      type: 'object',
      properties: {
        componentName: {
          type: 'string',
          pattern: /^[a-zA-Z0-9_-]+$/
        }
      }
    }),
    async (req, res, next) => {
      try {
        await healthController.getComponentHealth(req, res);
      } catch (error) {
        next(error);
      }
    }
  );

  /**
   * @route GET /health/metrics
   * @description Prometheus metrics endpoint
   * @access Protected - Requires authentication and ADMIN role
   */
  router.get(
    '/metrics',
    authenticate,
    authorize([UserRole.ADMIN]),
    (req, res) => {
      res.set('Content-Type', register.contentType);
      res.end(register.metrics());
    }
  );

  return router;
};

// Export configured router
export default {
  initializeRoutes
};