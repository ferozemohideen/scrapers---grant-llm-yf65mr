/**
 * @fileoverview Comprehensive test suite for validation utility functions
 * Tests URL configurations, user credentials, and grant proposal validations
 * with extensive security and data integrity checks.
 * @version 1.0.0
 */

import { describe, test, expect } from '@jest/globals';
import {
  validateURL,
  validateURLConfig,
  validateCredentials,
  validateProposal
} from '../../src/utils/validation.util';
import { InstitutionType } from '../../src/interfaces/config.interface';
import { ProposalStatus } from '../../src/interfaces/grant.interface';

describe('validateURL', () => {
  test('should validate correct HTTPS URLs', () => {
    const result = validateURL('https://techfinder.stanford.edu/');
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should reject HTTP URLs', () => {
    const result = validateURL('http://techfinder.stanford.edu/');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('URL must use HTTPS protocol');
  });

  test('should reject malformed URLs', () => {
    const result = validateURL('not-a-url');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid URL format. Must be a valid HTTPS URL');
  });

  test('should validate URL length constraints', () => {
    const tooShortUrl = 'https://t';
    const result = validateURL(tooShortUrl);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(`URL must be at least ${10} characters long`);
  });

  test('should handle empty URLs', () => {
    const result = validateURL('');
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('URL cannot be empty');
  });
});

describe('validateURLConfig', () => {
  const validConfig = {
    url: 'https://techfinder.stanford.edu/',
    institution: {
      name: 'Stanford University',
      type: InstitutionType.US_UNIVERSITY,
      country: 'USA',
      metadata: {
        contactEmail: 'contact@stanford.edu',
        apiKeyEnv: 'STANFORD_API_KEY',
        refreshInterval: 14
      }
    },
    scraping: {
      selectors: {
        title: '.tech-title',
        description: '.tech-description',
        pagination: '.pagination',
        custom: {}
      },
      rateLimit: 2,
      retryConfig: {
        maxAttempts: 3,
        backoffMs: 1000
      }
    },
    active: true,
    lastUpdated: new Date()
  };

  test('should validate correct URL configuration', () => {
    const result = validateURLConfig(validConfig);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate institution configuration', () => {
    const invalidConfig = {
      ...validConfig,
      institution: {
        ...validConfig.institution,
        name: ''
      }
    };
    const result = validateURLConfig(invalidConfig);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Institution name is required');
  });

  test('should validate scraping configuration', () => {
    const invalidConfig = {
      ...validConfig,
      scraping: {
        ...validConfig.scraping,
        rateLimit: 0
      }
    };
    const result = validateURLConfig(invalidConfig);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Rate limit must be between 1 and 10 requests per second');
  });

  test('should validate selectors configuration', () => {
    const invalidConfig = {
      ...validConfig,
      scraping: {
        ...validConfig.scraping,
        selectors: {
          ...validConfig.scraping.selectors,
          title: ''
        }
      }
    };
    const result = validateURLConfig(invalidConfig);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Title selector is required');
  });
});

describe('validateCredentials', () => {
  test('should validate correct credentials', () => {
    const credentials = {
      email: 'user@example.com',
      password: 'SecurePass123!@'
    };
    const result = validateCredentials(credentials);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate email format', () => {
    const credentials = {
      email: 'invalid-email',
      password: 'SecurePass123!@'
    };
    const result = validateCredentials(credentials);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Invalid email format');
  });

  test('should validate password complexity', () => {
    const credentials = {
      email: 'user@example.com',
      password: 'simple'
    };
    const result = validateCredentials(credentials);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Password must be at least 12 characters long');
    expect(result.errors).toContain('Password must contain at least one uppercase letter');
    expect(result.errors).toContain('Password must contain at least one number');
    expect(result.errors).toContain('Password must contain at least one special character');
  });

  test('should handle missing credentials', () => {
    const result = validateCredentials({} as any);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Email is required');
    expect(result.errors).toContain('Password is required');
  });
});

describe('validateProposal', () => {
  const validProposal = {
    id: '123',
    userId: 'user123',
    technologyId: 'tech123',
    content: 'A'.repeat(1000),
    version: 1,
    status: ProposalStatus.DRAFT,
    metadata: {
      title: 'Research Proposal',
      institution: 'Stanford University',
      department: 'Computer Science',
      fundingAmount: 50000,
      submissionDeadline: new Date(Date.now() + 86400000),
      collaborators: ['user1', 'user2'],
      keywords: ['AI', 'ML'],
      grantType: 'Research'
    },
    createdAt: new Date(),
    updatedAt: new Date()
  };

  test('should validate correct proposal', () => {
    const result = validateProposal(validProposal);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should validate content length', () => {
    const shortProposal = {
      ...validProposal,
      content: 'Too short'
    };
    const result = validateProposal(shortProposal);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain(`Proposal content must be at least 1000 characters`);
  });

  test('should validate funding amount', () => {
    const invalidProposal = {
      ...validProposal,
      metadata: {
        ...validProposal.metadata,
        fundingAmount: 100
      }
    };
    const result = validateProposal(invalidProposal);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Funding amount must be between 1000 and 10000000');
  });

  test('should validate submission deadline', () => {
    const pastDeadlineProposal = {
      ...validProposal,
      metadata: {
        ...validProposal.metadata,
        submissionDeadline: new Date(Date.now() - 86400000)
      }
    };
    const result = validateProposal(pastDeadlineProposal);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Submission deadline cannot be in the past');
  });

  test('should validate required metadata', () => {
    const invalidProposal = {
      ...validProposal,
      metadata: {
        ...validProposal.metadata,
        title: ''
      }
    };
    const result = validateProposal(invalidProposal);
    expect(result.isValid).toBe(false);
    expect(result.errors).toContain('Proposal title is required');
  });
});