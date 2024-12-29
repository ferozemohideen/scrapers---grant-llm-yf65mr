/**
 * @fileoverview Technology transfer opportunity routes with comprehensive security,
 * validation, and monitoring capabilities. Implements sub-2 second response time requirement.
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.17.1
import { container } from 'tsyringe'; // ^4.7.0
import { expressPinoLogger } from 'express-pino-logger'; // ^7.0.0
import { rateLimit } from 'express-rate-limit'; // ^6.0.0

import { TechnologyController } from '../controllers/technology.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest, validatePagination } from '../middleware/validation.middleware';
import { UserRole } from '../../interfaces/auth.interface';

/**
 * Configures and returns an Express router with technology-related endpoints
 * Implements role-based access control and request validation
 */
export default function configureRoutes(): Router {
  const router = Router();
  const technologyController = container.resolve(TechnologyController);

  // Request logging middleware
  router.use(expressPinoLogger({
    redact: ['req.headers.authorization'],
    serializers: {
      req: (req) => ({
        method: req.method,
        url: req.url,
        params: req.params,
        query: req.query
      })
    }
  }));

  // Configure rate limiting per role
  const rateLimiters = {
    [UserRole.API_USER]: rateLimit({
      windowMs: 60 * 1000, // 1 minute
      max: 30, // 30 requests per minute
      message: 'Too many requests from this API user'
    }),
    [UserRole.ANALYST]: rateLimit({
      windowMs: 60 * 1000,
      max: 60,
      message: 'Too many requests from this analyst'
    }),
    [UserRole.MANAGER]: rateLimit({
      windowMs: 60 * 1000,
      max: 100,
      message: 'Too many requests from this manager'
    }),
    [UserRole.ADMIN]: rateLimit({
      windowMs: 60 * 1000,
      max: 200,
      message: 'Too many requests from this admin'
    })
  };

  // Search endpoint with pagination and filtering
  router.get('/search',
    authenticate,
    authorize([UserRole.ANALYST, UserRole.MANAGER, UserRole.ADMIN]),
    validatePagination,
    validateRequest(),
    rateLimiters[UserRole.ANALYST],
    async (req, res, next) => {
      try {
        const response = await technologyController.searchTechnologies(req, res);
        return response;
      } catch (error) {
        next(error);
      }
    }
  );

  // Get single technology by ID
  router.get('/:id',
    authenticate,
    authorize([UserRole.ANALYST, UserRole.MANAGER, UserRole.ADMIN]),
    validateRequest(),
    rateLimiters[UserRole.ANALYST],
    async (req, res, next) => {
      try {
        const response = await technologyController.getTechnology(req, res);
        return response;
      } catch (error) {
        next(error);
      }
    }
  );

  // Update technology
  router.put('/:id',
    authenticate,
    authorize([UserRole.MANAGER, UserRole.ADMIN]),
    validateRequest(),
    rateLimiters[UserRole.MANAGER],
    async (req, res, next) => {
      try {
        const response = await technologyController.updateTechnology(req, res);
        return response;
      } catch (error) {
        next(error);
      }
    }
  );

  // Delete technology
  router.delete('/:id',
    authenticate,
    authorize([UserRole.ADMIN]),
    validateRequest(),
    rateLimiters[UserRole.ADMIN],
    async (req, res, next) => {
      try {
        const response = await technologyController.deleteTechnology(req, res);
        return response;
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}