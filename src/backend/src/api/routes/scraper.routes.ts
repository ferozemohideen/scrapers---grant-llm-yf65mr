/**
 * @fileoverview Express router configuration for web scraping endpoints with comprehensive
 * security, monitoring, and validation features for managing scraping jobs across 375+ data sources.
 * @version 1.0.0
 */

import { Router } from 'express'; // v4.18.0
import helmet from 'helmet'; // v5.0.0
import cors from 'cors'; // v2.8.5
import { ScraperController } from '../controllers/scraper.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { createRateLimiter } from '../middleware/rateLimiter.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { UserRole } from '../../interfaces/auth.interface';

// Global constants
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 1000;
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_REQUEST_SIZE = '1mb';
const CORS_ALLOWED_ORIGINS = ["https://api.example.com", "https://admin.example.com"];

/**
 * Initializes and configures scraper routes with comprehensive security features
 * @param controller ScraperController instance
 * @returns Configured Express router
 */
const initializeScraperRoutes = (controller: ScraperController): Router => {
    const router = Router();

    // Apply security middleware
    router.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "https:"],
                connectSrc: ["'self'"]
            }
        },
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    }));

    // Configure CORS
    router.use(cors({
        origin: CORS_ALLOWED_ORIGINS,
        methods: ['GET', 'POST', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
        maxAge: 86400 // 24 hours
    }));

    // Apply rate limiting
    const rateLimiter = createRateLimiter({
        windowMs: RATE_LIMIT_WINDOW,
        maxRequests: RATE_LIMIT_MAX_REQUESTS,
        keyPrefix: 'scraper:ratelimit:',
        enableMonitoring: true,
        skipFailedRequests: true
    });

    // Validation schemas
    const scraperJobSchema = {
        type: 'object',
        properties: {
            url: { type: 'string', required: true },
            institution: { type: 'object', required: true },
            scraperConfig: { type: 'object', required: true },
            rateLimitConfig: { type: 'object', required: true }
        }
    };

    const paginationSchema = {
        type: 'object',
        properties: {
            page: { type: 'number', minimum: 1 },
            limit: { type: 'number', minimum: 1, maximum: 100 }
        }
    };

    // Health check endpoint
    router.get('/health', (req, res) => {
        res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
    });

    // Scraping job endpoints with authentication and authorization
    router.post('/jobs',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER]),
        validateRequest(scraperJobSchema),
        rateLimiter,
        controller.scheduleJob
    );

    router.get('/jobs/:jobId',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.ANALYST]),
        rateLimiter,
        controller.getJobStatus
    );

    router.delete('/jobs/:jobId',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER]),
        rateLimiter,
        controller.cancelJob
    );

    router.get('/jobs/:jobId/results',
        authenticate,
        authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.ANALYST]),
        validateRequest(paginationSchema),
        rateLimiter,
        controller.getJobResults
    );

    // Metrics endpoint (admin only)
    router.get('/metrics',
        authenticate,
        authorize([UserRole.ADMIN]),
        rateLimiter,
        controller.getMetrics
    );

    // Error handling middleware
    router.use((err: any, req: any, res: any, next: any) => {
        console.error('Scraper Route Error:', err);
        res.status(err.statusCode || 500).json({
            error: {
                message: err.message || 'Internal server error',
                code: err.statusCode || 500,
                correlationId: req.correlationId
            }
        });
    });

    return router;
};

export default initializeScraperRoutes;