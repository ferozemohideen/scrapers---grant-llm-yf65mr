/**
 * Enhanced search results page component with performance optimization,
 * accessibility features, and comprehensive error handling.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { useSearchParams } from 'react-router-dom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDebounce } from 'use-debounce';
import { ErrorBoundary } from 'react-error-boundary';

import SearchResults from '../../components/search/SearchResults';
import FilterPanel from '../../components/search/FilterPanel';
import { SearchService } from '../../services/search.service';
import type { SearchResponse, SearchFilters, SearchResult } from '../../interfaces/search.interface';

// Enhanced state interface for search results page
interface SearchPageState {
  searchResponse: SearchResponse | null;
  filters: SearchFilters;
  loading: boolean;
  error: string | null;
  metrics: PerformanceMetrics;
  suggestions: string[];
  cacheStatus: CacheStatus;
}

// Performance metrics tracking
interface PerformanceMetrics {
  searchTime: number;
  renderTime: number;
  totalResults: number;
  timestamp: string;
}

// Cache status tracking
interface CacheStatus {
  hits: number;
  misses: number;
  lastUpdated: string;
}

// Styled components with responsive design
const ResultsPageContainer = styled.div`
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  min-height: 100vh;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }

  @media (prefers-reduced-motion) {
    transition: none;
  }

  @media (prefers-color-scheme: dark) {
    background: var(--dark-bg);
    color: var(--dark-text);
  }
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-xl);
  text-align: center;
  color: var(--error);
`;

/**
 * Main search results page component with enhanced features
 */
const ResultsPage: React.FC = () => {
  // URL search params management
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Component state
  const [state, setState] = useState<SearchPageState>({
    searchResponse: null,
    filters: {
      institutions: [],
      categories: [],
      dateRange: { start: '', end: '' },
      tags: []
    },
    loading: true,
    error: null,
    metrics: {
      searchTime: 0,
      renderTime: 0,
      totalResults: 0,
      timestamp: new Date().toISOString()
    },
    suggestions: [],
    cacheStatus: {
      hits: 0,
      misses: 0,
      lastUpdated: new Date().toISOString()
    }
  });

  // Debounced search query for performance
  const [debouncedQuery] = useDebounce(
    searchParams.get('q') || '',
    300
  );

  // Initialize search service
  const searchService = useMemo(() => new SearchService(), []);

  /**
   * Executes search with performance tracking
   */
  const performSearch = useCallback(async () => {
    const startTime = performance.now();
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const searchResponse = await searchService.search({
        query: debouncedQuery,
        filters: state.filters,
        pagination: {
          page: parseInt(searchParams.get('page') || '1', 10),
          pageSize: 20,
          maxPageSize: 100
        },
        sort: {
          field: searchParams.get('sort') || 'relevance',
          direction: searchParams.get('order') as 'asc' | 'desc' || 'desc'
        }
      });

      const endTime = performance.now();

      setState(prev => ({
        ...prev,
        searchResponse,
        loading: false,
        metrics: {
          ...prev.metrics,
          searchTime: endTime - startTime,
          totalResults: searchResponse.total,
          timestamp: new Date().toISOString()
        }
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Search failed'
      }));
    }
  }, [debouncedQuery, searchParams, state.filters, searchService]);

  /**
   * Handles filter changes with validation
   */
  const handleFilterChange = useCallback((newFilters: SearchFilters) => {
    setState(prev => ({ ...prev, filters: newFilters }));
    setSearchParams(prev => {
      prev.set('page', '1'); // Reset to first page on filter change
      return prev;
    });
  }, [setSearchParams]);

  /**
   * Handles result selection with analytics
   */
  const handleResultSelect = useCallback((result: SearchResult) => {
    // Track selection in analytics
    console.debug('Result selected:', result.id);
    
    // Navigate to result detail page
    window.location.href = `/technology/${result.id}`;
  }, []);

  // Initial search and filter load
  useEffect(() => {
    performSearch();
    
    // Load available filters
    searchService.getFilters()
      .then(filters => setState(prev => ({ ...prev, filters })))
      .catch(console.error);
  }, [debouncedQuery, performSearch, searchService]);

  // Error fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <ErrorContainer role="alert">
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={() => window.location.reload()}>
        Retry
      </button>
    </ErrorContainer>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <ResultsPageContainer>
        <FilterPanel
          filters={state.filters}
          onFilterChange={handleFilterChange}
          facets={state.searchResponse?.facets || { institutions: [], categories: [], tags: [] }}
          loading={state.loading}
          error={!!state.error}
          errorMessage={state.error || undefined}
        />

        <SearchResults
          searchResponse={state.searchResponse}
          loading={state.loading}
          onResultSelect={handleResultSelect}
          onPageChange={(page) => setSearchParams(prev => {
            prev.set('page', page.toString());
            return prev;
          })}
          onPageSizeChange={(size) => setSearchParams(prev => {
            prev.set('size', size.toString());
            return prev;
          })}
          error={!!state.error}
        />

        {/* Performance monitoring - hidden in production */}
        {process.env.NODE_ENV === 'development' && (
          <div role="status" aria-hidden="true">
            Search time: {state.metrics.searchTime.toFixed(2)}ms
            Total results: {state.metrics.totalResults}
          </div>
        )}
      </ResultsPageContainer>
    </ErrorBoundary>
  );
};

export default ResultsPage;