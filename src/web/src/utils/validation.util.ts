/**
 * @fileoverview Comprehensive validation utility module providing robust validation 
 * functions for URL configurations, authentication data, and grant proposals.
 * @version 1.0.0
 */

import { URLConfig, InstitutionType, ScrapingConfig } from '../interfaces/config.interface';
import { IUserCredentials } from '../interfaces/auth.interface';
import { IProposal, ProposalStatus } from '../interfaces/grant.interface';
import { isURL, isEmail } from 'validator'; // v13.7.0

/**
 * Interface defining the structure of validation results
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

/**
 * Constants for validation rules
 */
const VALIDATION_RULES = {
  URL: {
    PROTOCOLS: ['https'],
    MIN_LENGTH: 10,
    MAX_LENGTH: 2048
  },
  PASSWORD: {
    MIN_LENGTH: 12,
    REQUIRE_UPPERCASE: true,
    REQUIRE_LOWERCASE: true,
    REQUIRE_NUMBERS: true,
    REQUIRE_SPECIAL: true
  },
  PROPOSAL: {
    MIN_CONTENT_LENGTH: 1000,
    MAX_CONTENT_LENGTH: 50000,
    MIN_FUNDING_AMOUNT: 1000,
    MAX_FUNDING_AMOUNT: 10000000
  },
  RATE_LIMIT: {
    MIN: 1,
    MAX: 10
  }
} as const;

/**
 * Validates a URL string with enhanced security checks
 * @param url - URL string to validate
 * @returns ValidationResult with detailed error messages
 */
