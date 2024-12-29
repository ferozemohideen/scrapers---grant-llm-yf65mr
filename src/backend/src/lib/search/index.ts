/**
 * @fileoverview Core search functionality module that exports the Elasticsearch service
 * and comprehensive type-safe interfaces for centralized semantic search capabilities.
 * Implements sub-2 second response times and complete data coverage requirements.
 * @version 1.0.0
 */

import { ElasticsearchService } from './elasticsearch.service';
import {
  SearchParams,
  SearchFilters,
  SearchResponse,
  SearchResult,
  SearchFacets,
  FacetCount,
  PaginationParams,
  PaginationInfo,
  DateRange
} from '../../interfaces/search.interface';

/**
 * Singleton instance of the Elasticsearch service
 * Ensures single point of access for search functionality
 */
const searchService = ElasticsearchService.getInstance();

/**
 * Performs optimized semantic search across technology transfer data
 * Guarantees sub-2 second response times through caching and optimization
 * 
 * @param params Search parameters including query, filters, and pagination
 * @returns Promise containing search results, facets, and pagination info
 * @throws Error if search operation fails or timeout occurs
 */
export async function search(params: SearchParams): Promise<SearchResponse> {
  try {
    return await searchService.search(params);
  } catch (error) {
    console.error('Search operation failed:', error);
    throw error;
  }
}

/**
 * Retrieves faceted aggregations for filtering options
 * Provides counts for institutions, categories, and countries
 * 
 * @param filters Current filter state
 * @returns Promise containing facet counts
 */
export async function getFacets(filters: SearchFilters): Promise<SearchFacets> {
  try {
    const searchParams: SearchParams = {
      query: '',
      filters,
      pagination: { page: 1, limit: 0 }
    };
    const response = await searchService.search(searchParams);
    return response.facets;
  } catch (error) {
    console.error('Facet retrieval failed:', error);
    throw error;
  }
}

/**
 * Builds optimized search query with performance considerations
 * Supports semantic matching and filtering
 * 
 * @param params Search parameters
 * @returns Elasticsearch query object
 */
export function buildQuery(params: SearchParams): object {
  return searchService.buildQuery(params);
}

// Export all search-related interfaces for type safety
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
};

// Export the Elasticsearch service for direct access if needed
export { ElasticsearchService };

/**
 * Default search parameters with optimized values
 * for sub-2 second response times
 */
export const DEFAULT_SEARCH_PARAMS: Partial<SearchParams> = {
  pagination: {
    page: 1,
    limit: 20
  },
  filters: {
    institution: [],
    category: [],
    country: [],
    dateRange: {
      start: new Date(0),
      end: new Date()
    }
  }
};

/**
 * Search result field weights for relevance scoring
 */
export const FIELD_WEIGHTS = {
  title: 2.0,
  description: 1.0,
  institution: 1.5,
  category: 1.0,
  country: 1.0
};

/**
 * Performance optimization constants
 */
export const PERFORMANCE_CONFIG = {
  maxResultWindow: 10000,
  defaultPageSize: 20,
  maxPageSize: 100,
  minScore: 0.3,
  timeout: 2000, // 2 seconds
  cacheEnabled: true,
  cacheTTL: 3600 // 1 hour
};

/**
 * Validation functions for search parameters
 */
export const validators = {
  /**
   * Validates pagination parameters
   * @param pagination Pagination parameters
   * @throws Error if parameters are invalid
   */
  validatePagination(pagination: PaginationParams): void {
    if (pagination.page < 1) {
      throw new Error('Page number must be greater than 0');
    }
    if (pagination.limit < 1 || pagination.limit > PERFORMANCE_CONFIG.maxPageSize) {
      throw new Error(`Page size must be between 1 and ${PERFORMANCE_CONFIG.maxPageSize}`);
    }
    const offset = (pagination.page - 1) * pagination.limit;
    if (offset > PERFORMANCE_CONFIG.maxResultWindow) {
      throw new Error(`Maximum result window of ${PERFORMANCE_CONFIG.maxResultWindow} exceeded`);
    }
  },

  /**
   * Validates date range parameters
   * @param dateRange Date range filter
   * @throws Error if date range is invalid
   */
  validateDateRange(dateRange: DateRange): void {
    if (dateRange.start > dateRange.end) {
      throw new Error('Start date must be before end date');
    }
    if (dateRange.end > new Date()) {
      throw new Error('End date cannot be in the future');
    }
  }
};

/**
 * Error messages for search operations
 */
export const ERROR_MESSAGES = {
  SEARCH_TIMEOUT: 'Search operation timed out (exceeded 2 seconds)',
  INVALID_QUERY: 'Invalid search query parameters',
  FACET_ERROR: 'Failed to retrieve search facets',
  CACHE_ERROR: 'Cache operation failed',
  ELASTICSEARCH_ERROR: 'Elasticsearch operation failed'
};