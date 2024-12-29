/**
 * @fileoverview Repository class implementing data access patterns for scraping operation logs
 * with comprehensive error tracking, performance metrics, and monitoring capabilities.
 * @version 1.0.0
 */

import mongoose, { Document, FilterQuery, PaginateOptions } from 'mongoose'; // v6.0.0
import dayjs from 'dayjs'; // v1.10.0
import ScrapeLog, { createErrorLog, createSuccessLog } from '../models/scrapeLog.model';
import { ScraperError, ScraperResult } from '../../interfaces/scraper.interface';
import { ERROR_TYPES } from '../../constants/scraper.constants';

/**
 * Interface for pagination options
 */
interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for filtering options
 */
interface FilterOptions {
  startDate?: Date;
  endDate?: Date;
  level?: string[];
  institutionType?: string[];
}

/**
 * Interface for error statistics
 */
interface ErrorStats {
  totalErrors: number;
  errorsByType: Record<ERROR_TYPES, number>;
  retryAttempts: number;
  averageResponseTime: number;
  rateLimitEvents: number;
  errorTrends: {
    date: string;
    count: number;
  }[];
}

/**
 * Repository class for managing scrape log data access operations
 */
export class ScrapeLogRepository {
  private readonly model: mongoose.Model<any>;

  constructor() {
    this.model = ScrapeLog;
    this.ensureIndexes();
  }

  /**
   * Ensures required indexes exist for optimal query performance
   */
  private async ensureIndexes(): Promise<void> {
    await this.model.collection.createIndex({ jobId: 1, timestamp: -1 });
    await this.model.collection.createIndex({ url: 1, timestamp: -1 });
    await this.model.collection.createIndex({ errorType: 1, timestamp: -1 });
    await this.model.collection.createIndex({ 'performanceMetrics.startTime': 1 });
  }

  /**
   * Creates a new error log entry with enhanced tracking
   */
  async logError(error: ScraperError): Promise<Document> {
    const performanceMetrics = {
      startTime: error.timestamp,
      endTime: new Date(),
      totalDuration: dayjs().diff(error.timestamp, 'millisecond'),
      networkTime: 0, // Set by caller if available
      processingTime: 0, // Set by caller if available
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: process.cpuUsage().user
    };

    return createErrorLog(error, performanceMetrics, error.rateLimitStatus);
  }

  /**
   * Creates a new success log entry with metrics
   */
  async logSuccess(result: ScraperResult): Promise<Document> {
    return createSuccessLog(
      result,
      result.performanceMetrics,
      result.validationResults
    );
  }

  /**
   * Retrieves all logs for a specific job with pagination
   */
  async findByJobId(
    jobId: string,
    options: PaginationOptions
  ): Promise<{ docs: Document[]; total: number; page: number; pages: number }> {
    const query: FilterQuery<any> = { jobId };
    const { page = 1, limit = 50, sortBy = 'timestamp', sortOrder = 'desc' } = options;

    const [docs, total] = await Promise.all([
      this.model
        .find(query)
        .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.model.countDocuments(query)
    ]);

    return {
      docs,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Retrieves all logs for a specific URL with filtering
   */
  async findByUrl(url: string, options: FilterOptions = {}): Promise<Document[]> {
    const query: FilterQuery<any> = { url };

    if (options.startDate && options.endDate) {
      query.timestamp = {
        $gte: options.startDate,
        $lte: options.endDate
      };
    }

    if (options.level?.length) {
      query.level = { $in: options.level };
    }

    return this.model
      .find(query)
      .sort({ timestamp: -1 })
      .exec();
  }

  /**
   * Retrieves logs by error type with enhanced filtering
   */
  async findByErrorType(
    errorType: ERROR_TYPES,
    options: FilterOptions = {}
  ): Promise<Document[]> {
    const query: FilterQuery<any> = {
      errorType,
      level: 'error'
    };

    if (options.startDate && options.endDate) {
      query.timestamp = {
        $gte: options.startDate,
        $lte: options.endDate
      };
    }

    if (options.institutionType?.length) {
      query.institutionType = { $in: options.institutionType };
    }

    return this.model
      .find(query)
      .sort({ timestamp: -1 })
      .exec();
  }

  /**
   * Retrieves comprehensive error statistics for monitoring
   */
  async getErrorStats(startDate: Date, endDate: Date): Promise<ErrorStats> {
    const pipeline = [
      {
        $match: {
          level: 'error',
          timestamp: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            errorType: '$errorType',
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } }
          },
          count: { $sum: 1 },
          retryAttempts: { $sum: '$retryAttempts' },
          avgResponseTime: { $avg: '$performanceMetrics.totalDuration' },
          rateLimitEvents: {
            $sum: {
              $cond: [{ $eq: ['$errorType', ERROR_TYPES.RATE_LIMITED] }, 1, 0]
            }
          }
        }
      }
    ];

    const results = await this.model.aggregate(pipeline);

    // Process results into required format
    const stats: ErrorStats = {
      totalErrors: 0,
      errorsByType: {} as Record<ERROR_TYPES, number>,
      retryAttempts: 0,
      averageResponseTime: 0,
      rateLimitEvents: 0,
      errorTrends: []
    };

    results.forEach((result: any) => {
      const { errorType, date } = result._id;
      stats.totalErrors += result.count;
      stats.errorsByType[errorType] = (stats.errorsByType[errorType] || 0) + result.count;
      stats.retryAttempts += result.retryAttempts;
      stats.rateLimitEvents += result.rateLimitEvents;
      stats.errorTrends.push({ date, count: result.count });
    });

    stats.averageResponseTime = results.reduce((acc: number, curr: any) => 
      acc + curr.avgResponseTime, 0) / results.length || 0;

    return stats;
  }
}

export default ScrapeLogRepository;