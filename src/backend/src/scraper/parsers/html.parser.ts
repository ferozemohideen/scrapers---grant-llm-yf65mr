/**
 * @fileoverview Advanced HTML parser implementation for extracting structured data from web pages
 * using CSS selectors. Provides comprehensive validation, error handling, and performance monitoring
 * for HTML content parsing across 375+ institutions.
 * @version 1.0.0
 */

import * as cheerio from 'cheerio'; // v1.0.0-rc.12
import { ERROR_TYPES } from '../../constants/scraper.constants';
import { ScraperError } from '../../interfaces/scraper.interface';

/**
 * Enhanced configuration options for HTML parser with institution-specific settings
 */
export interface HTMLParserOptions {
  selectors: Record<string, string>;
  validateSelectors?: boolean;
  throwOnError?: boolean;
  maxRetries?: number;
  institutionSpecificRules?: Record<string, any>;
  collectMetrics?: boolean;
}

/**
 * Enhanced structure of parsed HTML data with metrics
 */
export interface ParsedHTMLResult {
  data: Record<string, string | string[]>;
  success: boolean;
  errors: ScraperError[];
  metrics: Record<string, number>;
  validationResults: {
    invalidSelectors: string[];
    emptyResults: string[];
    validationErrors: ScraperError[];
  };
}

/**
 * Enhanced parser class for extracting structured data from HTML content
 * with comprehensive validation and metrics
 */
export class HTMLParser {
  private readonly selectors: Record<string, string>;
  private readonly validateSelectors: boolean;
  private readonly throwOnError: boolean;
  private readonly maxRetries: number;
  private readonly institutionRules: Record<string, any>;
  private readonly metrics: Record<string, number>;

  /**
   * Initializes enhanced HTML parser with comprehensive configuration
   * @param options Parser configuration options
   */
  constructor(options: HTMLParserOptions) {
    this.validateOptions(options);
    this.selectors = options.selectors;
    this.validateSelectors = options.validateSelectors ?? true;
    this.throwOnError = options.throwOnError ?? false;
    this.maxRetries = options.maxRetries ?? 3;
    this.institutionRules = options.institutionSpecificRules ?? {};
    this.metrics = {
      parseStartTime: 0,
      parseEndTime: 0,
      totalElements: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      validationTime: 0,
    };
  }

  /**
   * Enhanced HTML content parsing with metrics and validation
   * @param html Raw HTML content to parse
   * @returns Parsed data with comprehensive metrics and validation results
   */
  public async parse(html: string): Promise<ParsedHTMLResult> {
    this.metrics.parseStartTime = Date.now();
    const errors: ScraperError[] = [];
    const result: ParsedHTMLResult = {
      data: {},
      success: false,
      errors: [],
      metrics: {},
      validationResults: {
        invalidSelectors: [],
        emptyResults: [],
        validationErrors: [],
      },
    };

    try {
      // Sanitize input HTML
      if (!html || typeof html !== 'string') {
        throw this.createError(ERROR_TYPES.VALIDATION_ERROR, 'Invalid HTML input');
      }

      // Load HTML content into cheerio
      const $ = cheerio.load(html, {
        decodeEntities: true,
        xmlMode: false,
        lowerCaseTags: true,
      });

      // Validate selectors if enabled
      if (this.validateSelectors) {
        const validationErrors = this.validateSelectorsWithCheerio($);
        result.validationResults.validationErrors = validationErrors;
        if (validationErrors.length > 0 && this.throwOnError) {
          throw validationErrors[0];
        }
      }

      // Extract data using optimized selectors
      for (const [key, selector] of Object.entries(this.selectors)) {
        try {
          this.metrics.totalElements++;
          const elements = $(selector);
          
          if (elements.length === 0) {
            result.validationResults.emptyResults.push(key);
            continue;
          }

          // Apply institution-specific rules if available
          const value = this.applyInstitutionRules(key, elements, $);
          result.data[key] = value;
          this.metrics.successfulExtractions++;
        } catch (error) {
          this.metrics.failedExtractions++;
          errors.push(this.createError(
            ERROR_TYPES.PARSE_ERROR,
            `Failed to extract ${key}: ${error.message}`,
            { selector, key }
          ));
        }
      }

      // Update success status
      result.success = this.metrics.failedExtractions === 0;

    } catch (error) {
      errors.push(this.createError(
        ERROR_TYPES.PARSE_ERROR,
        `HTML parsing failed: ${error.message}`
      ));
    } finally {
      // Finalize metrics
      this.metrics.parseEndTime = Date.now();
      result.metrics = {
        ...this.metrics,
        totalDuration: this.metrics.parseEndTime - this.metrics.parseStartTime,
        successRate: (this.metrics.successfulExtractions / this.metrics.totalElements) * 100,
      };
      result.errors = errors;
    }

    return result;
  }

