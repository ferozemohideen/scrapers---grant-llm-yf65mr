/**
 * @fileoverview Repository class for managing Institution entities with enhanced query capabilities,
 * configuration management, and monitoring features.
 * @version 1.0.0
 */

import {
  Repository,
  EntityRepository,
  QueryRunner,
  Transaction,
  TransactionManager,
  FindOptionsWhere,
  ILike,
  LessThan,
  MoreThan
} from 'typeorm';
import { Logger } from 'winston';
import { Institution, InstitutionType } from '../models/institution.model';
import { SCRAPER_ENGINES } from '../../constants/scraper.constants';
import { RateLimitConfig } from '../../interfaces/scraper.interface';

/**
 * Repository class for managing Institution entities with enhanced functionality
 */
@EntityRepository(Institution)
export class InstitutionRepository extends Repository<Institution> {
  private readonly CACHE_TTL = 300; // 5 minutes cache
  private readonly MAX_RETRY_ATTEMPTS = 3;

  /**
   * Creates a new InstitutionRepository instance
   * @param logger Winston logger instance for operation tracking
   */
  constructor(private readonly logger: Logger) {
    super();
    this.logger.info('InstitutionRepository initialized');
  }

  /**
   * Finds an institution by name with case-insensitive search
   * @param name Institution name to search for
   * @returns Promise resolving to found institution or null
   */
  async findByName(name: string): Promise<Institution | null> {
    try {
      const queryBuilder = this.createQueryBuilder('institution')
        .where('institution.name ILIKE :name', { name: `%${name}%` })
        .cache(this.CACHE_TTL);

      const startTime = Date.now();
      const result = await queryBuilder.getOne();
      const duration = Date.now() - startTime;

      this.logger.debug(`findByName query completed in ${duration}ms`, {
        name,
        found: !!result,
        duration
      });

      return result;
    } catch (error) {
      this.logger.error('Error in findByName', {
        name,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Finds an institution by its base URL with normalization
   * @param baseUrl Institution base URL
   * @returns Promise resolving to found institution or null
   */
  async findByUrl(baseUrl: string): Promise<Institution | null> {
    const normalizedUrl = this.normalizeUrl(baseUrl);
    
    try {
      const result = await this.findOne({
        where: { baseUrl: ILike(`%${normalizedUrl}%`) },
        cache: this.CACHE_TTL
      });

      this.logger.debug('findByUrl query completed', {
        baseUrl: normalizedUrl,
        found: !!result
      });

      return result;
    } catch (error) {
      this.logger.error('Error in findByUrl', {
        baseUrl,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Retrieves all active institutions sorted by last scrape date
   * @param options Optional query parameters
   * @returns Promise resolving to array of active institutions
   */
  async findActiveInstitutions(options: {
    type?: InstitutionType;
    lastScrapedBefore?: Date;
    limit?: number;
    offset?: number;
  } = {}): Promise<Institution[]> {
    try {
      const queryBuilder = this.createQueryBuilder('institution')
        .where('institution.active = :active', { active: true });

      if (options.type) {
        queryBuilder.andWhere('institution.type = :type', { type: options.type });
      }

      if (options.lastScrapedBefore) {
        queryBuilder.andWhere('institution.lastScraped < :date', {
          date: options.lastScrapedBefore
        });
      }

      const startTime = Date.now();
      const results = await queryBuilder
        .orderBy('institution.lastScraped', 'ASC')
        .take(options.limit || 50)
        .skip(options.offset || 0)
        .cache(this.CACHE_TTL)
        .getMany();

      const duration = Date.now() - startTime;

      this.logger.info('findActiveInstitutions query completed', {
        count: results.length,
        duration,
        options
      });

      return results;
    } catch (error) {
      this.logger.error('Error in findActiveInstitutions', {
        options,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Updates rate limit configuration with validation and history tracking
   * @param id Institution ID
   * @param rateLimit New rate limit configuration
   * @returns Promise resolving to updated institution
   */
  @Transaction()
  async updateRateLimit(
    id: string,
    rateLimit: RateLimitConfig,
    @TransactionManager() manager?: QueryRunner
  ): Promise<Institution> {
    try {
      // Validate rate limit configuration
      this.validateRateLimit(rateLimit);

      const institution = await this.findOne({ where: { id } });
      if (!institution) {
        throw new Error(`Institution not found with id: ${id}`);
      }

      // Record previous configuration for history
      const previousConfig = { ...institution.rateLimit };

      // Update rate limit configuration
      institution.rateLimit = rateLimit;
      
      const updated = await manager?.manager.save(Institution, institution);

      this.logger.info('Rate limit configuration updated', {
        id,
        previousConfig,
        newConfig: rateLimit
      });

      return updated;
    } catch (error) {
      this.logger.error('Error updating rate limit', {
        id,
        rateLimit,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Updates scraper engine type with compatibility checks
   * @param id Institution ID
   * @param engineType New scraper engine type
   * @returns Promise resolving to updated institution
   */
  @Transaction()
  async updateScraperEngine(
    id: string,
    engineType: SCRAPER_ENGINES,
    @TransactionManager() manager?: QueryRunner
  ): Promise<Institution> {
    try {
      const institution = await this.findOne({ where: { id } });
      if (!institution) {
        throw new Error(`Institution not found with id: ${id}`);
      }

      // Verify engine compatibility
      this.verifyEngineCompatibility(institution, engineType);

      const previousEngine = institution.engineType;
      institution.engineType = engineType;

      const updated = await manager?.manager.save(Institution, institution);

      this.logger.info('Scraper engine updated', {
        id,
        previousEngine,
        newEngine: engineType
      });

      return updated;
    } catch (error) {
      this.logger.error('Error updating scraper engine', {
        id,
        engineType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Normalizes URL for consistent comparison
   * @param url URL to normalize
   * @returns Normalized URL string
   */
  private normalizeUrl(url: string): string {
    return url.toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/$/, '');
  }

  /**
   * Validates rate limit configuration
   * @param config Rate limit configuration to validate
   * @throws Error if configuration is invalid
   */
  private validateRateLimit(config: RateLimitConfig): void {
    if (config.requestsPerSecond <= 0) {
      throw new Error('requestsPerSecond must be greater than 0');
    }
    if (config.burstLimit < config.requestsPerSecond) {
      throw new Error('burstLimit must be greater than or equal to requestsPerSecond');
    }
    if (config.cooldownPeriod < 0) {
      throw new Error('cooldownPeriod must be non-negative');
    }
  }

  /**
   * Verifies compatibility between institution and scraper engine
   * @param institution Institution to verify
   * @param engineType Scraper engine type to verify
   * @throws Error if engine is incompatible
   */
  private verifyEngineCompatibility(
    institution: Institution,
    engineType: SCRAPER_ENGINES
  ): void {
    // Verify Selenium compatibility for Federal Labs
    if (institution.type === InstitutionType.FEDERAL_LAB &&
        engineType !== SCRAPER_ENGINES.SELENIUM) {
      throw new Error('Federal labs require Selenium scraper engine');
    }

    // Verify Scrapy compatibility for paginated content
    if (institution.selectors?.pagination &&
        engineType !== SCRAPER_ENGINES.SCRAPY) {
      throw new Error('Paginated content requires Scrapy scraper engine');
    }
  }
}