/**
 * @fileoverview Express router configuration for grant proposal management endpoints
 * Implements secure, scalable, and monitored routes with comprehensive middleware stack
 * @version 1.0.0
 */

import { Router } from 'express'; // ^4.18.0
import compression from 'compression'; // ^1.7.4
import cors from 'cors'; // ^2.8.5
import { GrantController } from '../controllers/grant.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { validateRequest, validatePagination } from '../middleware/validation.middleware';
import { IProposalGeneration, IProposalUpdate, IProposalEnhancement } from '../../interfaces/grant.interface';
import { API_VALIDATION_RULES } from '../../constants/validation.constants';
import { UserRole } from '../../interfaces/auth.interface';

// Validation schemas for request payloads
const PROPOSAL_VALIDATION_SCHEMA = {
  type: 'object',
  required: true,
  properties: {
    userId: { type: 'string', required: true },
    technologyId: { type: 'string', required: true },
    requirements: {
      type: 'object',
      required: true,
      properties: {
        targetLength: { type: 'number', minimum: 1000 },
        focusAreas: { type: 'array', minLength: 1 },
        technicalDepth: { type: 'string' },
        includeSections: { type: 'array', minLength: 1 }
      }
    },
    aiParameters: {
      type: 'object',
      required: true,
      properties: {
        model: { type: 'string' },
        temperature: { type: 'number', minimum: 0, maximum: 1 },
        maxTokens: { type: 'number', minimum: 100 }
      }
    }
  }
};

const UPDATE_VALIDATION_SCHEMA = {
  type: 'object',
  required: true,
  properties: {
    content: { type: 'string', required: true, minLength: 100 },
    status: { type: 'string', required: true },
    versionNote: { type: 'string', required: true }
  }
};

const ENHANCEMENT_VALIDATION_SCHEMA = {
  type: 'object',
  required: true,
  properties: {
    proposalId: { type: 'string', required: true },
    enhancementType: { type: 'string', required: true },
    aiModel: { type: 'string', required: true }
  }
};

/**
 * Configures and returns Express router with grant proposal management routes
 * Implements comprehensive middleware stack for security and performance
 */
export function configureGrantRoutes(): Router {
  const router = Router();
  const grantController = new GrantController();

  // Apply global middleware
  router.use(compression());
  router.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400 // 24 hours
  }));

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Generate new proposal
  router.post('/proposals',
    authenticate,
    authorize([UserRole.ANALYST, UserRole.MANAGER, UserRole.ADMIN]),
    validateRequest(PROPOSAL_VALIDATION_SCHEMA),
    async (req, res, next) => {
      try {
        const proposalData: IProposalGeneration = req.body;
        const proposal = await grantController.generateProposal(proposalData);
        res.status(201).json(proposal);
      } catch (error) {
        next(error);
      }
    }
  );

  // Update existing proposal
  router.put('/proposals/:id',
    authenticate,
    authorize([UserRole.ANALYST, UserRole.MANAGER, UserRole.ADMIN]),
    validateRequest(UPDATE_VALIDATION_SCHEMA),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const updateData: IProposalUpdate = req.body;
        const updated = await grantController.updateProposal(id, updateData);
        res.status(200).json(updated);
      } catch (error) {
        next(error);
      }
    }
  );

  // Enhance proposal with AI suggestions
  router.post('/proposals/:id/enhance',
    authenticate,
    authorize([UserRole.ANALYST, UserRole.MANAGER, UserRole.ADMIN]),
    validateRequest(ENHANCEMENT_VALIDATION_SCHEMA),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const enhancementData: IProposalEnhancement = req.body;
        const enhanced = await grantController.enhanceProposal(id, enhancementData);
        res.status(200).json(enhanced);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get proposal review and feedback
  router.get('/proposals/:id/review',
    authenticate,
    authorize([UserRole.ANALYST, UserRole.MANAGER, UserRole.ADMIN]),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const review = await grantController.reviewProposal(id);
        res.status(200).json(review);
      } catch (error) {
        next(error);
      }
    }
  );

  // Get user's proposals with pagination
  router.get('/proposals/user/:userId',
    authenticate,
    authorize([UserRole.ANALYST, UserRole.MANAGER, UserRole.ADMIN]),
    validatePagination,
    async (req, res, next) => {
      try {
        const { userId } = req.params;
        const { page, limit, status } = req.query;
        const proposals = await grantController.getUserProposals(
          userId,
          Number(page),
          Number(limit),
          status as string
        );
        res.status(200).json(proposals);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}

export default configureGrantRoutes;