/**
 * API Constants
 * Centralized configuration for all API-related constants and endpoints
 * @version 1.0.0
 */

// Base configuration constants
export const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
export const API_TIMEOUT = 30000;
export const API_VERSION = 'v1';

// Retry configuration
export const API_RETRY_CONFIG = {
  attempts: 3,
  delay: 1000,
} as const;

// HTTP Status codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const;

// API Error messages
export const API_ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network connection error occurred',
  TIMEOUT: 'Request timed out',
  UNAUTHORIZED: 'Unauthorized access',
  NOT_FOUND: 'Resource not found',
  SERVER_ERROR: 'Internal server error',
  VALIDATION_ERROR: 'Validation error occurred',
} as const;

// Type definitions for endpoints
type EndpointConfig = {
  readonly [key: string]: string;
};

type APIEndpoints = {
  readonly AUTH: EndpointConfig;
  readonly SCRAPER: EndpointConfig;
  readonly SEARCH: EndpointConfig;
  readonly GRANT: EndpointConfig;
  readonly CONFIG: EndpointConfig;
};

// API Endpoints configuration
export const API_ENDPOINTS: APIEndpoints = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    REGISTER: '/auth/register',
    REFRESH_TOKEN: '/auth/refresh',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_EMAIL: '/auth/verify-email',
    CURRENT_USER: '/auth/me',
    UPDATE_PROFILE: '/auth/profile',
  },

  SCRAPER: {
    START: '/scraper/start',
    STATUS: '/scraper/status',
    LOGS: '/scraper/logs',
    STOP: '/scraper/stop',
    SCHEDULE: '/scraper/schedule',
    METRICS: '/scraper/metrics',
    HISTORY: '/scraper/history',
  },

  SEARCH: {
    QUERY: '/search',
    SUGGESTIONS: '/search/suggestions',
    FILTERS: '/search/filters',
    ADVANCED: '/search/advanced',
    EXPORT: '/search/export',
    SAVED: '/search/saved',
    TRENDING: '/search/trending',
  },

  GRANT: {
    CREATE: '/grant',
    UPDATE: '/grant/:id',
    DELETE: '/grant/:id',
    GET: '/grant/:id',
    LIST: '/grant',
    VERSIONS: '/grant/:id/versions',
    COMPARE: '/grant/:id/compare',
    COLLABORATE: '/grant/:id/collaborate',
    EXPORT: '/grant/:id/export',
    TEMPLATE: '/grant/template',
  },

  CONFIG: {
    URL: '/config/url',
    URL_TEST: '/config/url/test',
    URL_VALIDATE: '/config/url/validate',
    URL_IMPORT: '/config/url/import',
    URL_EXPORT: '/config/url/export',
    INSTITUTION: '/config/institution',
    INSTITUTION_TYPES: '/config/institution/types',
    SETTINGS: '/config/settings',
    BACKUP: '/config/backup',
  },
} as const;

// Helper function to construct full API URLs
export const getApiUrl = (endpoint: string): string => {
  return `${API_BASE_URL}${endpoint}`;
};

// Helper function to construct URLs with parameters
export const getParameterizedUrl = (endpoint: string, params: Record<string, string>): string => {
  let parameterizedUrl = endpoint;
  Object.entries(params).forEach(([key, value]) => {
    parameterizedUrl = parameterizedUrl.replace(`:${key}`, value);
  });
  return getApiUrl(parameterizedUrl);
};

// Export type definitions for external use
export type APIEndpointType = typeof API_ENDPOINTS;
export type APIErrorMessageType = typeof API_ERROR_MESSAGES;
export type HTTPStatusType = typeof HTTP_STATUS;