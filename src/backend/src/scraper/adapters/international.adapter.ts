/**
 * @fileoverview Specialized adapter for scraping international university technology transfer offices
 * with enhanced language support, regional handling, and international-specific error handling.
 * @version 1.0.0
 */

import { BaseAdapter } from './base.adapter';
import {
  ScraperEngine,
  ScraperJob,
  ScraperResult,
  RateLimitConfig,
  ValidationResults
} from '../../interfaces/scraper.interface';
import { SCRAPER_RATE_LIMITS } from '../../constants/scraper.constants';
import { AppError, handleError } from '../../utils/error.util';
import * as cheerio from 'cheerio'; // v1.0.0
import * as languageDetect from 'language-detect'; // v1.1.0

/**
 * Specialized adapter for international institution scraping with enhanced language
 * and regional support capabilities
 */
export class InternationalAdapter extends BaseAdapter {
  private readonly languageMap: Map<string, string>;
  private readonly regionalDateFormats: Map<string, RegExp>;
  private readonly characterSetMap: Map<string, string>;
  private readonly timeZoneMap: Map<string, string>;

  /**
   * Initialize the international adapter with enhanced configurations
   */
  constructor(engine: ScraperEngine) {
    super(
      engine,
      SCRAPER_RATE_LIMITS.INTERNATIONAL_UNIVERSITIES,
      {
        scrapeCounter: null,
        scrapeDurationHistogram: null,
        errorCounter: null,
        rateLimitCounter: null
      }
    );

    // Initialize language mapping
    this.languageMap = new Map([
      ['en', 'english'],
      ['de', 'german'],
      ['fr', 'french'],
      ['es', 'spanish'],
      ['it', 'italian'],
      ['ja', 'japanese'],
      ['zh', 'chinese'],
      ['ko', 'korean']
    ]);

    // Initialize regional date formats
    this.regionalDateFormats = new Map([
      ['eu', /^(\d{1,2})[.-/](\d{1,2})[.-/](\d{4})$/],
      ['us', /^(\d{4})[.-/](\d{1,2})[.-/](\d{1,2})$/],
      ['asia', /^(\d{4})年(\d{1,2})月(\d{1,2})日$/]
    ]);

    // Initialize character set mapping
    this.characterSetMap = new Map([
      ['ja', 'shift-jis'],
      ['zh', 'gb2312'],
      ['ko', 'euc-kr'],
      ['default', 'utf-8']
    ]);

    // Initialize timezone mapping
    this.timeZoneMap = new Map([
      ['eu', 'Europe/London'],
      ['asia', 'Asia/Tokyo'],
      ['oceania', 'Australia/Sydney']
    ]);
  }

