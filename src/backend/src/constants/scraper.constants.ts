/**
 * @fileoverview Defines constant values and enums used throughout the scraping system
 * including engine types, error classifications, rate limits, and retry configurations.
 * This file serves as the central source of truth for all scraping-related constants.
 * @version 1.0.0
 */

/**
 * Available scraper engine types that can be used for data collection
 */
export enum SCRAPER_ENGINES {
    BEAUTIFUL_SOUP = 'beautiful_soup',
    SCRAPY = 'scrapy',
    SELENIUM = 'selenium'
}

/**
 * Comprehensive set of error types that can occur during scraping operations
 */
export enum ERROR_TYPES {
    NETWORK_TIMEOUT = 'network_timeout',
    RATE_LIMITED = 'rate_limited',
    PARSE_ERROR = 'parse_error',
    AUTHENTICATION_ERROR = 'auth_error',
    VALIDATION_ERROR = 'validation_error'
}

/**
 * Interface defining the structure of rate limit configuration
 */
interface RateLimitConfig {
    requestsPerSecond: number;
    burstLimit: number;
    cooldownPeriod: number; // in seconds
}

/**
 * Rate limiting configurations for different institution types
 * to ensure respectful data collection
 */
export const SCRAPER_RATE_LIMITS: {
    US_UNIVERSITIES: RateLimitConfig;
    INTERNATIONAL_UNIVERSITIES: RateLimitConfig;
    FEDERAL_LABS: RateLimitConfig;
    DEFAULT: RateLimitConfig;
} = {
    US_UNIVERSITIES: {
        requestsPerSecond: 2,
        burstLimit: 5,
        cooldownPeriod: 60
    },
    INTERNATIONAL_UNIVERSITIES: {
        requestsPerSecond: 1,
        burstLimit: 3,
        cooldownPeriod: 120
    },
    FEDERAL_LABS: {
        requestsPerSecond: 5,
        burstLimit: 10,
        cooldownPeriod: 30
    },
    DEFAULT: {
        requestsPerSecond: 1,
        burstLimit: 2,
        cooldownPeriod: 300
    }
} as const;

/**
 * Configuration for exponential backoff retry strategy
 * Used when handling failed requests
 */
export const RETRY_CONFIG = {
    /**
     * Maximum number of retry attempts before giving up
     */
    MAX_RETRIES: 3,

    /**
     * Initial delay between retries in milliseconds
     */
    INITIAL_DELAY: 1000,

    /**
     * Maximum delay between retries in milliseconds
     */
    MAX_DELAY: 30000,

    /**
     * Exponential factor for increasing delay between retries
     */
    BACKOFF_FACTOR: 2
} as const;

/**
 * Type definitions for error handling configurations
 */
export type ErrorType = keyof typeof ERROR_TYPES;
export type ScraperEngine = keyof typeof SCRAPER_ENGINES;
export type InstitutionType = keyof Omit<typeof SCRAPER_RATE_LIMITS, 'DEFAULT'>;

/**
 * Freeze objects to prevent runtime modifications
 */
Object.freeze(SCRAPER_RATE_LIMITS);
Object.freeze(RETRY_CONFIG);