/**
 * @fileoverview Enterprise-grade configuration management service with comprehensive validation,
 * security controls, and change tracking across development, staging, and production environments.
 * @version 1.0.0
 */

import { singleton } from '@nestjs/common'; // v8.0.0
import { EventEmitter } from 'events'; // v1.0.0
import {
  DatabaseConfig,
  MongoConfig,
  RedisConfig,
  ScraperConfig,
  AuthConfig,
  SearchConfig,
  SecurityConfig
} from '../interfaces/config.interface';
import config from '../config';
import {
  validateConfig,
  validateSecurity,
  validateCredentials
} from '../utils/validation.util';

/**
 * Configuration update options interface
 */
interface UpdateOptions {
  validateOnly?: boolean;
  skipCache?: boolean;
  reloadDependencies?: boolean;
  auditLog?: boolean;
}

/**
 * Configuration validation result interface
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  timestamp: string;
  metrics: {
    validationTime: number;
    memoryUsage: number;
  };
}

/**
 * Enterprise-grade configuration management service
 */
@singleton()
export class ConfigService {
  private config: Record<string, any>;
  private configValidators: Map<string, Function>;
  private configCache: Map<string, any>;
  private eventEmitter: EventEmitter;
  private readonly environment: string;
  private validationResults: Map<string, ValidationResult>;

  constructor() {
    this.environment = process.env.NODE_ENV || 'development';
    this.config = this.initializeConfig();
    this.configValidators = this.setupValidators();
    this.configCache = new Map();
    this.eventEmitter = new EventEmitter();
    this.validationResults = new Map();

    // Perform initial validation
    this.validateAllConfigurations();
  }

  /**
   * Retrieves configuration value by key with validation and caching
   */
  public getConfig<T>(key: string): T {
    // Check cache first
    if (this.configCache.has(key)) {
      return this.configCache.get(key) as T;
    }

    // Get and validate configuration
    const value = this.getConfigValue<T>(key);
    if (this.shouldValidateConfig(key)) {
      const validationResult = this.validateConfig(key, value);
      if (!validationResult.isValid) {
        throw new Error(`Invalid configuration for ${key}: ${validationResult.errors.join(', ')}`);
      }
    }

    // Cache the validated value
    this.configCache.set(key, value);
    return value;
  }

  /**
   * Updates configuration with comprehensive validation and change tracking
   */
  public async updateConfig<T>(
    key: string,
    value: T,
    options: UpdateOptions = {}
  ): Promise<ValidationResult> {
    const startTime = process.hrtime();

    try {
      // Validate new configuration
      const validationResult = await this.validateConfig(key, value);
      if (!validationResult.isValid) {
        return validationResult;
      }

      if (options.validateOnly) {
        return validationResult;
      }

      // Create backup of current value
      const previousValue = this.config[key];

      // Update configuration
      this.config[key] = value;

      // Clear cache if needed
      if (!options.skipCache) {
        this.configCache.delete(key);
      }

      // Emit change event
      this.eventEmitter.emit('configChange', {
        key,
        previousValue,
        newValue: value,
        timestamp: new Date().toISOString(),
        environment: this.environment
      });

      // Audit logging
      if (options.auditLog) {
        this.logConfigChange(key, previousValue, value);
      }

      // Update validation results
      this.validationResults.set(key, validationResult);

      return validationResult;
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      return {
        isValid: false,
        errors: [`Configuration update failed: ${error.message}`],
        warnings: [],
        timestamp: new Date().toISOString(),
        metrics: {
          validationTime: seconds * 1000 + nanoseconds / 1e6,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }

  /**
   * Validates configuration with comprehensive checks
   */
  private validateConfig(key: string, value: any): ValidationResult {
    const startTime = process.hrtime();
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Get appropriate validator
      const validator = this.configValidators.get(key);
      if (validator) {
        const validationResult = validator(value);
        if (!validationResult.isValid) {
          errors.push(...validationResult.errors);
        }
        warnings.push(...validationResult.warnings);
      }

      // Security validation for sensitive configurations
      if (this.isSensitiveConfig(key)) {
        const securityResult = validateSecurity(value);
        if (!securityResult.isValid) {
          errors.push(...securityResult.errors);
        }
      }

      const [seconds, nanoseconds] = process.hrtime(startTime);
      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        timestamp: new Date().toISOString(),
        metrics: {
          validationTime: seconds * 1000 + nanoseconds / 1e6,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    } catch (error) {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings,
        timestamp: new Date().toISOString(),
        metrics: {
          validationTime: seconds * 1000 + nanoseconds / 1e6,
          memoryUsage: process.memoryUsage().heapUsed
        }
      };
    }
  }

  /**
   * Initializes configuration with environment-specific settings
   */
  private initializeConfig(): Record<string, any> {
    return {
      ...config,
      environment: this.environment,
      version: process.env.CONFIG_VERSION || '1.0.0',
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Sets up configuration validators map
   */
  private setupValidators(): Map<string, Function> {
    const validators = new Map();
    validators.set('database', validateConfig);
    validators.set('auth', validateCredentials);
    validators.set('security', validateSecurity);
    return validators;
  }

  /**
   * Checks if configuration key contains sensitive data
   */
  private isSensitiveConfig(key: string): boolean {
    const sensitiveKeys = ['database', 'auth', 'security', 'credentials'];
    return sensitiveKeys.some(k => key.toLowerCase().includes(k));
  }

  /**
   * Retrieves raw configuration value
   */
  private getConfigValue<T>(key: string): T {
    const value = this.config[key];
    if (value === undefined) {
      throw new Error(`Configuration key not found: ${key}`);
    }
    return value as T;
  }

  /**
   * Determines if configuration requires validation
   */
  private shouldValidateConfig(key: string): boolean {
    return this.configValidators.has(key) || this.isSensitiveConfig(key);
  }

  /**
   * Logs configuration changes for audit purposes
   */
  private logConfigChange(key: string, previousValue: any, newValue: any): void {
    console.log({
      event: 'CONFIG_CHANGE',
      key,
      environment: this.environment,
      timestamp: new Date().toISOString(),
      changes: {
        previous: this.isSensitiveConfig(key) ? '[REDACTED]' : previousValue,
        new: this.isSensitiveConfig(key) ? '[REDACTED]' : newValue
      }
    });
  }

  /**
   * Validates all configurations on startup
   */
  private validateAllConfigurations(): void {
    for (const [key, value] of Object.entries(this.config)) {
      if (this.shouldValidateConfig(key)) {
        const result = this.validateConfig(key, value);
        this.validationResults.set(key, result);
        if (!result.isValid) {
          console.error(`Configuration validation failed for ${key}:`, result.errors);
        }
      }
    }
  }
}