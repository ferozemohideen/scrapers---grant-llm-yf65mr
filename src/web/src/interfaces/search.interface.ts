/**
 * Interface definitions for the technology transfer data aggregation system's search functionality.
 * Supports semantic search, faceted navigation, and high-performance pagination.
 */

/**
 * Comprehensive search request parameters interface
 * @interface SearchParams
 */
export interface SearchParams {
  /** Search query string for semantic matching */
  query: string;
  /** Applied search filters */
  filters: SearchFilters;
  /** Pagination configuration */
  pagination: PaginationParams;
  /** Sort configuration */
  sort: SortOptions;
}

/**
 * Enhanced search filter options interface
 * @interface SearchFilters
 */
export interface SearchFilters {
  /** List of institution identifiers to filter by */
  institutions: string[];
  /** List of technology categories to filter by */
  categories: string[];
  /** Date range filter for technology discovery */
  dateRange: DateRange;
  /** List of semantic tags to filter by */
  tags: string[];
}

/**
 * Sorting configuration interface
 * @interface SortOptions
 */
export interface SortOptions {
  /** Field name to sort by */
  field: string;
  /** Sort direction */
  direction: 'asc' | 'desc';
}

/**
 * Date range filter interface using ISO date strings
 * @interface DateRange
 */
export interface DateRange {
  /** Start date in ISO format */
  start: string;
  /** End date in ISO format */
  end: string;
}

/**
 * Enhanced pagination parameters interface with size limits
 * @interface PaginationParams
 */
export interface PaginationParams {
  /** Current page number (1-based) */
  page: number;
  /** Number of items per page */
  pageSize: number;
  /** Maximum allowed page size */
  maxPageSize: number;
}

/**
 * Enhanced search response interface with metadata
 * @interface SearchResponse
 */
export interface SearchResponse {
  /** Array of search results */
  results: SearchResult[];
  /** Total number of matching results */
  total: number;
  /** Faceted navigation data */
  facets: SearchFacets;
  /** Search performance metadata */
  metadata: SearchMetadata;
}

/**
 * Search performance metadata interface
 * @interface SearchMetadata
 */
export interface SearchMetadata {
  /** Time taken to execute search in milliseconds */
  took: number;
  /** Computed complexity score of the search query */
  queryComplexity: number;
}

/**
 * Enhanced search result interface with highlighting and tags
 * @interface SearchResult
 */
export interface SearchResult {
  /** Unique identifier of the technology */
  id: string;
  /** Technology title */
  title: string;
  /** Technology description */
  description: string;
  /** Source institution name */
  institution: string;
  /** Technology category */
  category: string;
  /** Discovery timestamp in ISO format */
  discoveredAt: string;
  /** Relevance score from search engine */
  score: number;
  /** Associated semantic tags */
  tags: string[];
  /** Search term highlighting */
  highlights: Highlights;
}

/**
 * Search result highlighting interface
 * @interface Highlights
 */
export interface Highlights {
  /** Highlighted matches in title */
  title: string[];
  /** Highlighted matches in description */
  description: string[];
}

/**
 * Faceted navigation interface for search refinement
 * @interface SearchFacets
 */
export interface SearchFacets {
  /** Institution facets with counts */
  institutions: FacetBucket[];
  /** Category facets with counts */
  categories: FacetBucket[];
  /** Tag facets with counts */
  tags: FacetBucket[];
}

/**
 * Facet bucket interface for aggregations
 * @interface FacetBucket
 */
export interface FacetBucket {
  /** Facet value */
  key: string;
  /** Number of documents matching this facet */
  count: number;
}