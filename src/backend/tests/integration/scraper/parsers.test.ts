/**
 * @fileoverview Integration tests for HTML and PDF parsers to verify correct data extraction,
 * error handling, and validation functionality in real-world scenarios.
 * @version 1.0.0
 */

import { HTMLParser } from '../../src/scraper/parsers/html.parser';
import { PDFParser } from '../../src/scraper/parsers/pdf.parser';
import { ERROR_TYPES } from '../../src/constants/scraper.constants';
import { promises as fs } from 'fs'; // v18.0.0
import * as path from 'path'; // v18.0.0
import now from 'performance-now'; // v2.1.0

// Test fixtures path
const FIXTURES_PATH = path.join(__dirname, '../../../fixtures');

describe('HTML Parser Integration Tests', () => {
  let parser: HTMLParser;
  let sampleHTML: string;

  beforeAll(async () => {
    // Load sample HTML fixture
    sampleHTML = await fs.readFile(
      path.join(FIXTURES_PATH, 'sample_tech_page.html'),
      'utf-8'
    );
  });

  beforeEach(() => {
    parser = new HTMLParser({
      selectors: {
        title: '.tech-title',
        description: '.tech-description',
        inventors: '.inventor-list li',
        categories: '.tech-categories span'
      },
      validateSelectors: true,
      throwOnError: false,
      institutionSpecificRules: {
        title: {
          validation: (elements: any) => ({
            isValid: elements.length === 1,
            message: 'Title must be unique'
          })
        }
      }
    });
  });

  describe('Institution-specific parsing validation', () => {
    test('should correctly apply institution-specific selector rules', async () => {
      const result = await parser.parse(sampleHTML);
      expect(result.success).toBe(true);
      expect(result.data.title).toBeDefined();
      expect(result.validationResults.validationErrors).toHaveLength(0);
    });

    test('should handle invalid institution-specific rules gracefully', async () => {
      const invalidParser = new HTMLParser({
        selectors: {
          title: '.non-existent'
        },
        institutionSpecificRules: {
          title: {
            validation: () => ({
              isValid: false,
              message: 'Custom validation failed'
            })
          }
        }
      });

      const result = await invalidParser.parse(sampleHTML);
      expect(result.success).toBe(false);
      expect(result.validationResults.validationErrors).toHaveLength(1);
      expect(result.validationResults.validationErrors[0].type).toBe(ERROR_TYPES.VALIDATION_ERROR);
    });
  });

  describe('Performance validation', () => {
    test('should parse HTML within acceptable time limits', async () => {
      const start = now();
      const result = await parser.parse(sampleHTML);
      const duration = now() - start;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(result.metrics.totalDuration).toBeLessThan(1000);
      expect(result.metrics.successRate).toBe(100);
    });

    test('should handle large HTML documents efficiently', async () => {
      const largeHTML = await fs.readFile(
        path.join(FIXTURES_PATH, 'large_tech_page.html'),
        'utf-8'
      );

      const result = await parser.parse(largeHTML);
      expect(result.success).toBe(true);
      expect(result.metrics.totalElements).toBeGreaterThan(100);
      expect(result.metrics.successfulExtractions).toBe(result.metrics.totalElements);
    });
  });
});

describe('PDF Parser Integration Tests', () => {
  let parser: PDFParser;
  let samplePDF: Buffer;

  beforeAll(async () => {
    // Load sample PDF fixture
    samplePDF = await fs.readFile(
      path.join(FIXTURES_PATH, 'sample_tech_doc.pdf')
    );
  });

  beforeEach(() => {
    parser = new PDFParser({
      extractMetadata: true,
      throwOnError: false,
      timeout: 30000,
      maxFileSize: 50 * 1024 * 1024,
      enableStreaming: true,
      securityOptions: {
        allowEncrypted: false,
        maxPages: 1000,
        allowExternalLinks: false,
        allowJavaScript: false
      }
    });
  });

  describe('Advanced PDF processing', () => {
    test('should correctly extract text and metadata from PDF', async () => {
      const result = await parser.parse(samplePDF);
      
      expect(result.success).toBe(true);
      expect(result.text).toBeTruthy();
      expect(result.metadata).toBeDefined();
      expect(result.metadata.title).toBeTruthy();
      expect(result.metadata.pageCount).toBeGreaterThan(0);
    });

    test('should handle streaming parse for large PDFs', async () => {
      const largePDF = await fs.readFile(
        path.join(FIXTURES_PATH, 'large_tech_doc.pdf')
      );

      const result = await parser.parse(largePDF);
      expect(result.success).toBe(true);
      expect(result.metrics.memoryUsage).toBeDefined();
      expect(result.validation.isValid).toBe(true);
    });

    test('should enforce security constraints', async () => {
      const encryptedPDF = await fs.readFile(
        path.join(FIXTURES_PATH, 'encrypted_doc.pdf')
      );

      const result = await parser.parse(encryptedPDF);
      expect(result.success).toBe(false);
      expect(result.errors[0].type).toBe(ERROR_TYPES.SECURITY_ERROR);
      expect(result.validation.securityChecks.isEncrypted).toBe(true);
    });
  });

  describe('Error recovery scenarios', () => {
    test('should handle corrupted PDFs gracefully', async () => {
      const corruptedPDF = await fs.readFile(
        path.join(FIXTURES_PATH, 'corrupted_doc.pdf')
      );

      const result = await parser.parse(corruptedPDF);
      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].type).toBe(ERROR_TYPES.PARSE_ERROR);
    });

    test('should respect file size limits', async () => {
      const oversizedPDF = Buffer.alloc(100 * 1024 * 1024); // 100MB
      const result = await parser.parse(oversizedPDF);
      
      expect(result.success).toBe(false);
      expect(result.errors[0].type).toBe(ERROR_TYPES.VALIDATION_ERROR);
      expect(result.errors[0].message).toContain('exceeds maximum size limit');
    });

    test('should handle timeout scenarios', async () => {
      const timeoutParser = new PDFParser({
        timeout: 1, // Unreasonably short timeout
        throwOnError: false
      });

      const result = await timeoutParser.parse(samplePDF);
      expect(result.success).toBe(false);
      expect(result.errors[0].message).toContain('timeout');
    });
  });
});