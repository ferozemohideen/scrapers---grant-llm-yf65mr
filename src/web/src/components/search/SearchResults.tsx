import React, { useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { FixedSizeGrid } from 'react-window';
import debounce from 'lodash/debounce';

import ResultCard from './ResultCard';
import Pagination from '../common/Pagination';
import type { SearchResponse, SearchResult } from '../../interfaces/search.interface';

// Version comments for third-party dependencies
// @emotion/styled: ^11.0.0
// react-window: ^1.8.9
// lodash/debounce: ^4.0.8

/**
 * Props interface for the SearchResults component
 */
interface SearchResultsProps {
  searchResponse: SearchResponse;
  loading: boolean;
  onResultSelect: (result: SearchResult) => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  error: boolean;
}

/**
 * Styled components for layout and responsive design
 */
const ResultsContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--spacing-md);
  padding: var(--spacing-md);
  min-height: 400px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: var(--spacing-sm);
  }
`;

const NoResults = styled.div`
  text-align: center;
  padding: var(--spacing-xl);
  color: var(--text-secondary);
  font-size: var(--font-size-lg);
`;

const LoadingContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  width: 100%;
`;

const ErrorContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-xl);
  color: var(--error);
  text-align: center;
`;

/**
 * SearchResults component that displays search results with virtualization for performance
 * and comprehensive accessibility features.
 */
const SearchResults: React.FC<SearchResultsProps> = React.memo(({
  searchResponse,
  loading,
  onResultSelect,
  onPageChange,
  onPageSizeChange,
  error
}) => {
  // Memoize handlers to prevent unnecessary re-renders
  const handleResultSelect = useCallback((result: SearchResult) => {
    onResultSelect(result);
  }, [onResultSelect]);

  // Debounce pagination handlers for performance
  const debouncedPageChange = useMemo(
    () => debounce((page: number) => onPageChange(page), 300),
    [onPageChange]
  );

  const debouncedPageSizeChange = useMemo(
    () => debounce((size: number) => onPageSizeChange(size), 300),
    [onPageSizeChange]
  );

  // Calculate grid dimensions for virtualization
  const gridConfig = useMemo(() => {
    const columnWidth = window.innerWidth > 768 ? 300 : window.innerWidth - 32;
    const columns = Math.floor(window.innerWidth / columnWidth);
    return { columnWidth, columns };
  }, []);

  // Render loading state
  if (loading) {
    return (
      <LoadingContainer role="status" aria-busy="true" aria-label="Loading search results">
        <ResultsContainer>
          {Array.from({ length: 6 }).map((_, index) => (
            <ResultCard
              key={`skeleton-${index}`}
              result={{} as SearchResult}
              isLoading={true}
            />
          ))}
        </ResultsContainer>
      </LoadingContainer>
    );
  }

  // Render error state
  if (error) {
    return (
      <ErrorContainer role="alert">
        <h2>Error Loading Results</h2>
        <p>There was a problem loading the search results. Please try again later.</p>
      </ErrorContainer>
    );
  }

  // Render no results state
  if (searchResponse.results.length === 0) {
    return (
      <NoResults role="status" aria-label="No results found">
        <h2>No Results Found</h2>
        <p>Try adjusting your search criteria or filters.</p>
      </NoResults>
    );
  }

  // Cell renderer for virtualized grid
  const CellRenderer = ({ columnIndex, rowIndex, style }: any) => {
    const index = rowIndex * gridConfig.columns + columnIndex;
    const result = searchResponse.results[index];

    if (!result) return null;

    return (
      <div style={style}>
        <ResultCard
          result={result}
          onSelect={() => handleResultSelect(result)}
          className="h-full"
        />
      </div>
    );
  };

  return (
    <div role="region" aria-label="Search Results">
      {/* Virtualized Grid for large result sets */}
      <FixedSizeGrid
        columnCount={gridConfig.columns}
        columnWidth={gridConfig.columnWidth}
        height={800}
        rowCount={Math.ceil(searchResponse.results.length / gridConfig.columns)}
        rowHeight={400}
        width="100%"
        overscanRowCount={2}
      >
        {CellRenderer}
      </FixedSizeGrid>

      {/* Pagination Controls */}
      <Pagination
        currentPage={Math.ceil(searchResponse.results.length / searchResponse.metadata.queryComplexity)}
        totalItems={searchResponse.total}
        pageSize={20}
        onPageChange={debouncedPageChange}
        onPageSizeChange={debouncedPageSizeChange}
        pageSizeOptions={[10, 20, 50, 100]}
        isLoading={loading}
      />
    </div>
  );
});

// Display name for debugging
SearchResults.displayName = 'SearchResults';

export default SearchResults;