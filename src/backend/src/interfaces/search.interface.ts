/**
 * @file Search interfaces for the Technology Transfer Data Aggregation platform
 * Defines the complete contract for search functionality including semantic search,
 * filtering, pagination and performance optimization for sub-2 second response times
 */

/**
 * Core search parameters interface for technology transfer searches
 * Combines query, filters and pagination for comprehensive search requests
 */
export interface SearchParams {
  /** Main search query string for semantic matching */
  query: string;
  /** Combined filter criteria for refining results */
  filters: SearchFilters;
  /** Pagination parameters for result set windowing */
  pagination: PaginationParams;
}

/**
 * Search filter options for refining technology transfer search results
 * Supports multi-select filtering across key dimensions
 */
export interface SearchFilters {
  /** Array of institution identifiers to filter by */
  institution: string[];
  /** Array of technology categories to filter by */
  category: string[];
  /** Array of country codes to filter by */
  country: string[];
  /** Date range for temporal filtering */
  dateRange: DateRange;
}

/**
 * Complete search response structure including results, facets and pagination
 * Optimized for frontend rendering and user interaction
 */
export interface SearchResponse {
  /** Array of ranked search results */
  results: SearchResult[];
  /** Total number of matching results */
  total: number;
  /** Aggregated facet information for filtering */
  facets: SearchFacets;
  /** Pagination details for result set navigation */
  pagination: PaginationInfo;
}

/**
 * Individual search result structure with semantic ranking
 * Includes all essential fields for result display and interaction
 */
export interface SearchResult {
  /** Unique identifier for the technology */
  id: string;
  /** Technology title */
  title: string;
  /** Technology description */
  description: string;
  /** Source institution name */
  institution: string;
  /** Technology category */
  category: string;
  /** Country of origin */
  country: string;
  /** Initial discovery timestamp */
  discoveredAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Semantic relevance score (0-1) */
  score: number;
}

/**
 * Faceted search aggregations for filtering
 * Optimized to include only high-value aggregations
 */
export interface SearchFacets {
  /** Institution facet counts */
  institutions: FacetCount[];
  /** Category facet counts */
  categories: FacetCount[];
  /** Country facet counts */
  countries: FacetCount[];
}

/**
 * Individual facet count information
 * Used for displaying filter options and counts
 */
export interface FacetCount {
  /** Facet value (e.g., institution name, category name) */
  value: string;
  /** Number of results with this facet value */
  count: number;
}

/**
 * Pagination request parameters
 * Optimized for performance with reasonable limits
 */
export interface PaginationParams {
  /** Requested page number (1-based) */
  page: number;
  /** Results per page (default: 20, max: 100) */
  limit: number;
}

/**
 * Comprehensive pagination response information
 * Provides all necessary data for pagination UI
 */
export interface PaginationInfo {
  /** Current page number */
  currentPage: number;
  /** Total number of available pages */
  totalPages: number;
  /** Results per page */
  limit: number;
  /** Total number of results */
  total: number;
}

/**
 * Date range structure for temporal filtering
 * Supports precise temporal queries
 */
export interface DateRange {
  /** Start date of the range */
  start: Date;
  /** End date of the range */
  end: Date;
}