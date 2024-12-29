/**
 * @fileoverview Authentication Controller implementing secure login, logout, and token refresh
 * with comprehensive security controls and monitoring
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.0
import asyncHandler from 'express-async-handler'; // v1.2.0
import rateLimit from 'express-rate-limit'; // v6.0.0
import helmet from 'helmet'; // v5.0.0
import { validateRequest } from 'express-validator'; // v6.14.0
import { AuthService } from '../../services/auth.service';
import { IUserCredentials } from '../../interfaces/auth.interface';
import { createError } from '../../utils/error.util';
import { ERROR_TYPES } from '../../constants/error.constants';
import { API_VALIDATION_RULES } from '../../constants/validation.constants';

/**
 * Authentication controller implementing secure endpoints with monitoring
 */
export class AuthController {
    private readonly authService: AuthService;
    private readonly rateLimiter: any;

    constructor() {
        this.authService = AuthService.getInstance();
        
        // Configure rate limiting for auth endpoints
        this.rateLimiter = rateLimit({
            windowMs: API_VALIDATION_RULES.RATE_LIMITING.window,
            max: API_VALIDATION_RULES.RATE_LIMITING.maxRequests.anonymous,
            message: 'Too many authentication attempts, please try again later',
            standardHeaders: true,
            legacyHeaders: false
        });
    }

    /**
     * Handles user login with enhanced security
     * @param req Express request
     * @param res Express response
     * @param next Next function
     */
    public login = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            // Validate request body
            const credentials: IUserCredentials = {
                email: req.body.email,
                password: req.body.password
            };

            // Get device info for security tracking
            const deviceInfo = {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] || 'unknown',
                deviceId: req.headers['x-device-id'] as string
            };

            // Attempt login
            const authTokens = await this.authService.login(credentials, deviceInfo);

            // Set secure cookie with refresh token
            res.cookie('refreshToken', authTokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            // Return access token and metadata
            res.status(200).json({
                status: 'success',
                data: {
                    accessToken: authTokens.accessToken,
                    expiresIn: authTokens.expiresIn,
                    tokenType: authTokens.tokenType
                }
            });
        } catch (error) {
            next(createError(
                ERROR_TYPES.AUTHENTICATION_ERROR,
                error.message,
                { email: req.body.email },
                { ip: req.ip }
            ));
        }
    });

    /**
     * Handles user logout with session cleanup
     * @param req Express request
     * @param res Express response
     * @param next Next function
     */
    public logout = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user?.id;
            const deviceId = req.headers['x-device-id'] as string;

            if (!userId) {
                throw new Error('User not authenticated');
            }

            // Perform logout
            await this.authService.logout(userId, deviceId);

            // Clear auth cookies
            res.clearCookie('refreshToken', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict'
            });

            res.status(204).end();
        } catch (error) {
            next(createError(
                ERROR_TYPES.AUTHENTICATION_ERROR,
                error.message,
                { userId: req.user?.id },
                { ip: req.ip }
            ));
        }
    });

    /**
     * Handles token refresh with security validation
     * @param req Express request
     * @param res Express response
     * @param next Next function
     */
    public refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                throw new Error('Refresh token not provided');
            }

            const deviceInfo = {
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'] || 'unknown',
                deviceId: req.headers['x-device-id'] as string
            };

            // Attempt token refresh
            const newTokens = await this.authService.refreshToken(refreshToken, deviceInfo);

            // Update refresh token cookie
            res.cookie('refreshToken', newTokens.refreshToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
            });

            // Return new access token
            res.status(200).json({
                status: 'success',
                data: {
                    accessToken: newTokens.accessToken,
                    expiresIn: newTokens.expiresIn,
                    tokenType: newTokens.tokenType
                }
            });
        } catch (error) {
            next(createError(
                ERROR_TYPES.AUTHENTICATION_ERROR,
                error.message,
                { tokenPresent: !!req.cookies.refreshToken },
                { ip: req.ip }
            ));
        }
    });
}

// Export singleton instance
export const authController = new AuthController();