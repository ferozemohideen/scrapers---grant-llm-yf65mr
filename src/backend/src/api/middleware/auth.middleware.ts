/**
 * @fileoverview Enhanced authentication middleware implementing comprehensive security measures
 * for API route protection including JWT validation, session verification, and RBAC.
 * @version 1.0.0
 */

import { Request, Response, NextFunction } from 'express'; // v4.18.0
import { RateLimiterMemory } from 'rate-limiter-flexible'; // v2.4.1
import { AuthService } from '../../services/auth.service';
import { IAuthPayload, UserRole, IUserPermissions } from '../../interfaces/auth.interface';
import { createError, ErrorType } from '../../utils/error.util';
import { SecurityLogger } from '../../utils/logger.util';

// Rate limiter configuration for auth requests
const authRateLimiter = new RateLimiterMemory({
  points: 5, // Number of attempts
  duration: 60, // Per 60 seconds
  blockDuration: 300 // Block for 5 minutes
});

/**
 * Enhanced Request interface with user data
 */
interface AuthenticatedRequest extends Request {
  user?: IAuthPayload;
  correlationId?: string;
}

/**
 * Comprehensive authentication middleware with security measures
 * @param req Express request object
 * @param res Express response object
 * @param next Next middleware function
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const correlationId = req.headers['x-correlation-id'] as string || crypto.randomUUID();
  req.correlationId = correlationId;

  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw createError(
        'AUTHENTICATION_ERROR' as ErrorType,
        'Missing or invalid authorization header',
        { correlationId }
      );
    }

    const token = authHeader.split(' ')[1];
    const authService = AuthService.getInstance();

    // Check token blacklist
    const isBlacklisted = await authService.checkTokenBlacklist(token);
    if (isBlacklisted) {
      throw createError(
        'AUTHENTICATION_ERROR' as ErrorType,
        'Token has been revoked',
        { correlationId }
      );
    }

    // Verify token
    const payload = await authService.verifyToken(token);
    if (!payload) {
      throw createError(
        'AUTHENTICATION_ERROR' as ErrorType,
        'Invalid token',
        { correlationId }
      );
    }

    // Validate session
    const isValidSession = await authService.validateSession(
      payload.userId,
      payload.sessionId
    );
    if (!isValidSession) {
      throw createError(
        'AUTHENTICATION_ERROR' as ErrorType,
        'Invalid or expired session',
        { correlationId }
      );
    }

    // Apply rate limiting
    try {
      await authRateLimiter.consume(payload.userId);
    } catch (rateLimitError) {
      throw createError(
        'RATE_LIMIT_ERROR' as ErrorType,
        'Too many authentication attempts',
        { correlationId }
      );
    }

    // Attach user data to request
    req.user = payload;

    // Log successful authentication
    SecurityLogger.logAuthAttempt({
      userId: payload.userId,
      success: true,
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    next();
  } catch (error) {
    // Log failed authentication attempt
    SecurityLogger.logSecurityEvent({
      type: 'AUTH_FAILURE',
      error: error.message,
      correlationId,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || 'unknown'
    });

    next(error);
  }
};

/**
 * Enhanced authorization middleware factory with granular permission checks
 * @param allowedRoles Array of allowed user roles
 * @param requiredPermissions Required permissions for access
 */
export const authorize = (
  allowedRoles: UserRole[] = [],
  requiredPermissions: string[] = []
) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw createError(
          'AUTHORIZATION_ERROR' as ErrorType,
          'User not authenticated',
          { correlationId: req.correlationId }
        );
      }

      // Check user role
      if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
        throw createError(
          'AUTHORIZATION_ERROR' as ErrorType,
          'Insufficient role permissions',
          {
            correlationId: req.correlationId,
            requiredRoles: allowedRoles,
            userRole: user.role
          }
        );
      }

      // Check required permissions
      if (requiredPermissions.length > 0) {
        const hasAllPermissions = requiredPermissions.every(
          permission => user.permissions.includes(permission)
        );

        if (!hasAllPermissions) {
          throw createError(
            'AUTHORIZATION_ERROR' as ErrorType,
            'Insufficient permissions',
            {
              correlationId: req.correlationId,
              requiredPermissions,
              userPermissions: user.permissions
            }
          );
        }
      }

      // Log successful authorization
      SecurityLogger.logAuthAttempt({
        userId: user.userId,
        success: true,
        correlationId: req.correlationId,
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        roles: allowedRoles,
        permissions: requiredPermissions
      });

      next();
    } catch (error) {
      // Log failed authorization attempt
      SecurityLogger.logSecurityEvent({
        type: 'AUTH_FAILURE',
        error: error.message,
        correlationId: req.correlationId,
        ip: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        roles: allowedRoles,
        permissions: requiredPermissions
      });

      next(error);
    }
  };
};
```

This implementation provides a robust authentication and authorization middleware with the following key features:

1. JWT Token Validation:
- Extracts and validates Bearer tokens from Authorization header
- Checks token blacklist for revoked tokens
- Verifies token signature and expiration
- Validates user sessions

2. Rate Limiting:
- Implements per-user rate limiting for authentication attempts
- Configurable limits and block durations
- Protection against brute force attacks

3. Role-Based Access Control:
- Flexible role-based authorization
- Granular permission checking
- Support for multiple roles and permissions

4. Security Logging:
- Comprehensive security event logging
- Correlation ID tracking
- IP and user agent logging
- Success/failure tracking

5. Error Handling:
- Detailed error messages with correlation IDs
- Standardized error responses
- Security-focused error handling

6. Type Safety:
- Full TypeScript support
- Extended Request interface
- Strong typing for all parameters

The middleware can be used in API routes like this:

```typescript
// Protect route with authentication
app.get('/api/protected', authenticate, (req, res) => {
  // Route handler
});

// Protect route with role-based authorization
app.post('/api/admin', 
  authenticate, 
  authorize([UserRole.ADMIN]), 
  (req, res) => {
    // Admin-only route handler
  }
);

// Protect route with specific permissions
app.put('/api/content',
  authenticate,
  authorize([UserRole.MANAGER], ['manage_content']),
  (req, res) => {
    // Content management route handler
  }
);