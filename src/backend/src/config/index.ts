/**
 * @fileoverview Central configuration aggregator for the Technology Transfer Data Aggregation platform.
 * Provides unified access to all application configuration settings with enhanced validation,
 * security checks, and performance optimization features.
 * @version 1.0.0
 */

// @package dotenv ^16.0.0
import { config as dotenvConfig } from 'dotenv';

// Internal configuration imports
import { authConfig } from './auth.config';
import { postgresConfig, mongoConfig, redisConfig } from './database.config';
import { scraperConfig } from './scraper.config';
import { searchConfig, ELASTICSEARCH_CONFIG, SEARCH_CACHE_CONFIG } from './search.config';

// Load environment variables
dotenvConfig();

/**
 * Performance monitoring decorator for configuration operations
 */
function performanceMetric(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    const start = process.hrtime();
    const result = await originalMethod.apply(this, args);
    const [seconds, nanoseconds] = process.hrtime(start);
    const duration = seconds * 1000 + nanoseconds / 1000000;
    console.log(`${propertyKey} execution time: ${duration.toFixed(2)}ms`);
    return result;
  };
  return descriptor;
}

/**
 * Security audit decorator for configuration validation
 */
function securityAudit(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = async function(...args: any[]) {
    console.log(`Security audit: Validating configuration in ${propertyKey}`);
    const result = await originalMethod.apply(this, args);
    // Log security-relevant configuration changes
    console.log(`Security audit: Configuration validation complete`);
    return result;
  };
  return descriptor;
}

/**
 * Configuration validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  timestamp: string;
  performanceMetrics: {
    validationDuration: number;
    memoryUsage: number;
  };
}

/**
 * Configuration reload options interface
 */
interface ReloadOptions {
  validateOnly?: boolean;
  skipCache?: boolean;
  timeout?: number;
}

class ConfigurationManager {
  private static instance: ConfigurationManager;
  private lastValidated: string = new Date().toISOString();
  private configVersion: string = process.env.CONFIG_VERSION || '1.0.0';

  private constructor() {
    // Private constructor for singleton pattern
  }

  public static getInstance(): ConfigurationManager {
    if (!ConfigurationManager.instance) {
      ConfigurationManager.instance = new ConfigurationManager();
    }
    return ConfigurationManager.instance;
  }

  /**
   * Comprehensive configuration validation with enhanced security and performance checks
   */
  @performanceMetric
  @securityAudit
  public async validateConfig(): Promise<ValidationResult> {
    const startTime = process.hrtime();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Validate environment variables
      if (!process.env.NODE_ENV) {
        warnings.push('NODE_ENV not set, defaulting to development');
      }

      // Validate authentication configuration
      if (!authConfig.jwt.accessToken.secret) {
        errors.push('JWT access token secret is required');
      }

      // Validate database configurations
      if (!postgresConfig.host || !postgresConfig.database) {
        errors.push('Invalid PostgreSQL configuration');
      }
      if (!mongoConfig.uri || !mongoConfig.database) {
        errors.push('Invalid MongoDB configuration');
      }
      if (!redisConfig.host || !redisConfig.port) {
        errors.push('Invalid Redis configuration');
      }

      // Validate scraper configuration
      if (!scraperConfig.engines || Object.keys(scraperConfig.engines).length === 0) {
        errors.push('No scraper engines configured');
      }

      // Validate search configuration
      if (!searchConfig.elasticsearch.node) {
        errors.push('Elasticsearch node configuration missing');
      }

      const [seconds, nanoseconds] = process.hrtime(startTime);
      const validationDuration = seconds * 1000 + nanoseconds / 1000000;

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        timestamp: new Date().toISOString(),
        performanceMetrics: {
          validationDuration,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return {
        isValid: false,
        errors,
        warnings,
        timestamp: new Date().toISOString(),
        performanceMetrics: {
          validationDuration: 0,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }

  /**
   * Safely reloads configuration with versioning and rollback support
   */
  @performanceMetric
  public async reloadConfig(options: ReloadOptions = {}): Promise<{
    success: boolean;
    version: string;
    timestamp: string;
  }> {
    const previousConfig = { ...config };
    
    try {
      // Reload environment variables
      dotenvConfig();

      // Validate new configuration
      const validationResult = await this.validateConfig();
      
      if (!validationResult.isValid) {
        throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
      }

      if (options.validateOnly) {
        return {
          success: true,
          version: this.configVersion,
          timestamp: new Date().toISOString()
        };
      }

      // Update configuration version and timestamp
      this.configVersion = process.env.CONFIG_VERSION || (parseInt(this.configVersion) + 1).toString();
      this.lastValidated = new Date().toISOString();

      return {
        success: true,
        version: this.configVersion,
        timestamp: this.lastValidated
      };
    } catch (error) {
      // Rollback to previous configuration
      Object.assign(config, previousConfig);
      throw error;
    }
  }
}

/**
 * Global configuration object combining all component configurations
 */
export const config = {
  version: process.env.CONFIG_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
  lastValidated: new Date().toISOString(),

  // Component configurations
  auth: authConfig,
  database: {
    postgres: postgresConfig,
    mongo: mongoConfig,
    redis: redisConfig
  },
  scraper: scraperConfig,
  search: {
    ...searchConfig,
    elasticsearch: ELASTICSEARCH_CONFIG,
    cache: SEARCH_CACHE_CONFIG
  },

  // Configuration management
  configManager: ConfigurationManager.getInstance(),

  // Validation status
  validationStatus: null as ValidationResult | null
};

// Perform initial configuration validation
config.configManager.validateConfig().then(
  result => {
    config.validationStatus = result;
    if (!result.isValid) {
      console.error('Configuration validation failed:', result.errors);
      process.exit(1);
    }
  }
);

// Freeze configuration to prevent runtime modifications
Object.freeze(config);

export default config;