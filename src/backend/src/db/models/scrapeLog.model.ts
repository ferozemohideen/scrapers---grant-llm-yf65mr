/**
 * @fileoverview Defines the MongoDB schema and model for comprehensive scraping operation logs
 * with support for detailed error tracking, performance metrics, and data quality monitoring.
 * @version 1.0.0
 */

import mongoose, { Schema, Document, Model } from 'mongoose';
import dayjs from 'dayjs'; // v1.10.0
import { ScraperError, ScraperResult } from '../../interfaces/scraper.interface';
import { ERROR_TYPES } from '../../constants/scraper.constants';

/**
 * Interface defining the structure of performance metrics within the log
 */
interface IPerformanceMetrics {
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  networkTime: number;
  processingTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

/**
 * Interface defining rate limit tracking data
 */
interface IRateLimitStatus {
  isLimited: boolean;
  remainingRequests: number;
  resetTime: Date;
  currentBurst: number;
  inCooldown: boolean;
}

/**
 * Interface defining validation results for data quality tracking
 */
interface IValidationResults {
  isValid: boolean;
  errors: Array<{
    field: string;
    rule: string;
    message: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Interface for the scrape log document
 */
export interface IScrapeLog extends Document {
  jobId: string;
  url: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  errorType?: ERROR_TYPES;
  stack?: string;
  itemsProcessed: number;
  institutionType: string;
  retryAttempts: number;
  performanceMetrics?: IPerformanceMetrics;
  rateLimitStatus?: IRateLimitStatus;
  validationResults?: IValidationResults;
  metadata: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose schema definition for scraping operation logs
 */
const ScrapeLogSchema = new Schema<IScrapeLog>({
  jobId: {
    type: String,
    required: true,
    index: true
  },
  url: {
    type: String,
    required: true,
    index: true
  },
  level: {
    type: String,
    required: true,
    enum: ['error', 'warn', 'info', 'debug'],
    index: true
  },
  message: {
    type: String,
    required: true
  },
  errorType: {
    type: String,
    enum: Object.values(ERROR_TYPES),
    sparse: true
  },
  stack: {
    type: String
  },
  itemsProcessed: {
    type: Number,
    default: 0
  },
  institutionType: {
    type: String,
    required: true,
    index: true
  },
  retryAttempts: {
    type: Number,
    default: 0
  },
  performanceMetrics: {
    startTime: Date,
    endTime: Date,
    totalDuration: Number,
    networkTime: Number,
    processingTime: Number,
    memoryUsage: Number,
    cpuUsage: Number
  },
  rateLimitStatus: {
    isLimited: Boolean,
    remainingRequests: Number,
    resetTime: Date,
    currentBurst: Number,
    inCooldown: Boolean
  },
  validationResults: {
    isValid: Boolean,
    errors: [{
      field: String,
      rule: String,
      message: String
    }],
    warnings: [{
      field: String,
      message: String
    }]
  },
  metadata: {
    type: Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

/**
 * Transform method to format log documents for output
 */
ScrapeLogSchema.methods.toJSON = function() {
  const obj = this.toObject();
  
  // Format timestamps
  obj.timestamp = dayjs(obj.timestamp).toISOString();
  obj.createdAt = dayjs(obj.createdAt).toISOString();
  obj.updatedAt = dayjs(obj.updatedAt).toISOString();
  
  if (obj.performanceMetrics) {
    obj.performanceMetrics.startTime = dayjs(obj.performanceMetrics.startTime).toISOString();
    obj.performanceMetrics.endTime = dayjs(obj.performanceMetrics.endTime).toISOString();
  }
  
  if (obj.rateLimitStatus?.resetTime) {
    obj.rateLimitStatus.resetTime = dayjs(obj.rateLimitStatus.resetTime).toISOString();
  }
  
  // Clean up internal Mongoose fields
  delete obj.__v;
  delete obj._id;
  
  return obj;
};

/**
 * Creates a detailed error log entry
 */
export async function createErrorLog(
  error: ScraperError,
  performanceMetrics?: IPerformanceMetrics,
  rateLimitStatus?: IRateLimitStatus
): Promise<Document> {
  return await ScrapeLog.create({
    jobId: error.jobId,
    url: error.url,
    level: 'error',
    message: error.message,
    errorType: error.type,
    stack: error.stack,
    retryAttempts: error.retryAttempt,
    institutionType: error.url.includes('edu') ? 'US_UNIVERSITIES' : 'INTERNATIONAL_UNIVERSITIES',
    performanceMetrics,
    rateLimitStatus: error.rateLimitStatus || rateLimitStatus,
    timestamp: error.timestamp,
    metadata: {
      recoverySuggestions: error.recoverySuggestions
    }
  });
}

/**
 * Creates a detailed success log entry
 */
export async function createSuccessLog(
  result: ScraperResult,
  performanceMetrics: IPerformanceMetrics,
  validationResults: IValidationResults
): Promise<Document> {
  return await ScrapeLog.create({
    jobId: result.jobId,
    url: result.url,
    level: 'info',
    message: 'Scraping completed successfully',
    itemsProcessed: Object.keys(result.data).length,
    institutionType: result.url.includes('edu') ? 'US_UNIVERSITIES' : 'INTERNATIONAL_UNIVERSITIES',
    performanceMetrics,
    rateLimitStatus: {
      ...result.rateLimitMetrics,
      isLimited: false,
      resetTime: new Date()
    },
    validationResults,
    timestamp: result.timestamp,
    metadata: {
      dataSize: JSON.stringify(result.data).length
    }
  });
}

// Create and export the model
const ScrapeLog: Model<IScrapeLog> = mongoose.model<IScrapeLog>('ScrapeLog', ScrapeLogSchema);
export default ScrapeLog;