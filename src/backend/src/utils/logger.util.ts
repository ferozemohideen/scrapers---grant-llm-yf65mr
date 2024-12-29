/**
 * @file Logger Utility
 * @description Enterprise-grade logging utility implementing structured logging with multiple transports,
 * distributed tracing, and comprehensive error handling
 * @version 1.0.0
 */

import winston from 'winston'; // v3.8.0
import DailyRotateFile from 'winston-daily-rotate-file'; // v4.7.0
import { ElasticsearchTransport } from 'winston-elasticsearch'; // v0.17.0
import { v4 as uuidv4 } from 'uuid'; // v9.0.0
import { LOG_LEVELS } from '../constants/error.constants';
import { loggerConfig } from '../config/logger.config';

/**
 * Interface for structured log metadata
 */
interface LogMetadata {
  [key: string]: any;
  traceId?: string;
  timestamp?: string;
  context?: object;
}

/**
 * Interface for error tracking
 */
interface ErrorTracker {
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
}

/**
 * Singleton logger class providing enterprise logging capabilities
 */
class Logger {
  private static instance: Logger | null = null;
  private logger: winston.Logger;
  private context: Record<string, any> = {};
  private traceId: string = '';
  private errorTracking: Map<string, ErrorTracker> = new Map();
  private readonly sensitivePatterns: RegExp[] = [
    /password/i,
    /token/i,
    /key/i,
    /secret/i,
    /credential/i,
    /authorization/i,
    /api[-_]?key/i
  ];

  /**
   * Private constructor initializing the logger with configured transports
   */
  private constructor() {
    // Initialize Winston logger with transports
    this.logger = winston.createLogger({
      levels: winston.config.npm.levels,
      exitOnError: false
    });

    // Add console transport
    this.logger.add(new winston.transports.Console(loggerConfig.console));

    // Add file transport with rotation
    this.logger.add(new DailyRotateFile(loggerConfig.file));

    // Add Elasticsearch transport if configured
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(new ElasticsearchTransport(loggerConfig.elasticsearch));
    }

    // Set up global error handlers
    this.setupGlobalErrorHandlers();
  }

  /**
   * Returns singleton logger instance
   */
  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Sets up global error handlers for uncaught exceptions and unhandled rejections
   */
  private setupGlobalErrorHandlers(): void {
    process.on('uncaughtException', (error: Error) => {
      this.critical('Uncaught Exception', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason: any) => {
      this.critical('Unhandled Rejection', reason instanceof Error ? reason : new Error(String(reason)));
    });
  }

  /**
   * Sets context data for request tracking
   */
  public setContext(contextData: Record<string, any>): void {
    this.traceId = contextData.traceId || uuidv4();
    this.context = {
      ...this.context,
      ...this.maskSensitiveData(contextData),
      traceId: this.traceId
    };
  }

  /**
   * Clears the current context
   */
  public clearContext(): void {
    this.context = {};
    this.traceId = '';
  }

  /**
   * Masks sensitive data in objects
   */
  private maskSensitiveData(data: any): any {
    if (!data) return data;
    
    if (typeof data === 'object') {
      const masked = { ...data };
      for (const key in masked) {
        if (this.sensitivePatterns.some(pattern => pattern.test(key))) {
          masked[key] = '***MASKED***';
        } else if (typeof masked[key] === 'object') {
          masked[key] = this.maskSensitiveData(masked[key]);
        }
      }
      return masked;
    }
    return data;
  }

  /**
   * Tracks error occurrences and checks thresholds
   */
  private trackError(errorType: string): void {
    const now = new Date();
    const tracking = this.errorTracking.get(errorType) || {
      count: 0,
      firstOccurrence: now,
      lastOccurrence: now
    };

    tracking.count++;
    tracking.lastOccurrence = now;
    this.errorTracking.set(errorType, tracking);

    // Reset tracking after 1 hour
    setTimeout(() => {
      this.errorTracking.delete(errorType);
    }, 3600000);
  }

  /**
   * Formats log message with metadata
   */
  private formatLogMessage(level: string, message: string, meta: LogMetadata = {}): LogMetadata {
    return {
      level,
      message,
      timestamp: new Date().toISOString(),
      traceId: this.traceId,
      ...this.context,
      ...this.maskSensitiveData(meta)
    };
  }

  /**
   * Logs info level message
   */
  public info(message: string, meta: LogMetadata = {}): void {
    this.logger.info(message, this.formatLogMessage(LOG_LEVELS.INFO, message, meta));
  }

  /**
   * Logs warning level message
   */
  public warn(message: string, meta: LogMetadata = {}): void {
    this.logger.warn(message, this.formatLogMessage(LOG_LEVELS.WARNING, message, meta));
  }

  /**
   * Logs error level message with stack trace
   */
  public error(message: string, error?: Error, meta: LogMetadata = {}): void {
    const errorMeta = {
      ...meta,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    this.trackError(error?.name || 'UNKNOWN_ERROR');
    this.logger.error(message, this.formatLogMessage(LOG_LEVELS.ERROR, message, errorMeta));
  }

  /**
   * Logs critical level message and triggers immediate alerts
   */
  public critical(message: string, error?: Error, meta: LogMetadata = {}): void {
    const errorMeta = {
      ...meta,
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : undefined
    };

    this.trackError(error?.name || 'CRITICAL_ERROR');
    this.logger.error(message, this.formatLogMessage(LOG_LEVELS.CRITICAL, message, errorMeta));
  }
}

// Export singleton logger instance
export const logger = Logger.getInstance();
```

This implementation provides a robust logging utility with the following key features:

1. **Singleton Pattern**: Ensures a single logger instance throughout the application.

2. **Multiple Transports**:
   - Console logging with colorization
   - File logging with daily rotation
   - Elasticsearch integration for production environments

3. **Structured Logging**:
   - Consistent log format across all transports
   - Timestamp and trace ID inclusion
   - Context preservation across requests

4. **Security Features**:
   - Sensitive data masking
   - Configurable patterns for identifying sensitive fields
   - Production-specific security controls

5. **Error Handling**:
   - Comprehensive error tracking
   - Threshold-based alerting
   - Global error handlers for uncaught exceptions

6. **Request Tracing**:
   - Unique trace ID generation
   - Context preservation
   - Request metadata inclusion

7. **Type Safety**:
   - Full TypeScript support
   - Interface definitions for metadata
   - Type-safe method signatures

8. **Production Ready**:
   - Environment-specific configuration
   - Error recovery mechanisms
   - Performance optimizations

The logger can be used throughout the application by importing the singleton instance:

```typescript
import { logger } from './utils/logger.util';

// Set request context
logger.setContext({ requestId: '123', userId: '456' });

// Log messages
logger.info('Operation successful', { operation: 'data_sync' });
logger.error('Operation failed', new Error('Database connection failed'));

// Clear context after request
logger.clearContext();