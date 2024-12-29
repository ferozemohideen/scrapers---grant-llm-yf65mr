/**
 * @fileoverview Configuration file for the web scraping system that defines scraper settings,
 * rate limits, retry strategies, validation rules, and engine configurations for different
 * institution types with environment variable support.
 * @version 2.0.0
 */

import { config } from 'dotenv';
import { 
    SCRAPER_ENGINES, 
    ERROR_TYPES, 
    SCRAPER_RATE_LIMITS, 
    RETRY_CONFIG 
} from '../constants/scraper.constants';
import { 
    ScraperEngine, 
    RateLimitConfig, 
    ValidationRules 
} from '../interfaces/scraper.interface';

// Load environment variables
config();

/**
 * Default user agent string for scraping requests
 */
const default_user_agent = 'TechTransfer-Bot/2.0.0 (+https://techtransfer.com/bot)';

/**
 * Comprehensive scraper configuration object
 */
export const scraperConfig = {
    version: '2.0.0',

    /**
     * Engine-specific configurations for different scraping strategies
     */
    engines: {
        [SCRAPER_ENGINES.BEAUTIFUL_SOUP]: {
            type: SCRAPER_ENGINES.BEAUTIFUL_SOUP,
            maxConcurrency: 5,
            timeout: 30000, // 30 seconds
            resourceLimits: {
                maxMemoryMB: 512,
                maxCPUPercent: 50
            },
            headers: {
                'User-Agent': process.env.USER_AGENT || default_user_agent,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
                'Accept-Language': 'en-US,en;q=0.5',
                'Connection': 'keep-alive'
            },
            proxyConfig: {
                enabled: process.env.USE_PROXY === 'true',
                url: process.env.PROXY_URL,
                rotationStrategy: 'round-robin'
            },
            logging: {
                level: process.env.LOG_LEVEL || 'info',
                format: 'json',
                destination: process.env.LOG_DESTINATION || 'stdout'
            }
        },

        [SCRAPER_ENGINES.SCRAPY]: {
            type: SCRAPER_ENGINES.SCRAPY,
            maxConcurrency: 10,
            timeout: 60000, // 60 seconds
            resourceLimits: {
                maxMemoryMB: 1024,
                maxCPUPercent: 70
            },
            middleware: ['robotsTxt', 'httpCompression', 'retry', 'cookies'],
            pipelines: ['validation', 'deduplication', 'storage'],
            settings: {
                ROBOTSTXT_OBEY: true,
                CONCURRENT_REQUESTS_PER_DOMAIN: 2,
                DOWNLOAD_DELAY: 1
            }
        },

        [SCRAPER_ENGINES.SELENIUM]: {
            type: SCRAPER_ENGINES.SELENIUM,
            maxConcurrency: 3,
            timeout: 45000, // 45 seconds
            resourceLimits: {
                maxMemoryMB: 2048,
                maxCPUPercent: 80
            },
            browserConfig: {
                headless: true,
                args: ['--no-sandbox', '--disable-dev-shm-usage'],
                defaultViewport: { width: 1920, height: 1080 }
            },
            waitForConfig: {
                timeout: 30000,
                waitForSelector: true,
                waitForNavigation: true
            }
        }
    },

    /**
     * Rate limiting configurations for different institution types
     */
    rateLimits: SCRAPER_RATE_LIMITS,

    /**
     * Retry strategy configuration for handling failures
     */
    retryStrategy: {
        ...RETRY_CONFIG,
        errorTypeConfig: {
            [ERROR_TYPES.NETWORK_TIMEOUT]: {
                maxRetries: 3,
                backoffFactor: 2
            },
            [ERROR_TYPES.RATE_LIMITED]: {
                maxRetries: 5,
                backoffFactor: 4
            },
            [ERROR_TYPES.PARSE_ERROR]: {
                maxRetries: 2,
                backoffFactor: 1.5
            },
            [ERROR_TYPES.AUTHENTICATION_ERROR]: {
                maxRetries: 0 // Requires manual intervention
            },
            [ERROR_TYPES.VALIDATION_ERROR]: {
                maxRetries: 1,
                backoffFactor: 1
            }
        }
    },

    /**
     * Data validation rules for scraped content
     */
    validationRules: {
        required_fields: ['title', 'description', 'url'],
        field_types: {
            title: 'string',
            description: 'string',
            url: 'url',
            published_date: 'date',
            contact_email: 'email',
            patent_number: 'string',
            technology_readiness_level: 'number'
        },
        custom_validators: {
            url: (url: string) => {
                const institutionDomains = process.env.ALLOWED_DOMAINS?.split(',') || [];
                try {
                    const urlObj = new URL(url);
                    return institutionDomains.some(domain => urlObj.hostname.endsWith(domain));
                } catch {
                    return false;
                }
            },
            description: (text: string) => text.length >= 100,
            title: (text: string) => text.length >= 10 && text.length <= 200
        },
        sanitization: {
            removeHTML: true,
            trimWhitespace: true,
            normalizeURLs: true
        }
    },

    /**
     * Monitoring and alerting configuration
     */
    monitoring: {
        enabled: true,
        metrics: {
            collection_interval: 60, // seconds
            retention_period: 30 // days
        },
        alerts: {
            error_threshold: 10,
            rate_limit_threshold: 5,
            notification_channels: ['email', 'slack']
        }
    }
};

/**
 * Validate configuration on load
 */
const validateConfig = (config: typeof scraperConfig): boolean => {
    // Validate engine configurations
    for (const engine of Object.values(config.engines)) {
        if (!engine.type || !engine.maxConcurrency || !engine.timeout) {
            throw new Error(`Invalid engine configuration for ${engine.type}`);
        }
    }

    // Validate rate limits
    if (!config.rateLimits || !config.rateLimits.DEFAULT) {
        throw new Error('Missing rate limit configuration');
    }

    // Validate retry strategy
    if (!config.retryStrategy || !config.retryStrategy.MAX_RETRIES) {
        throw new Error('Invalid retry strategy configuration');
    }

    // Validate validation rules
    if (!config.validationRules.required_fields?.length) {
        throw new Error('Missing required fields in validation rules');
    }

    return true;
};

// Validate configuration immediately
validateConfig(scraperConfig);

// Freeze configuration to prevent runtime modifications
Object.freeze(scraperConfig);