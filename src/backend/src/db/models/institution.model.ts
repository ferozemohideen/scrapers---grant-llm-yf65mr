/**
 * @fileoverview Institution model definition with comprehensive configuration and validation
 * for technology transfer offices across universities and federal labs.
 * @version 1.0.0
 */

import {
  Model,
  Column,
  Entity,
  Index,
  BeforeInsert,
  BeforeUpdate
} from 'typeorm';
import {
  IsUrl,
  IsNotEmpty,
  ValidateNested,
  IsEnum,
  IsOptional,
  Min,
  Max
} from 'class-validator';
import { SCRAPER_ENGINES } from '../../constants/scraper.constants';
import { RateLimitConfig } from '../../interfaces/scraper.interface';

/**
 * Institution types supported by the system
 */
export enum InstitutionType {
  US_UNIVERSITY = 'US_UNIVERSITY',
  INTERNATIONAL_UNIVERSITY = 'INTERNATIONAL_UNIVERSITY',
  FEDERAL_LAB = 'FEDERAL_LAB'
}

/**
 * Selector configuration for HTML scraping
 */
export interface SelectorConfig {
  title: string;
  description: string;
  pagination?: string;
  links?: string[];
  metadata?: Record<string, string>;
}

/**
 * Database model representing a technology transfer institution
 * with comprehensive configuration and validation capabilities
 */
@Entity('institutions')
@Index(['name'], { unique: true })
@Index(['baseUrl'], { unique: true })
@Index(['type', 'country'], { unique: false })
export class Institution extends Model {
  @Column('uuid', { primary: true, generated: 'uuid' })
  id: string;

  @Column('varchar', { length: 255 })
  @IsNotEmpty()
  name: string;

  @Column('varchar', { length: 100 })
  @IsNotEmpty()
  country: string;

  @Column('enum', { enum: InstitutionType })
  @IsEnum(InstitutionType)
  type: InstitutionType;

  @Column('varchar', { length: 500 })
  @IsUrl()
  @IsNotEmpty()
  baseUrl: string;

  @Column('enum', { enum: SCRAPER_ENGINES })
  @IsEnum(SCRAPER_ENGINES)
  engineType: SCRAPER_ENGINES;

  @Column('jsonb')
  @ValidateNested()
  selectors: SelectorConfig;

  @Column('jsonb')
  @ValidateNested()
  rateLimit: RateLimitConfig;

  @Column('boolean', { default: true })
  active: boolean;

  @Column('timestamp with time zone', { nullable: true })
  lastScraped: Date | null;

  @Column('timestamp with time zone', { default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column('timestamp with time zone', { default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;

  @Column('integer', { default: 0 })
  @Min(0)
  scrapeSuccessCount: number;

  @Column('integer', { default: 0 })
  @Min(0)
  scrapeFailureCount: number;

  @Column('jsonb', { nullable: true })
  @IsOptional()
  lastError: {
    message: string;
    timestamp: Date;
    stackTrace?: string;
  } | null;

  /**
   * Creates a new Institution instance with default configurations
   * @param institutionData Initial institution data
   */
  constructor(institutionData: Partial<Institution>) {
    super();
    Object.assign(this, institutionData);

    // Set default rate limits based on institution type
    this.rateLimit = this.getDefaultRateLimit();

    // Set default scraper engine if not specified
    if (!this.engineType) {
      this.engineType = this.getDefaultEngine();
    }

    // Initialize metrics
    this.scrapeSuccessCount = 0;
    this.scrapeFailureCount = 0;
    this.lastError = null;
  }

  /**
   * Updates scraping metrics and timestamps after a scraping operation
   * @param success Whether the scraping operation was successful
   * @param error Optional error details if scraping failed
   */
  async updateLastScraped(success: boolean, error?: Error): Promise<void> {
    this.lastScraped = new Date();
    
    if (success) {
      this.scrapeSuccessCount++;
      this.lastError = null;
    } else {
      this.scrapeFailureCount++;
      if (error) {
        this.lastError = {
          message: error.message,
          timestamp: new Date(),
          stackTrace: error.stack
        };
      }
    }

    await this.save();
  }

  /**
   * Calculates optimal rate limit based on success metrics
   * @returns Optimized rate limit configuration
   */
  calculateRateLimit(): RateLimitConfig {
    const totalScrapes = this.scrapeSuccessCount + this.scrapeFailureCount;
    const successRate = totalScrapes > 0 
      ? this.scrapeSuccessCount / totalScrapes 
      : 1;

    const baseLimit = this.getDefaultRateLimit();

    // Adjust rate limits based on success rate
    if (successRate > 0.95) {
      return {
        ...baseLimit,
        requestsPerSecond: Math.min(baseLimit.requestsPerSecond * 1.5, baseLimit.burstLimit),
        cooldownPeriod: Math.max(baseLimit.cooldownPeriod * 0.8, 30)
      };
    } else if (successRate < 0.8) {
      return {
        ...baseLimit,
        requestsPerSecond: Math.max(baseLimit.requestsPerSecond * 0.7, 1),
        cooldownPeriod: baseLimit.cooldownPeriod * 1.5
      };
    }

    return baseLimit;
  }

  /**
   * Updates timestamps before database operations
   */
  @BeforeInsert()
  setCreatedAt() {
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  @BeforeUpdate()
  setUpdatedAt() {
    this.updatedAt = new Date();
  }

  /**
   * Gets default rate limit configuration based on institution type
   */
  private getDefaultRateLimit(): RateLimitConfig {
    switch (this.type) {
      case InstitutionType.US_UNIVERSITY:
        return {
          requestsPerSecond: 2,
          burstLimit: 5,
          cooldownPeriod: 60
        };
      case InstitutionType.INTERNATIONAL_UNIVERSITY:
        return {
          requestsPerSecond: 1,
          burstLimit: 3,
          cooldownPeriod: 120
        };
      case InstitutionType.FEDERAL_LAB:
        return {
          requestsPerSecond: 5,
          burstLimit: 10,
          cooldownPeriod: 30
        };
      default:
        return {
          requestsPerSecond: 1,
          burstLimit: 2,
          cooldownPeriod: 300
        };
    }
  }

  /**
   * Determines default scraper engine based on institution configuration
   */
  private getDefaultEngine(): SCRAPER_ENGINES {
    if (this.selectors?.pagination) {
      return SCRAPER_ENGINES.SCRAPY;
    } else if (this.type === InstitutionType.FEDERAL_LAB) {
      return SCRAPER_ENGINES.SELENIUM;
    }
    return SCRAPER_ENGINES.BEAUTIFUL_SOUP;
  }
}