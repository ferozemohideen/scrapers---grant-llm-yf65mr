/**
 * @fileoverview Defines comprehensive TypeScript interfaces for the web scraping system
 * supporting 375+ institutions with configurable scraping strategies, error handling,
 * and rate limiting capabilities.
 * @version 1.0.0
 */

import { SCRAPER_ENGINES, ERROR_TYPES } from '../constants/scraper.constants';

/**
 * Configuration for data validation rules
 */
export interface ValidationRules {
  required: string[];
  patterns: Record<string, RegExp>;
  customValidators: Record<string, (value: any) => boolean>;
  dataTypes: Record<string, string>;
}

/**
 * Results of data validation checks
 */
export interface ValidationResults {
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
 * Configuration for institution-specific rate limits
 */
export interface InstitutionRateLimit {
  requestsPerSecond: number;
  burstLimit: number;
  cooldownPeriod: number; // in seconds
}

/**
 * Configuration for handling burst requests
 */
export interface BurstHandlingConfig {
  strategy: 'queue' | 'drop' | 'throttle';
  queueSize?: number;
  throttleRate?: number;
  priorityRules?: Record<string, number>;
}

/**
 * Complete rate limiting configuration
 */
export interface RateLimitConfig {
  requestsPerSecond: number;
  burstLimit: number;
  cooldownPeriod: number;
  institutionOverrides: Record<string, InstitutionRateLimit>;
  burstHandling: BurstHandlingConfig;
}

/**
 * Rate limiting metrics for monitoring
 */
export interface RateLimitMetrics {
  requestCount: number;
  burstCount: number;
  throttledRequests: number;
  queuedRequests: number;
  cooldownPeriods: number;
  averageRequestTime: number;
}

/**
 * Current rate limit status
 */
export interface RateLimitStatus {
  isLimited: boolean;
  remainingRequests: number;
  resetTime: Date;
  currentBurst: number;
  inCooldown: boolean;
}

/**
 * Performance metrics for scraping operations
 */
export interface PerformanceMetrics {
  startTime: Date;
  endTime: Date;
  totalDuration: number;
  networkTime: number;
  processingTime: number;
  memoryUsage: number;
  cpuUsage: number;
}

/**
 * Configuration for scraper behavior
 */
export interface ScraperConfig {
  selectors: Record<string, string>;
  timeout: number;
  userAgent: string;
  proxy?: string;
  cookies?: Record<string, string>;
  headers?: Record<string, string>;
  followRedirects: boolean;
  maxRedirects: number;
  validateSSL: boolean;
}

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffFactor: number;
  retryableErrors: ERROR_TYPES[];
}

/**
 * Core interface for scraper engine implementations
 */
export interface ScraperEngine {
  type: SCRAPER_ENGINES;
  initialize(config: ScraperConfig): Promise<void>;
  scrape(url: string): Promise<Record<string, any>>;
  cleanup(): Promise<void>;
  handleRateLimit(status: RateLimitStatus): Promise<void>;
}

/**
 * Comprehensive scraper job configuration
 */
export interface ScraperJob {
  id: string;
  url: string;
  institutionType: string;
  config: ScraperConfig;
  rateLimitConfig: RateLimitConfig;
  retryConfig: RetryConfig;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rate_limited';
  retryCount: number;
  validationRules: ValidationRules;
}

/**
 * Complete scraper results including metrics
 */
export interface ScraperResult {
  jobId: string;
  url: string;
  data: Record<string, any>;
  timestamp: Date;
  success: boolean;
  rateLimitMetrics: RateLimitMetrics;
  performanceMetrics: PerformanceMetrics;
  validationResults: ValidationResults;
}

/**
 * Enhanced error interface with recovery suggestions
 */
export interface ScraperError {
  type: ERROR_TYPES;
  message: string;
  jobId: string;
  url: string;
  timestamp: Date;
  stack: string;
  retryAttempt: number;
  rateLimitStatus: RateLimitStatus;
  recoverySuggestions: string[];
}