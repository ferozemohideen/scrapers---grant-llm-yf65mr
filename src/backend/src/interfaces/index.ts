/**
 * @fileoverview Centralized barrel file that aggregates and re-exports all TypeScript interfaces,
 * types, and enums from the interfaces directory. This file serves as a single point of access
 * for all interface definitions across the application, organized by domain.
 * @version 1.0.0
 */

// Authentication & Authorization Interfaces
export {
  UserRole,
  IUserCredentials,
  IAuthTokens,
  IAuthPayload,
  IUserSession,
  isValidUserRole,
  isAuthPayload,
  isAuthTokens,
  SESSION_TIMEOUT_MS,
  MAX_REFRESH_TOKEN_AGE_MS,
  TOKEN_TYPE
} from './auth.interface';

// Configuration Interfaces
export {
  DatabaseConfig,
  MongoConfig,
  RedisConfig,
  ScraperConfig,
  AuthConfig
} from './config.interface';

// Grant Proposal Interfaces
export {
  ProposalStatus,
  IVersionHistory,
  IReviewComment,
  IAIMetadata,
  IAIParameters,
  IGenerationRequirements,
  IProposalMetadata,
  IProposal,
  IProposalGeneration,
  IProposalUpdate,
  IProposalEnhancement,
  IProposalSearchCriteria,
  IProposalAnalytics
} from './grant.interface';

// Web Scraping Interfaces
export {
  ValidationRules,
  ValidationResults,
  InstitutionRateLimit,
  BurstHandlingConfig,
  RateLimitConfig,
  RateLimitMetrics,
  RateLimitStatus,
  PerformanceMetrics,
  ScraperConfig,
  RetryConfig,
  ScraperEngine,
  ScraperJob,
  ScraperResult,
  ScraperError
} from './scraper.interface';

// Search Functionality Interfaces
export {
  SearchParams,
  SearchFilters,
  SearchResponse,
  SearchResult,
  SearchFacets,
  FacetCount,
  PaginationParams,
  PaginationInfo,
  DateRange
} from './search.interface';