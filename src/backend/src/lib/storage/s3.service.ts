/**
 * @fileoverview Enterprise-grade AWS S3 storage service implementation with advanced features
 * including versioning, CDN integration, encryption, and lifecycle management.
 * @version 1.0.0
 */

import { injectable } from 'inversify';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutBucketLifecycleConfigurationCommand,
  PutBucketEncryptionCommand,
  S3ServiceException,
  StorageClass,
  ServerSideEncryption,
  LifecycleRule
} from '@aws-sdk/client-s3'; // ^3.0.0
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'; // ^3.0.0
import { CloudFrontClient, CreateInvalidationCommand } from '@aws-sdk/client-cloudfront'; // ^3.0.0
import { DatabaseConfig } from '../../interfaces/config.interface';
import { Readable } from 'stream';

/**
 * Interface for file upload options
 */
interface UploadOptions {
  metadata?: Record<string, string>;
  tags?: Record<string, string>;
  storageClass?: StorageClass;
  encryption?: {
    algorithm: ServerSideEncryption;
    keyId?: string;
  };
}

/**
 * Interface for multipart upload options
 */
interface MultipartUploadOptions extends UploadOptions {
  partSize: number;
  concurrency: number;
}

/**
 * Enterprise-grade S3 storage service with advanced features
 */
@injectable()
export class S3StorageService {
  private readonly s3Client: S3Client;
  private readonly cloudFrontClient: CloudFrontClient;
  private readonly bucketName: string;
  private readonly region: string;
  private readonly distributionId: string;
  private readonly encryptionKeyId: string;

  /**
   * Initialize S3 storage service with configuration
   */
  constructor(config: DatabaseConfig) {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucketName = process.env.S3_BUCKET_NAME || '';
    this.distributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID || '';
    this.encryptionKeyId = process.env.KMS_KEY_ID || '';

    // Initialize S3 client with configuration
    this.s3Client = new S3Client({
      region: this.region,
      maxAttempts: config.maxConnections,
      retryMode: 'adaptive'
    });

    // Initialize CloudFront client
    this.cloudFrontClient = new CloudFrontClient({
      region: this.region
    });

    // Initialize bucket configuration
    this.initializeBucket().catch(error => {
      console.error('Failed to initialize S3 bucket:', error);
      throw error;
    });
  }

  /**
   * Upload file to S3 with versioning and encryption
   */
  async uploadFile(
    key: string,
    file: Buffer | Readable,
    options: UploadOptions = {}
  ): Promise<{ url: string; versionId: string }> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        Metadata: options.metadata,
        Tagging: this.formatTags(options.tags),
        StorageClass: options.storageClass || StorageClass.STANDARD,
        ServerSideEncryption: options.encryption?.algorithm || ServerSideEncryption.aws_kms,
        SSEKMSKeyId: options.encryption?.keyId || this.encryptionKeyId
      });

      const response = await this.s3Client.send(command);

      // Invalidate CloudFront cache if CDN is configured
      if (this.distributionId) {
        await this.invalidateCache([key]);
      }

      const cdnUrl = this.distributionId
        ? `https://${this.distributionId}.cloudfront.net/${key}`
        : `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${key}`;

      return {
        url: cdnUrl,
        versionId: response.VersionId || ''
      };
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw this.handleS3Error(error as S3ServiceException);
    }
  }

  /**
   * Upload large file using multipart upload
   */
  async uploadLargeFile(
    key: string,
    fileStream: Readable,
    options: MultipartUploadOptions
  ): Promise<{ url: string; versionId: string }> {
    try {
      // Implementation of multipart upload logic would go here
      // This is a placeholder for the complex multipart upload implementation
      // that would handle chunking and parallel uploads
      throw new Error('Multipart upload not implemented');
    } catch (error) {
      console.error('Failed to upload large file:', error);
      throw this.handleS3Error(error as S3ServiceException);
    }
  }

  /**
   * Configure bucket lifecycle policies
   */
  async configureLifecycle(rules: LifecycleRule[]): Promise<void> {
    try {
      const command = new PutBucketLifecycleConfigurationCommand({
        Bucket: this.bucketName,
        LifecycleConfiguration: {
          Rules: rules
        }
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Failed to configure lifecycle rules:', error);
      throw this.handleS3Error(error as S3ServiceException);
    }
  }

  /**
   * Configure server-side encryption
   */
  async configureEncryption(
    algorithm: ServerSideEncryption = ServerSideEncryption.aws_kms,
    keyId: string = this.encryptionKeyId
  ): Promise<void> {
    try {
      const command = new PutBucketEncryptionCommand({
        Bucket: this.bucketName,
        ServerSideEncryptionConfiguration: {
          Rules: [
            {
              ApplyServerSideEncryptionByDefault: {
                SSEAlgorithm: algorithm,
                KMSMasterKeyID: keyId
              }
            }
          ]
        }
      });

      await this.s3Client.send(command);
    } catch (error) {
      console.error('Failed to configure encryption:', error);
      throw this.handleS3Error(error as S3ServiceException);
    }
  }

  /**
   * Generate pre-signed URL for temporary access
   */
  async generateSignedUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key
      });

      return await getSignedUrl(this.s3Client, command, { expiresIn });
    } catch (error) {
      console.error('Failed to generate signed URL:', error);
      throw this.handleS3Error(error as S3ServiceException);
    }
  }

  /**
   * Initialize bucket configuration
   */
  private async initializeBucket(): Promise<void> {
    // Configure default encryption
    await this.configureEncryption();

    // Configure lifecycle rules
    await this.configureLifecycle([
      {
        ID: 'archive-rule',
        Status: 'Enabled',
        Transitions: [
          {
            Days: 90,
            StorageClass: StorageClass.INTELLIGENT_TIERING
          }
        ]
      }
    ]);
  }

  /**
   * Invalidate CloudFront cache
   */
  private async invalidateCache(paths: string[]): Promise<void> {
    if (!this.distributionId) return;

    try {
      const command = new CreateInvalidationCommand({
        DistributionId: this.distributionId,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: {
            Quantity: paths.length,
            Items: paths.map(path => `/${path}`)
          }
        }
      });

      await this.cloudFrontClient.send(command);
    } catch (error) {
      console.error('Failed to invalidate CloudFront cache:', error);
      // Don't throw error for cache invalidation failures
    }
  }

  /**
   * Format tags for S3 API
   */
  private formatTags(tags?: Record<string, string>): string | undefined {
    if (!tags) return undefined;
    return Object.entries(tags)
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  /**
   * Handle S3 service exceptions
   */
  private handleS3Error(error: S3ServiceException): Error {
    // Add custom error handling logic here
    return error;
  }
}