  /**
   * Enhanced validation for international institution-specific job parameters
   */
  protected validateJob(job: ScraperJob): ValidationResults {
    const baseValidation = super.validateJob(job);
    if (!baseValidation.isValid) {
      return baseValidation;
    }

    const errors: Array<{ field: string; rule: string; message: string }> = [];
    const warnings: Array<{ field: string; message: string }> = [];

    // Validate international-specific requirements
    if (!job.config.selectors.language) {
      warnings.push({
        field: 'selectors.language',
        message: 'Language selector not specified, will attempt auto-detection'
      });
    }

    if (!job.config.headers?.['Accept-Language']) {
      warnings.push({
        field: 'headers.Accept-Language',
        message: 'Accept-Language header not specified, using default'
      });
    }

    // Validate character set configuration
    if (!job.config.headers?.['Accept-Charset']) {
      warnings.push({
        field: 'headers.Accept-Charset',
        message: 'Accept-Charset header not specified, using default UTF-8'
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Executes scraping operation with comprehensive international support
   */
  public async scrape(job: ScraperJob): Promise<ScraperResult> {
    try {
      // Enhance job configuration with international defaults
      this.enhanceJobConfig(job);

      // Execute base scraping
      const result = await super.scrape(job);

      if (result.success) {
        // Post-process international data
        const enhancedData = await this.processInternationalData(result.data, job);
        return {
          ...result,
          data: enhancedData
        };
      }

      return result;
    } catch (error) {
      const handledError = await this.handleInternationalError(error, job);
      return handledError;
    }
  }

  /**
   * Enhances job configuration with international-specific settings
   */
  private enhanceJobConfig(job: ScraperJob): void {
    const region = this.detectRegion(job.url);
    
    // Set default headers if not specified
    job.config.headers = {
      'Accept-Language': '*',
      'Accept-Charset': this.characterSetMap.get('default'),
      ...job.config.headers
    };

    // Set region-specific rate limits
    job.rateLimitConfig = {
      ...SCRAPER_RATE_LIMITS.INTERNATIONAL_UNIVERSITIES,
      cooldownPeriod: this.getRegionalCooldown(region)
    };
  }

  /**
   * Processes scraped data with international enhancements
   */
  private async processInternationalData(
    data: Record<string, any>,
    job: ScraperJob
  ): Promise<Record<string, any>> {
    const $ = cheerio.load(data.html);
    const detectedLanguage = await this.detectLanguage($);
    
    return {
      ...data,
      metadata: {
        ...data.metadata,
        language: detectedLanguage,
        region: this.detectRegion(job.url),
        timezone: this.getRegionalTimezone(job.url),
        encoding: this.getCharacterSet(detectedLanguage)
      },
      content: this.normalizeInternationalContent(data.content, detectedLanguage)
    };
  }

  /**
   * Detects content language using multiple strategies
   */
  private async detectLanguage($: cheerio.CheerioAPI): Promise<string> {
    // Try HTML lang attribute
    const htmlLang = $('html').attr('lang');
    if (htmlLang && this.languageMap.has(htmlLang.split('-')[0])) {
      return htmlLang.split('-')[0];
    }

    // Try meta tags
    const metaLang = $('meta[http-equiv="content-language"]').attr('content');
    if (metaLang && this.languageMap.has(metaLang.split('-')[0])) {
      return metaLang.split('-')[0];
    }

    // Use language detection on content
    const text = $('body').text().slice(0, 1000);
    const detected = await languageDetect.detect(text);
    return detected?.iso6391 || 'en';
  }

  /**
   * Detects region from URL and institutional patterns
   */
  private detectRegion(url: string): string {
    const tld = new URL(url).hostname.split('.').pop();
    const regionMap: Record<string, string> = {
      uk: 'eu',
      de: 'eu',
      fr: 'eu',
      jp: 'asia',
      cn: 'asia',
      kr: 'asia',
      au: 'oceania',
      nz: 'oceania'
    };
    return regionMap[tld] || 'other';
  }

  /**
   * Gets region-specific character set
   */
  private getCharacterSet(language: string): string {
    return this.characterSetMap.get(language) || this.characterSetMap.get('default');
  }

  /**
   * Gets region-specific timezone
   */
  private getRegionalTimezone(url: string): string {
    const region = this.detectRegion(url);
    return this.timeZoneMap.get(region) || 'UTC';
  }

  /**
   * Calculates region-specific cooldown period
   */
  private getRegionalCooldown(region: string): number {
    const baseCooldown = SCRAPER_RATE_LIMITS.INTERNATIONAL_UNIVERSITIES.cooldownPeriod;
    const regionMultipliers: Record<string, number> = {
      eu: 1.5,
      asia: 2,
      oceania: 1.2,
      other: 1
    };
    return baseCooldown * (regionMultipliers[region] || 1);
  }

  /**
   * Normalizes international content with regional considerations
   */
  private normalizeInternationalContent(
    content: Record<string, any>,
    language: string
  ): Record<string, any> {
    return {
      ...content,
      dates: this.normalizeDates(content.dates, language),
      text: this.normalizeText(content.text, language)
    };
  }

  /**
   * Handles international-specific errors
   */
  private async handleInternationalError(
    error: Error,
    job: ScraperJob
  ): Promise<ScraperResult> {
    const region = this.detectRegion(job.url);
    const { error: handledError, retryable } = handleError(error, {
      region,
      language: await this.detectLanguage(cheerio.load('')),
      ...job
    });

    return {
      jobId: job.id,
      url: job.url,
      data: {},
      timestamp: new Date(),
      success: false,
      rateLimitMetrics: this.rateLimitMetrics,
      performanceMetrics: this.performanceMetrics,
      validationResults: {
        isValid: false,
        errors: [{
          field: 'international',
          rule: 'processing',
          message: handledError.message
        }],
        warnings: []
      }
    };
  }

  /**
   * Normalizes dates to ISO format considering regional formats
   */
  private normalizeDates(dates: string[], language: string): string[] {
    return dates.map(date => {
      for (const [region, format] of this.regionalDateFormats) {
        if (format.test(date)) {
          const matches = date.match(format);
          if (matches) {
            const [_, year, month, day] = matches;
            return new Date(
              parseInt(year),
              parseInt(month) - 1,
              parseInt(day)
            ).toISOString();
          }
        }
      }
      return date;
    });
  }

  /**
   * Normalizes text content considering language-specific patterns
   */
  private normalizeText(text: string, language: string): string {
    // Remove language-specific punctuation and normalize spaces
    return text
      .replace(/[\u3000-\u303F]/g, ' ') // CJK punctuation
      .replace(/\s+/g, ' ')
      .trim();
  }
}