export function validateURL(url: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Basic sanitization
  const sanitizedUrl = url.trim();

  if (!sanitizedUrl) {
    errors.push('URL cannot be empty');
    return { isValid: false, errors, warnings };
  }

  // Length validation
  if (sanitizedUrl.length < VALIDATION_RULES.URL.MIN_LENGTH) {
    errors.push(`URL must be at least ${VALIDATION_RULES.URL.MIN_LENGTH} characters long`);
  }
  if (sanitizedUrl.length > VALIDATION_RULES.URL.MAX_LENGTH) {
    errors.push(`URL exceeds maximum length of ${VALIDATION_RULES.URL.MAX_LENGTH} characters`);
  }

  // Format validation using validator.js
  if (!isURL(sanitizedUrl, {
    protocols: VALIDATION_RULES.URL.PROTOCOLS,
    require_protocol: true,
    require_valid_protocol: true,
    require_tld: true
  })) {
    errors.push('Invalid URL format. Must be a valid HTTPS URL');
  }

  // Additional security checks
  if (!sanitizedUrl.startsWith('https://')) {
    errors.push('URL must use HTTPS protocol');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates complete URL configuration with enhanced security and performance features
 * @param config - URL configuration object to validate
 * @returns ValidationResult with detailed feedback
 */
export function validateURLConfig(config: URLConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate base URL
  const urlValidation = validateURL(config.url);
  errors.push(...urlValidation.errors);

  // Validate institution configuration
  if (!config.institution) {
    errors.push('Institution configuration is required');
  } else {
    if (!config.institution.name?.trim()) {
      errors.push('Institution name is required');
    }
    if (!Object.values(InstitutionType).includes(config.institution.type)) {
      errors.push('Invalid institution type');
    }
    if (!config.institution.metadata?.contactEmail) {
      errors.push('Institution contact email is required');
    } else if (!isEmail(config.institution.metadata.contactEmail)) {
      errors.push('Invalid institution contact email format');
    }
  }

  // Validate scraping configuration
  if (!config.scraping) {
    errors.push('Scraping configuration is required');
  } else {
    validateScrapingConfig(config.scraping, errors);
  }

  // Validate timestamps
  if (config.lastUpdated && isNaN(new Date(config.lastUpdated).getTime())) {
    errors.push('Invalid lastUpdated timestamp');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates user credentials with enhanced security features
 * @param credentials - User credentials to validate
 * @returns ValidationResult with security checks and suggestions
 */
export function validateCredentials(credentials: IUserCredentials): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate email
  if (!credentials.email) {
    errors.push('Email is required');
  } else if (!isEmail(credentials.email)) {
    errors.push('Invalid email format');
  }

  // Validate password with security requirements
  if (!credentials.password) {
    errors.push('Password is required');
  } else {
    const { password } = credentials;
    const rules = VALIDATION_RULES.PASSWORD;

    if (password.length < rules.MIN_LENGTH) {
      errors.push(`Password must be at least ${rules.MIN_LENGTH} characters long`);
    }
    if (rules.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    if (rules.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    if (rules.REQUIRE_NUMBERS && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    if (rules.REQUIRE_SPECIAL && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validates grant proposal with comprehensive checks
 * @param proposal - Proposal object to validate
 * @returns ValidationResult with detailed feedback
 */
export function validateProposal(proposal: IProposal): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required fields
  if (!proposal.content) {
    errors.push('Proposal content is required');
  } else {
    // Content length validation
    const contentLength = proposal.content.length;
    if (contentLength < VALIDATION_RULES.PROPOSAL.MIN_CONTENT_LENGTH) {
      errors.push(`Proposal content must be at least ${VALIDATION_RULES.PROPOSAL.MIN_CONTENT_LENGTH} characters`);
    }
    if (contentLength > VALIDATION_RULES.PROPOSAL.MAX_CONTENT_LENGTH) {
      errors.push(`Proposal content exceeds maximum length of ${VALIDATION_RULES.PROPOSAL.MAX_CONTENT_LENGTH} characters`);
    }
  }

  // Validate metadata
  if (!proposal.metadata) {
    errors.push('Proposal metadata is required');
  } else {
    const { metadata } = proposal;

    if (!metadata.title?.trim()) {
      errors.push('Proposal title is required');
    }

    // Validate funding amount
    if (typeof metadata.fundingAmount !== 'number') {
      errors.push('Funding amount must be a number');
    } else if (
      metadata.fundingAmount < VALIDATION_RULES.PROPOSAL.MIN_FUNDING_AMOUNT ||
      metadata.fundingAmount > VALIDATION_RULES.PROPOSAL.MAX_FUNDING_AMOUNT
    ) {
      errors.push(`Funding amount must be between ${VALIDATION_RULES.PROPOSAL.MIN_FUNDING_AMOUNT} and ${VALIDATION_RULES.PROPOSAL.MAX_FUNDING_AMOUNT}`);
    }

    // Validate submission deadline
    if (!metadata.submissionDeadline) {
      errors.push('Submission deadline is required');
    } else {
      const deadline = new Date(metadata.submissionDeadline);
      if (isNaN(deadline.getTime())) {
        errors.push('Invalid submission deadline format');
      } else if (deadline < new Date()) {
        errors.push('Submission deadline cannot be in the past');
      }
    }
  }

  // Validate status
  if (!Object.values(ProposalStatus).includes(proposal.status)) {
    errors.push('Invalid proposal status');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Helper function to validate scraping configuration
 * @param config - Scraping configuration to validate
 * @param errors - Array to collect validation errors
 */
function validateScrapingConfig(config: ScrapingConfig, errors: string[]): void {
  // Validate rate limit
  if (typeof config.rateLimit !== 'number') {
    errors.push('Rate limit must be a number');
  } else if (
    config.rateLimit < VALIDATION_RULES.RATE_LIMIT.MIN ||
    config.rateLimit > VALIDATION_RULES.RATE_LIMIT.MAX
  ) {
    errors.push(`Rate limit must be between ${VALIDATION_RULES.RATE_LIMIT.MIN} and ${VALIDATION_RULES.RATE_LIMIT.MAX} requests per second`);
  }

  // Validate selectors
  if (!config.selectors) {
    errors.push('Scraping selectors are required');
  } else {
    if (!config.selectors.title) {
      errors.push('Title selector is required');
    }
    if (!config.selectors.description) {
      errors.push('Description selector is required');
    }
  }

  // Validate retry configuration
  if (config.retryConfig) {
    if (typeof config.retryConfig.maxAttempts !== 'number' || config.retryConfig.maxAttempts < 1) {
      errors.push('Invalid retry attempts configuration');
    }
    if (typeof config.retryConfig.backoffMs !== 'number' || config.retryConfig.backoffMs < 0) {
      errors.push('Invalid retry backoff configuration');
    }
  }
}