/**
 * @fileoverview Comprehensive validation constants for the Technology Transfer Data Aggregation System
 * @version 1.0.0
 * @license MIT
 */

/**
 * URL validation patterns and security rules
 */
export const URL_VALIDATION_PATTERNS = {
  // RFC 3986 compliant URL regex with HTTPS requirement
  URL_REGEX: /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)$/,
  
  // Enforcing HTTPS-only for security
  ALLOWED_PROTOCOLS: ['https'] as const,
  
  // Security validation checks
  SECURITY_CHECKS: {
    requireSSL: true,
    maxLength: 2048,
    blacklistedDomains: [] as string[],
    validateCertificate: true,
    preventIPAddresses: true,
    preventSpecialCharacters: true
  }
} as const;

/**
 * Institution validation rules for configuration management
 */
export const INSTITUTION_VALIDATION_RULES = {
  ALLOWED_TYPES: [
    'us_university',
    'international_university', 
    'federal_lab'
  ] as const,
  
  NAME_CONSTRAINTS: {
    minLength: 2,
    maxLength: 100,
    pattern: /^[a-zA-Z0-9\s\-&.]+$/,
    required: true,
    trim: true,
    normalize: true
  },
  
  LOCATION_RULES: {
    requireCountry: true,
    requireState: 'conditional', // Required for US institutions
    allowedCountries: [], // Populated from configuration
    stateFormat: /^[A-Z]{2}$/, // US state code format
    validatePostalCode: true
  }
} as const;

/**
 * Scraper configuration validation rules
 */
export const SCRAPER_VALIDATION_RULES = {
  SELECTOR_RULES: {
    allowedTypes: ['css', 'xpath', 'regex'] as const,
    maxLength: 500,
    required: ['title', 'description'] as const,
    validation: {
      css: /^[a-zA-Z0-9\s\-_#.[]="'*>+~:()]*$/,
      xpath: /^[\/a-zA-Z0-9\s\-_@*=\[\]()'"]+$/,
      regex: /.+/
    }
  },
  
  RATE_LIMITS: {
    minDelay: 1000, // milliseconds
    maxRequestsPerSecond: {
      us_university: 2,
      international_university: 1,
      federal_lab: 5,
      default: 1
    },
    burstLimit: {
      us_university: 5,
      international_university: 3,
      federal_lab: 10,
      default: 2
    },
    cooldownPeriod: {
      us_university: 60000,
      international_university: 120000,
      federal_lab: 30000,
      default: 300000
    }
  },
  
  RETRY_POLICY: {
    maxAttempts: 3,
    backoffMultiplier: 1.5,
    maxBackoff: 30000,
    retryableErrors: [
      'ETIMEDOUT',
      'ECONNRESET',
      'ECONNREFUSED',
      '429'
    ]
  }
} as const;

/**
 * User input validation rules
 */
export const USER_VALIDATION_RULES = {
  EMAIL_VALIDATION: {
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    maxLength: 255,
    required: true,
    uniqueConstraint: true
  },
  
  PASSWORD_POLICY: {
    minLength: 12,
    maxLength: 128,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
    preventCommonPasswords: true,
    preventPersonalInfo: true,
    maxRepeatingChars: 3
  },
  
  PROFILE_RULES: {
    name: {
      minLength: 2,
      maxLength: 100,
      pattern: /^[a-zA-Z\s\-']+$/
    },
    institution: {
      required: true,
      reference: 'institutions'
    },
    role: {
      allowedValues: [
        'researcher',
        'administrator',
        'business_developer',
        'entrepreneur'
      ]
    }
  }
} as const;

/**
 * File upload validation rules
 */
export const FILE_VALIDATION_RULES = {
  CONTENT_TYPES: {
    allowed: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/json',
      'text/yaml'
    ],
    image: {
      allowed: [
        'image/jpeg',
        'image/png',
        'image/gif'
      ],
      maxDimensions: {
        width: 4096,
        height: 4096
      }
    }
  },
  
  SIZE_LIMITS: {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxImageSize: 5 * 1024 * 1024, // 5MB
    maxBatchSize: 50 * 1024 * 1024 // 50MB
  },
  
  SECURITY_SCAN: {
    validateMimeType: true,
    scanForMalware: true,
    validateSignature: true,
    allowedFileExtensions: [
      '.pdf', '.doc', '.docx',
      '.csv', '.json', '.yaml',
      '.jpg', '.jpeg', '.png', '.gif'
    ]
  }
} as const;

/**
 * API request validation and rate limiting rules
 */
export const API_VALIDATION_RULES = {
  PAGINATION: {
    defaultLimit: 20,
    maxLimit: 100,
    requirePage: true,
    validateOffset: true
  },
  
  RATE_LIMITING: {
    window: 60000, // 1 minute
    maxRequests: {
      anonymous: 30,
      authenticated: 100,
      admin: 300
    },
    burstLimit: {
      anonymous: 5,
      authenticated: 15,
      admin: 45
    }
  },
  
  REQUEST_LIMITS: {
    maxBodySize: '10mb',
    maxUrlLength: 2048,
    maxHeaderSize: 8192,
    timeout: 30000, // 30 seconds
    maxConcurrentRequests: 100
  }
} as const;