  /**
   * Enhanced selector validation with detailed reporting
   * @param $ Cheerio instance
   * @returns Array of validation errors
   */
  private validateSelectorsWithCheerio($: cheerio.CheerioAPI): ScraperError[] {
    const errors: ScraperError[] = [];

    for (const [key, selector] of Object.entries(this.selectors)) {
      try {
        // Validate selector syntax
        if (!selector || typeof selector !== 'string') {
          errors.push(this.createError(
            ERROR_TYPES.VALIDATION_ERROR,
            `Invalid selector syntax for ${key}`,
            { selector }
          ));
          continue;
        }

        // Test selector effectiveness
        const elements = $(selector);
        if (elements.length === 0) {
          errors.push(this.createError(
            ERROR_TYPES.CONTENT_ERROR,
            `Selector ${key} found no elements`,
            { selector }
          ));
        }

        // Apply institution-specific validation rules
        if (this.institutionRules[key]?.validation) {
          const validationResult = this.institutionRules[key].validation(elements, $);
          if (!validationResult.isValid) {
            errors.push(this.createError(
              ERROR_TYPES.VALIDATION_ERROR,
              validationResult.message,
              { selector, key }
            ));
          }
        }
      } catch (error) {
        errors.push(this.createError(
          ERROR_TYPES.VALIDATION_ERROR,
          `Selector validation failed for ${key}: ${error.message}`,
          { selector }
        ));
      }
    }

    return errors;
  }

  /**
   * Applies institution-specific rules to extracted elements
   * @param key Selector key
   * @param elements Cheerio elements
   * @param $ Cheerio instance
   * @returns Processed value
   */
  private applyInstitutionRules(
    key: string,
    elements: cheerio.Cheerio,
    $: cheerio.CheerioAPI
  ): string | string[] {
    const rules = this.institutionRules[key];
    if (!rules) {
      return elements.length === 1 ? elements.text().trim() : elements.map((_, el) => $(el).text().trim()).get();
    }

    if (typeof rules.transform === 'function') {
      return rules.transform(elements, $);
    }

    if (rules.multiValue) {
      return elements.map((_, el) => $(el).text().trim()).get();
    }

    return elements.first().text().trim();
  }

  /**
   * Validates parser configuration options
   * @param options Parser options to validate
   */
  private validateOptions(options: HTMLParserOptions): void {
    if (!options || typeof options !== 'object') {
      throw new Error('Invalid parser options');
    }

    if (!options.selectors || typeof options.selectors !== 'object') {
      throw new Error('Selectors configuration is required');
    }

    if (Object.keys(options.selectors).length === 0) {
      throw new Error('At least one selector must be specified');
    }
  }

  /**
   * Creates a standardized scraper error
   * @param type Error type
   * @param message Error message
   * @param context Additional error context
   * @returns Formatted scraper error
   */
  private createError(
    type: ERROR_TYPES,
    message: string,
    context: Record<string, any> = {}
  ): ScraperError {
    return {
      type,
      message,
      retryAttempt: 0,
      context: {
        timestamp: new Date().toISOString(),
        ...context,
      },
    };
  }
}