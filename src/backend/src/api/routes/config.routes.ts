/**
 * @fileoverview Configuration routes implementing secure endpoints for managing application settings
 * with comprehensive validation, authorization, and audit logging.
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.0
import rateLimit from 'express-rate-limit'; // v6.0.0
import helmet from 'helmet'; // v5.0.0
import { ConfigController } from '../controllers/config.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { logger } from '../../utils/logger.util';

// Rate limiting configuration for config endpoints
const configRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: 'Too many configuration requests, please try again later'
});

// Validation schemas for configuration endpoints
const scraperConfigSchema = {
  type: 'object',
  required: true,
  properties: {
    engines: {
      type: 'object',
      required: true
    },
    rateLimits: {
      type: 'object',
      required: true
    },
    retryStrategy: {
      type: 'object',
      required: true
    }
  }
};

const databaseConfigSchema = {
  type: 'object',
  required: true,
  properties: {
    host: {
      type: 'string',
      required: true
    },
    port: {
      type: 'number',
      required: true
    },
    database: {
      type: 'string',
      required: true
    }
  }
};

const authConfigSchema = {
  type: 'object',
  required: true,
  properties: {
    jwt: {
      type: 'object',
      required: true
    },
    session: {
      type: 'object',
      required: true
    },
    security: {
      type: 'object',
      required: true
    }
  }
};

/**
 * Configures and returns Express router with secure configuration endpoints
 * @returns Configured Express router instance
 */
export function configureRoutes(): Router {
  const router = Router();
  const configController = new ConfigController();

  // Apply security middleware
  router.use(helmet());
  router.use(configRateLimiter);

  // Scraper configuration endpoints
  router.get(
    '/scraper',
    authenticate,
    authorize(['ADMIN', 'MANAGER']),
    async (req, res, next) => {
      try {
        logger.info('Retrieving scraper configuration', { 
          userId: req.user?.id,
          method: 'GET'
        });
        const config = await configController.getScraperConfig(
          req.query.environment as string
        );
        res.json(config);
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/scraper',
    authenticate,
    authorize(['ADMIN']),
    validateRequest(scraperConfigSchema),
    async (req, res, next) => {
      try {
        logger.info('Updating scraper configuration', {
          userId: req.user?.id,
          method: 'PUT'
        });
        const result = await configController.updateScraperConfig(
          req.body,
          req.query.environment as string
        );
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Database configuration endpoints
  router.get(
    '/database',
    authenticate,
    authorize(['ADMIN']),
    async (req, res, next) => {
      try {
        logger.info('Retrieving database configuration', {
          userId: req.user?.id,
          method: 'GET'
        });
        const config = await configController.getDatabaseConfig(
          req.query.environment as string
        );
        res.json(config);
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/database',
    authenticate,
    authorize(['ADMIN']),
    validateRequest(databaseConfigSchema),
    async (req, res, next) => {
      try {
        logger.info('Updating database configuration', {
          userId: req.user?.id,
          method: 'PUT'
        });
        const result = await configController.updateDatabaseConfig(
          req.body,
          req.query.environment as string
        );
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Authentication configuration endpoints
  router.get(
    '/auth',
    authenticate,
    authorize(['ADMIN']),
    async (req, res, next) => {
      try {
        logger.info('Retrieving auth configuration', {
          userId: req.user?.id,
          method: 'GET'
        });
        const config = await configController.getAuthConfig(
          req.query.environment as string
        );
        res.json(config);
      } catch (error) {
        next(error);
      }
    }
  );

  router.put(
    '/auth',
    authenticate,
    authorize(['ADMIN']),
    validateRequest(authConfigSchema),
    async (req, res, next) => {
      try {
        logger.info('Updating auth configuration', {
          userId: req.user?.id,
          method: 'PUT'
        });
        const result = await configController.updateAuthConfig(
          req.body,
          req.query.environment as string
        );
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Configuration backup endpoints
  router.post(
    '/backup',
    authenticate,
    authorize(['ADMIN']),
    async (req, res, next) => {
      try {
        logger.info('Creating configuration backup', {
          userId: req.user?.id,
          method: 'POST'
        });
        const result = await configController.backupConfig(
          req.query.environment as string
        );
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    '/restore',
    authenticate,
    authorize(['ADMIN']),
    async (req, res, next) => {
      try {
        logger.info('Restoring configuration from backup', {
          userId: req.user?.id,
          method: 'POST',
          backupId: req.body.backupId
        });
        const result = await configController.restoreConfig(
          req.body.backupId,
          req.query.environment as string
        );
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  // Configuration version endpoint
  router.get(
    '/version',
    authenticate,
    authorize(['ADMIN']),
    async (req, res, next) => {
      try {
        logger.info('Retrieving configuration version', {
          userId: req.user?.id,
          method: 'GET'
        });
        const version = await configController.getConfigVersion(
          req.query.environment as string
        );
        res.json({ version });
      } catch (error) {
        next(error);
      }
    }
  );

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({ status: 'healthy' });
  });

  return router;
}

export default configureRoutes();