/**
 * @fileoverview Mongoose model definition for scraping jobs with comprehensive rate limiting,
 * error tracking, and performance metrics. Supports 375+ institutions with configurable
 * scraping strategies and enhanced error recovery.
 * @version 1.0.0
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import dayjs from 'dayjs';
import {
  ScraperJob,
  ScraperResult,
  ScraperError,
  RateLimitMetrics
} from '../../interfaces/scraper.interface';
import {
  ERROR_TYPES,
  RETRY_CONFIG,
  SCRAPER_RATE_LIMITS
} from '../../constants/scraper.constants';

/**
 * Enum for job status tracking
 */
export enum JOB_STATUS {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying',
  RATE_LIMITED = 'rate_limited'
}

/**
 * Interface for the scrape job document with Mongoose specifics
 */
interface IScrapeJobDocument extends ScraperJob, Document {
  toJSON(): Record<string, any>;
  canRetry(): boolean;
}

/**
 * Schema definition for rate limit metrics tracking
 */
const rateLimitMetricsSchema = new Schema({
  requestCount: { type: Number, default: 0 },
  lastRequestTime: { type: Date },
  cooldownEndTime: { type: Date },
  isRateLimited: { type: Boolean, default: false },
  burstCount: { type: Number, default: 0 },
  throttledRequests: { type: Number, default: 0 },
  queuedRequests: { type: Number, default: 0 }
}, { _id: false });

/**
 * Schema definition for performance metrics tracking
 */
const performanceMetricsSchema = new Schema({
  processingTime: { type: Number, default: 0 },
  memoryUsage: { type: Number, default: 0 },
  networkTime: { type: Number, default: 0 },
  successRate: { type: Number, default: 100 },
  cpuUsage: { type: Number, default: 0 }
}, { _id: false });

/**
 * Main schema definition for scraping jobs
 */
const scrapeJobSchema = new Schema({
  url: {
    type: String,
    required: true,
    index: true,
    validate: {
      validator: (v: string) => /^https?:\/\/.+/.test(v),
      message: 'URL must be a valid HTTP/HTTPS URL'
    }
  },
  institutionType: {
    type: String,
    required: true,
    enum: Object.keys(SCRAPER_RATE_LIMITS),
    index: true
  },
  config: {
    requestsPerSecond: {
      type: Number,
      required: true,
      min: 0.1,
      max: 10
    },
    burstLimit: {
      type: Number,
      required: true,
      min: 1
    },
    cooldownPeriod: {
      type: Number,
      required: true,
      min: 0
    }
  },
  status: {
    type: String,
    required: true,
    enum: Object.values(JOB_STATUS),
    default: JOB_STATUS.PENDING,
    index: true
  },
  retryCount: {
    type: Number,
    default: 0,
    min: 0,
    max: RETRY_CONFIG.MAX_RETRIES
  },
  startTime: {
    type: Date,
    index: true
  },
  endTime: Date,
  itemsProcessed: {
    type: Number,
    default: 0,
    min: 0
  },
  error: {
    type: {
      type: String,
      enum: Object.values(ERROR_TYPES)
    },
    message: String,
    stack: String,
    recoverySuggestion: String
  },
  rateLimitMetrics: {
    type: rateLimitMetricsSchema,
    default: () => ({})
  },
  performanceMetrics: {
    type: performanceMetricsSchema,
    default: () => ({})
  }
}, {
  timestamps: true,
  collection: 'scrape_jobs'
});

/**
 * Indexes for optimizing queries
 */
scrapeJobSchema.index({ createdAt: 1, status: 1 });
scrapeJobSchema.index({ institutionType: 1, status: 1 });
scrapeJobSchema.index({ 'rateLimitMetrics.isRateLimited': 1, status: 1 });

/**
 * Transform document for JSON serialization
 */
scrapeJobSchema.methods.toJSON = function(): Record<string, any> {
  const job = this.toObject();
  
  // Format dates
  job.createdAt = dayjs(job.createdAt).format('YYYY-MM-DD HH:mm:ss');
  job.updatedAt = dayjs(job.updatedAt).format('YYYY-MM-DD HH:mm:ss');
  if (job.startTime) job.startTime = dayjs(job.startTime).format('YYYY-MM-DD HH:mm:ss');
  if (job.endTime) job.endTime = dayjs(job.endTime).format('YYYY-MM-DD HH:mm:ss');

  // Calculate rate limit metrics
  if (job.rateLimitMetrics) {
    job.rateLimitMetrics.timeUntilReset = job.rateLimitMetrics.cooldownEndTime ? 
      dayjs(job.rateLimitMetrics.cooldownEndTime).diff(dayjs(), 'second') : 0;
    job.rateLimitMetrics.requestRate = job.rateLimitMetrics.requestCount / 
      (job.performanceMetrics?.processingTime || 1);
  }

  // Format performance metrics
  if (job.performanceMetrics) {
    job.performanceMetrics.processingTimeFormatted = 
      `${(job.performanceMetrics.processingTime / 1000).toFixed(2)}s`;
    job.performanceMetrics.memoryUsageFormatted = 
      `${(job.performanceMetrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`;
  }

  // Remove internal fields
  delete job.__v;
  delete job._id;

  return job;
};

/**
 * Check if job can be retried based on configuration and current state
 */
scrapeJobSchema.methods.canRetry = function(): boolean {
  // Check retry count
  if (this.retryCount >= RETRY_CONFIG.MAX_RETRIES) {
    return false;
  }

  // Check if error type is retryable
  if (this.error && !Object.values(ERROR_TYPES).includes(this.error.type)) {
    return false;
  }

  // Check rate limit status
  if (this.rateLimitMetrics.isRateLimited) {
    const cooldownEnded = this.rateLimitMetrics.cooldownEndTime && 
      dayjs().isAfter(this.rateLimitMetrics.cooldownEndTime);
    if (!cooldownEnded) {
      return false;
    }
  }

  // Check performance metrics
  if (this.performanceMetrics.successRate < 20) {
    return false;
  }

  return true;
};

/**
 * Pre-save middleware to set default rate limits based on institution type
 */
scrapeJobSchema.pre('save', function(next) {
  if (this.isNew) {
    const rateLimits = SCRAPER_RATE_LIMITS[this.institutionType as keyof typeof SCRAPER_RATE_LIMITS] || 
      SCRAPER_RATE_LIMITS.DEFAULT;
    
    this.config = {
      ...this.config,
      ...rateLimits
    };
  }
  next();
});

/**
 * Export the Mongoose model
 */
export const ScrapeJob: Model<IScrapeJobDocument> = mongoose.model<IScrapeJobDocument>(
  'ScrapeJob',
  scrapeJobSchema
);