import React, { useCallback, useEffect, useMemo, useState } from 'react';
import styled from '@emotion/styled';
import { useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import { SearchBar, SearchBarProps } from '../../components/search/SearchBar';
import { SearchResults } from '../../components/search/SearchResults';
import { FilterPanel } from '../../components/search/FilterPanel';
import SearchService from '../../services/search.service';
import { useDebounce } from '../../hooks/useDebounce';

// Types
import type {
  SearchParams,
  SearchResponse,
  SearchFilters,
  SearchResult
} from '../../interfaces/search.interface';

// Styled components for responsive layout
const SearchPageContainer = styled.div`
  display: grid;
  grid-template-columns: minmax(250px, 300px) 1fr;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  max-width: var(--container-max-width);
  margin: 0 auto;
  min-height: 100vh;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
    padding: var(--spacing-md);
  }
`;

const SearchContent = styled.main`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
`;

const SearchHeader = styled.div`
  position: sticky;
  top: 0;
  z-index: var(--z-index-sticky);
  background: var(--background-color);
  padding: var(--spacing-md) 0;
  border-bottom: 1px solid var(--border-color);
`;

// Error fallback component
const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
  <div role="alert" className="error-boundary">
    <h2>Search Error</h2>
    <pre>{error.message}</pre>
    <button onClick={resetErrorBoundary}>Try again</button>
  </div>
);

// Initial filter state
const initialFilters: SearchFilters = {
  institutions: [],
  categories: [],
  dateRange: { start: '', end: '' },
  tags: []
};

/**
 * Search page component implementing high-performance semantic search
 * with comprehensive error handling and responsive design
 */
const Search: React.FC = () => {
  // Router hooks
  const location = useLocation();
  const navigate = useNavigate();

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(initialFilters);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facets, setFacets] = useState<SearchResponse['facets'] | null>(null);

  // Performance optimization with debouncing
  const debouncedQuery = useDebounce(searchQuery, 300);
  const debouncedFilters = useDebounce(filters, 300);

  // Memoized search parameters
  const searchParams = useMemo((): SearchParams => ({
    query: debouncedQuery,
    filters: debouncedFilters,
    pagination: {
      page: 1,
      pageSize: 20,
      maxPageSize: 100
    },
    sort: {
      field: 'score',
      direction: 'desc'
    }
  }), [debouncedQuery, debouncedFilters]);

  // URL synchronization
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const urlQuery = params.get('q') || '';
    if (urlQuery !== searchQuery) {
      setSearchQuery(urlQuery);
    }
  }, [location.search]);

  // Load initial facets
  useEffect(() => {
    const loadFacets = async () => {
      try {
        const filters = await SearchService.getFilters();
        setFacets(filters);
      } catch (err) {
        console.error('Failed to load search facets:', err);
        setError('Failed to load search filters');
      }
    };
    loadFacets();
  }, []);

  // Execute search with error handling and performance monitoring
  const executeSearch = useCallback(async () => {
    if (!debouncedQuery && !Object.values(debouncedFilters).some(f => f.length > 0)) {
      setSearchResponse(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const startTime = performance.now();
      const response = await SearchService.search(searchParams);
      const duration = performance.now() - startTime;

      // Performance monitoring
      if (duration > 2000) {
        console.warn('Search performance warning:', { duration, query: debouncedQuery });
      }

      setSearchResponse(response);
      
      // Update URL
      const params = new URLSearchParams(location.search);
      params.set('q', debouncedQuery);
      navigate({ search: params.toString() }, { replace: true });
    } catch (err) {
      console.error('Search error:', err);
      setError('Failed to perform search. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, debouncedFilters, searchParams, navigate, location.search]);

  // Execute search when query or filters change
  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  // Handle search input changes
  const handleSearch: SearchBarProps['onSearch'] = useCallback(async (query: string) => {
    setSearchQuery(query);
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters);
  }, []);

  // Handle result selection
  const handleResultSelect = useCallback((result: SearchResult) => {
    navigate(`/technology/${result.id}`);
  }, [navigate]);

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback} onReset={() => setError(null)}>
      <SearchPageContainer>
        <FilterPanel
          filters={filters}
          onFilterChange={handleFilterChange}
          facets={facets || { institutions: [], categories: [], tags: [] }}
          loading={loading}
          error={!!error}
          errorMessage={error || undefined}
        />

        <SearchContent role="main" aria-label="Search Results">
          <SearchHeader>
            <SearchBar
              onSearch={handleSearch}
              placeholder="Search technologies..."
              autoFocus
              debounceTime={300}
              maxSuggestions={5}
            />
          </SearchHeader>

          <SearchResults
            searchResponse={searchResponse || {
              results: [],
              total: 0,
              facets: { institutions: [], categories: [], tags: [] },
              metadata: { took: 0, queryComplexity: 0 }
            }}
            loading={loading}
            onResultSelect={handleResultSelect}
            onPageChange={(page) => {
              // Handle pagination
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onPageSizeChange={(size) => {
              // Handle page size changes
            }}
            error={!!error}
          />
        </SearchContent>
      </SearchPageContainer>
    </ErrorBoundary>
  );
};

export default React.memo(Search);