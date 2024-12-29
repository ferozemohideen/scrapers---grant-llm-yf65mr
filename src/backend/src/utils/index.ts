/**
 * @fileoverview Central export point for utility functions and classes
 * @version 1.0.0
 * @license MIT
 * 
 * This file implements a barrel pattern to provide a clean, organized way to export
 * all utility functions from the utils directory. It groups related functionality
 * into namespaces for better organization and maintainability.
 */

// Import encryption utilities
import {
  hashPassword,
  verifyPassword,
  encryptData,
  decryptData,
  generateSecureKey
} from './encryption.util';

// Import error handling utilities
import {
  AppError,
  createError,
  handleError,
  isRetryable,
  getRetryDelay
} from './error.util';

// Import logging utility
import { logger } from './logger.util';

// Import validation utilities
import {
  validateURL,
  validateInstitution,
  validateScraperConfig
} from './validation.util';

/**
 * Encryption utilities namespace
 * Provides secure cryptographic operations for data protection
 */
export const encryption = {
  hashPassword,
  verifyPassword,
  encryptData,
  decryptData,
  generateSecureKey
} as const;

/**
 * Error handling utilities namespace
 * Provides standardized error management across the application
 */
export const error = {
  AppError,
  createError,
  handleError,
  isRetryable,
  getRetryDelay
} as const;

/**
 * Validation utilities namespace
 * Provides comprehensive input validation functions
 */
export const validation = {
  validateURL,
  validateInstitution,
  validateScraperConfig
} as const;

/**
 * Direct logger export
 * Provides centralized logging capabilities
 */
export { logger };

// Type definitions for better TypeScript support
export type { ValidationResult, ValidationError, ValidationMetrics } from './validation.util';
export type { EncryptedData } from './encryption.util';

/**
 * Re-export common types and interfaces for convenience
 * This allows consumers to import types directly from the utils index
 */
export type {
  LogMetadata,
  ErrorTracker
} from './logger.util';

// Default export for convenient importing
export default {
  encryption,
  error,
  validation,
  logger
};
```

This implementation follows enterprise-grade best practices and provides:

1. **Organized Namespaces**: Related utilities are grouped into logical namespaces (encryption, error, validation) for better organization and discoverability.

2. **Type Safety**: Comprehensive TypeScript type definitions are exported for better type checking and IDE support.

3. **Documentation**: Detailed JSDoc comments explain the purpose and usage of each export.

4. **Immutability**: Uses `as const` assertions to prevent accidental modifications to exported objects.

5. **Flexible Import Options**: Supports both named imports and default import patterns:
```typescript
// Named imports
import { encryption, error, validation, logger } from '@utils';

// Default import
import utils from '@utils';