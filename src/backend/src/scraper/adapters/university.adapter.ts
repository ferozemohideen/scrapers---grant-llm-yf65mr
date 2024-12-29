/**
 * @fileoverview Specialized adapter for scraping university technology transfer offices
 * with enhanced support for international universities and different website structures.
 * @version 1.0.0
 */

import { BaseAdapter } from './base.adapter';
import {
  ScraperEngine,
  ScraperJob,
  ScraperResult,
  RateLimitConfig,
  ValidationRules,
  ValidationResults
} from '../../interfaces/scraper.interface';
import {
  SCRAPER_ENGINES,
  ERROR_TYPES,
  SCRAPER_RATE_LIMITS
} from '../../constants/scraper.constants';
import { AppError } from '../../utils/error.util';
import * as cheerio from 'cheerio'; // v1.0.0-rc.12
import * as LanguageDetect from 'languagedetect'; // v2.1.1

/**
 * Interface for university-specific configuration
 */
interface UniversityConfig {
  type: 'US' | 'INTERNATIONAL';
  language?: string;
  selectors: {
    title: string;
    description: string;
    contact?: string;
    licensing?: string;
    pagination?: string;
  };
  dataValidation: ValidationRules;
}

/**
 * Specialized adapter for university technology transfer offices
 */
export class UniversityAdapter extends BaseAdapter {
  private readonly languageDetector: LanguageDetect;
  private readonly universityConfig: UniversityConfig;
  private readonly defaultSelectors: Record<string, string>;

  /**
   * Initialize the university adapter with enhanced configuration
   */
  constructor(
    engine: ScraperEngine,
    rateLimitConfig: RateLimitConfig,
    universityConfig: UniversityConfig
  ) {
    // Apply university-specific rate limits
    const rateLimit = universityConfig.type === 'US' 
      ? SCRAPER_RATE_LIMITS.US_UNIVERSITIES
      : SCRAPER_RATE_LIMITS.INTERNATIONAL_UNIVERSITIES;

    super(engine, {
      ...rateLimitConfig,
      ...rateLimit
    });

    this.universityConfig = universityConfig;
    this.languageDetector = new LanguageDetect();

    // Initialize default selectors
    this.defaultSelectors = {
      title: '.technology-title, .tech-title, h1',
      description: '.technology-description, .tech-description, .content',
      contact: '.contact-info, .contact',
      licensing: '.licensing-info, .license',
      pagination: '.pagination, .pager, nav.pages'
    };
  }

  /**
   * Execute university-specific scraping with enhanced error handling
   */
  public async scrape(job: ScraperJob): Promise<ScraperResult> {
    try {
      // Validate university-specific requirements
      this.validateUniversityJob(job);

      // Detect and handle international content
      const contentLanguage = await this.detectContentLanguage(job.url);
      if (contentLanguage && this.universityConfig.type === 'INTERNATIONAL') {
        job.config.headers = {
          ...job.config.headers,
          'Accept-Language': contentLanguage
        };
      }

      // Execute base scraping with university-specific handling
      const result = await super.scrape(job);

      // Process university-specific data
      if (result.success) {
        result.data = await this.processUniversityData(result.data);
        result.validationResults = this.validateUniversityData(result.data);
      }

      return result;

    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'University scraping failed',
        ERROR_TYPES.PARSE_ERROR,
        500,
        { url: job.url, universityType: this.universityConfig.type }
      );
    }
  }

  /**
   * Enhanced validation for university scraping jobs
   */
  private validateUniversityJob(job: ScraperJob): void {
    if (!job.url.includes('edu') && !job.url.includes('ac.')) {
      throw new AppError(
        'Invalid university URL format',
        ERROR_TYPES.VALIDATION_ERROR,
        400,
        { url: job.url }
      );
    }

    // Validate required selectors
    const requiredSelectors = ['title', 'description'];
    const missingSelectors = requiredSelectors.filter(
      selector => !this.universityConfig.selectors[selector]
    );

    if (missingSelectors.length > 0) {
      throw new AppError(
        'Missing required selectors',
        ERROR_TYPES.VALIDATION_ERROR,
        400,
        { missingSelectors }
      );
    }
  }

  /**
   * Process and normalize university-specific data
   */
  private async processUniversityData(rawData: Record<string, any>): Promise<Record<string, any>> {
    const $ = cheerio.load(rawData.html);
    const selectors = { ...this.defaultSelectors, ...this.universityConfig.selectors };

    const processedData = {
      title: $(selectors.title).first().text().trim(),
      description: $(selectors.description).first().text().trim(),
      contactInfo: selectors.contact ? $(selectors.contact).text().trim() : undefined,
      licensingDetails: selectors.licensing ? $(selectors.licensing).text().trim() : undefined,
      metadata: {
        university: this.universityConfig.type,
        language: this.universityConfig.language,
        scrapedAt: new Date().toISOString()
      }
    };

    // Clean and normalize data
    return Object.entries(processedData).reduce((acc, [key, value]) => {
      if (value && typeof value === 'string') {
        acc[key] = this.normalizeText(value);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
  }

  /**
   * Validate processed university data
   */
  private validateUniversityData(data: Record<string, any>): ValidationResults {
    const errors: Array<{ field: string; rule: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Validate required fields
    const { dataValidation } = this.universityConfig;
    
    dataValidation.required.forEach(field => {
      if (!data[field]) {
        errors.push({
          field,
          rule: 'required',
          message: `Missing required field: ${field}`
        });
      }
    });

    // Validate patterns
    Object.entries(dataValidation.patterns).forEach(([field, pattern]) => {
      if (data[field] && !pattern.test(data[field])) {
        warnings.push({
          field,
          message: `Field ${field} does not match expected pattern`
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Detect content language for international universities
   */
  private async detectContentLanguage(url: string): Promise<string | null> {
    if (this.universityConfig.type !== 'INTERNATIONAL') {
      return null;
    }

    try {
      const response = await fetch(url, { method: 'HEAD' });
      const contentLanguage = response.headers.get('content-language');
      
      if (contentLanguage) {
        return contentLanguage;
      }

      // Fallback to language detection from URL
      const urlLanguage = this.languageDetector.detect(url);
      return urlLanguage.length > 0 ? urlLanguage[0][0] : null;

    } catch (error) {
      console.warn('Language detection failed:', error);
      return null;
    }
  }

  /**
   * Normalize text content removing excess whitespace and special characters
   */
  private normalizeText(text: string): string {
    return text
      .replace(/[\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}