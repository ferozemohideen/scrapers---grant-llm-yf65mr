/**
 * @fileoverview Entry point for the storage module that exports the S3 storage service implementation
 * for managing file operations in the technology transfer system. Provides a unified interface for 
 * file storage operations with support for versioning, lifecycle policies, and CDN integration.
 * @version 1.0.0
 */

import { S3StorageService } from './s3.service';

/**
 * Re-export the S3StorageService as the default storage implementation
 * This service provides enterprise-grade file storage capabilities including:
 * - Versioning support
 * - Server-side encryption
 * - Lifecycle management
 * - CDN integration
 * - Multipart upload support
 * - Pre-signed URL generation
 */
export {
  S3StorageService
};

// Export type definitions from the S3StorageService for external use
export type {
  UploadOptions,
  MultipartUploadOptions
} from './s3.service';

/**
 * Default export of the S3StorageService for convenient importing
 * Usage:
 * import StorageService from '@lib/storage';
 * const storageService = new StorageService(config);
 */
export default S3StorageService;

/**
 * Constants for storage configuration
 * These values align with the technical specifications for file storage
 */
export const STORAGE_CONSTANTS = {
  /**
   * Default time-to-live for signed URLs in seconds
   */
  DEFAULT_SIGNED_URL_EXPIRY: 3600,

  /**
   * Storage classes available for file storage
   */
  STORAGE_CLASSES: {
    STANDARD: 'STANDARD',
    INTELLIGENT_TIERING: 'INTELLIGENT_TIERING',
    STANDARD_IA: 'STANDARD_IA',
    ONEZONE_IA: 'ONEZONE_IA',
    GLACIER: 'GLACIER',
    DEEP_ARCHIVE: 'DEEP_ARCHIVE'
  },

  /**
   * Default lifecycle rules for technology transfer files
   */
  LIFECYCLE_RULES: {
    /**
     * Archive files after 90 days to optimize storage costs
     */
    ARCHIVE_AFTER_DAYS: 90,
    
    /**
     * Delete expired or temporary files after 365 days
     */
    DELETE_AFTER_DAYS: 365
  },

  /**
   * Multipart upload configuration
   */
  MULTIPART_UPLOAD: {
    /**
     * Minimum size in bytes for multipart upload (5MB)
     */
    MIN_PART_SIZE: 5 * 1024 * 1024,
    
    /**
     * Default number of concurrent upload parts
     */
    DEFAULT_CONCURRENCY: 4
  }
} as const;

/**
 * Error messages for storage operations
 */
export const STORAGE_ERRORS = {
  INITIALIZATION_FAILED: 'Failed to initialize storage service',
  UPLOAD_FAILED: 'Failed to upload file',
  DOWNLOAD_FAILED: 'Failed to download file',
  DELETE_FAILED: 'Failed to delete file',
  INVALID_CONFIG: 'Invalid storage configuration provided',
  LIFECYCLE_CONFIG_FAILED: 'Failed to configure lifecycle rules',
  ENCRYPTION_CONFIG_FAILED: 'Failed to configure encryption',
  INVALID_FILE: 'Invalid file or file format'
} as const;

// Freeze constants to prevent modification
Object.freeze(STORAGE_CONSTANTS);
Object.freeze(STORAGE_ERRORS);