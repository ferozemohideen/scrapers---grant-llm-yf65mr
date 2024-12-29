/**
 * @fileoverview Comprehensive test suite for validation utilities
 * @version 1.0.0
 */

import { 
  validateURL, 
  validateInstitution, 
  validateScraperConfig 
} from '../../src/utils/validation.util';

import {
  URL_VALIDATION_PATTERNS,
  INSTITUTION_VALIDATION_RULES,
  SCRAPER_VALIDATION_RULES
} from '../../src/constants/validation.constants';

import { ERROR_TYPES } from '../../src/constants/error.constants';
import { performance } from 'perf_hooks';

// Test suite for URL validation
describe('validateURL', () => {
  // Valid URL test cases
  it('should validate correct HTTPS URLs', () => {
    const validURLs = [
      'https://techfinder.stanford.edu',
      'https://innovation.ox.ac.uk/technologies-available',
      'https://technology.nasa.gov/patents'
    ];

    validURLs.forEach(url => {
      const result = validateURL(url);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.metrics).toBeDefined();
      expect(result.metrics.executionTime).toBeLessThan(100); // Performance threshold
    });
  });

  // Invalid URL test cases
  it('should reject invalid URLs', () => {
    const invalidURLs = [
      'not-a-url',
      'ftp://invalid-protocol.com',
      'http://ip-address-not-allowed.123.123.123.123',
      'https://' + 'a'.repeat(URL_VALIDATION_PATTERNS.SECURITY_CHECKS.maxLength + 1)
    ];

    invalidURLs.forEach(url => {
      const result = validateURL(url);
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].code).toBe(ERROR_TYPES.VALIDATION_ERROR);
    });
  });

  // Security pattern tests
  it('should enforce security patterns', () => {
    const securityTestURLs = [
      'http://unsecure-protocol.com', // HTTP not allowed
      'https://192.168.1.1', // IP address not allowed
      'https://valid.com/<script>' // Special characters not allowed
    ];

    securityTestURLs.forEach(url => {
      const result = validateURL(url);
      expect(result.isValid).toBe(false);
      expect(result.errors[0].code).toBe(ERROR_TYPES.VALIDATION_ERROR);
    });
  });

  // Performance benchmarking
  it('should validate URLs within performance thresholds', () => {
    const testURL = 'https://techfinder.stanford.edu';
    const iterations = 1000;
    const results: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      validateURL(testURL);
      results.push(performance.now() - start);
    }

    const avgTime = results.reduce((a, b) => a + b) / iterations;
    expect(avgTime).toBeLessThan(1); // Average validation under 1ms
  });
});

// Test suite for institution validation
describe('validateInstitution', () => {
  // Valid institution configuration test
  it('should validate correct institution configurations', () => {
    const validInstitution = {
      name: 'Stanford University',
      url: 'https://techfinder.stanford.edu',
      type: 'us_university',
      active: true,
      selectors: {
        title: '.tech-title',
        description: '.tech-description'
      },
      rate_limit: 2
    };

    const result = validateInstitution(validInstitution);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Invalid institution name tests
  it('should validate institution name constraints', () => {
    const invalidNames = [
      '', // Empty name
      'A', // Too short
      'A'.repeat(INSTITUTION_VALIDATION_RULES.NAME_CONSTRAINTS.maxLength + 1), // Too long
      'Invalid@Name#' // Invalid characters
    ];

    invalidNames.forEach(name => {
      const result = validateInstitution({
        name,
        url: 'https://test.edu',
        type: 'us_university',
        active: true
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'name')).toBe(true);
    });
  });

  // Rate limit validation tests
  it('should validate rate limits per institution type', () => {
    const testCases = [
      {
        type: 'us_university',
        rate_limit: SCRAPER_VALIDATION_RULES.RATE_LIMITS.maxRequestsPerSecond.us_university + 1,
        shouldPass: false
      },
      {
        type: 'international_university',
        rate_limit: SCRAPER_VALIDATION_RULES.RATE_LIMITS.maxRequestsPerSecond.international_university,
        shouldPass: true
      }
    ];

    testCases.forEach(({ type, rate_limit, shouldPass }) => {
      const result = validateInstitution({
        name: 'Test Institution',
        url: 'https://test.edu',
        type,
        active: true,
        rate_limit
      });
      expect(result.isValid).toBe(shouldPass);
    });
  });
});

// Test suite for scraper configuration validation
describe('validateScraperConfig', () => {
  // Valid scraper configuration test
  it('should validate correct scraper configurations', () => {
    const validConfig = {
      selector_type: 'css',
      rate_limit: SCRAPER_VALIDATION_RULES.RATE_LIMITS.minDelay,
      retry_attempts: SCRAPER_VALIDATION_RULES.RETRY_POLICY.maxAttempts,
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    };

    const result = validateScraperConfig(validConfig);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Selector type validation tests
  it('should validate selector types', () => {
    const invalidSelectorTypes = ['invalid', 'jquery', ''];
    
    invalidSelectorTypes.forEach(selector_type => {
      const result = validateScraperConfig({
        selector_type,
        rate_limit: 1000,
        retry_attempts: 3,
        timeout: 5000
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.field === 'selector_type')).toBe(true);
    });
  });

  // Rate limit and retry policy tests
  it('should validate rate limits and retry policies', () => {
    const testCases = [
      {
        config: {
          selector_type: 'css',
          rate_limit: SCRAPER_VALIDATION_RULES.RATE_LIMITS.minDelay - 1, // Too low
          retry_attempts: 3,
          timeout: 5000
        },
        shouldPass: false
      },
      {
        config: {
          selector_type: 'css',
          rate_limit: 1000,
          retry_attempts: SCRAPER_VALIDATION_RULES.RETRY_POLICY.maxAttempts + 1, // Too many retries
          timeout: 5000
        },
        shouldPass: false
      }
    ];

    testCases.forEach(({ config, shouldPass }) => {
      const result = validateScraperConfig(config);
      expect(result.isValid).toBe(shouldPass);
    });
  });

  // Header validation tests
  it('should validate custom headers', () => {
    const invalidHeaders = {
      selector_type: 'css',
      rate_limit: 1000,
      retry_attempts: 3,
      timeout: 5000,
      headers: {
        'Invalid-Header': 123, // Non-string value
        'Valid-Header': 'valid'
      }
    };

    const result = validateScraperConfig(invalidHeaders);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field.startsWith('headers.'))).toBe(true);
  });
});