/**
 * @fileoverview TypeScript interface definitions for frontend configuration including URL configurations,
 * scraping settings, and institution details for the technology transfer data aggregation system.
 */

/**
 * Enumeration of supported institution types with clear categorization
 */
export enum InstitutionType {
    US_UNIVERSITY = 'US_UNIVERSITY',
    INTERNATIONAL_UNIVERSITY = 'INTERNATIONAL_UNIVERSITY',
    FEDERAL_LAB = 'FEDERAL_LAB'
}

/**
 * Configuration for retry behavior on failed attempts
 */
export interface RetryConfig {
    /** Maximum number of retry attempts before failing */
    maxAttempts: number;
    /** Base backoff time in milliseconds between retries */
    backoffMs: number;
}

/**
 * Flexible configuration for HTML selectors with custom fields
 */
export interface SelectorConfig {
    /** CSS selector for technology title */
    title: string;
    /** CSS selector for technology description */
    description: string;
    /** CSS selector for pagination elements */
    pagination: string;
    /** Additional custom CSS selectors as key-value pairs */
    custom: Record<string, string>;
}

/**
 * Comprehensive configuration for scraping behavior
 */
export interface ScrapingConfig {
    /** HTML element selectors for data extraction */
    selectors: SelectorConfig;
    /** Number of requests allowed per second */
    rateLimit: number;
    /** Configuration for retry behavior */
    retryConfig: RetryConfig;
}

/**
 * Additional metadata configuration for institutions
 */
export interface InstitutionMetadata {
    /** Primary contact email for the institution */
    contactEmail: string;
    /** Environment variable name containing API key */
    apiKeyEnv: string;
    /** Data refresh interval in days */
    refreshInterval: number;
}

/**
 * Detailed configuration interface for institution information
 */
export interface InstitutionConfig {
    /** Institution's official name */
    name: string;
    /** Type categorization of the institution */
    type: InstitutionType;
    /** ISO country code or full country name */
    country: string;
    /** Additional institution metadata */
    metadata: InstitutionMetadata;
}

/**
 * Main interface for URL configuration with comprehensive metadata
 */
export interface URLConfig {
    /** Base URL for technology transfer data */
    url: string;
    /** Detailed institution configuration */
    institution: InstitutionConfig;
    /** Scraping behavior configuration */
    scraping: ScrapingConfig;
    /** Flag indicating if this URL is currently active */
    active: boolean;
    /** Timestamp of last successful update */
    lastUpdated: Date;
}