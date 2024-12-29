import React, { useMemo, useCallback } from 'react';
import styled from '@emotion/styled';

// Interfaces
interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  isLoading?: boolean;
  errorMessage?: string;
}

// Styled Components
const PaginationContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(40px, auto));
  gap: var(--spacing-sm);
  margin: var(--spacing-md) 0;
  justify-content: center;
  align-items: center;

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(32px, auto));
    gap: var(--spacing-xs);
  }
`;

const PageButton = styled.button`
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  background: var(--background);
  cursor: pointer;
  min-width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: var(--font-size-sm);

  &:hover {
    background: var(--background-hover);
    border-color: var(--primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &.active {
    background: var(--primary);
    color: var(--text-inverse);
    border-color: var(--primary);
  }

  &:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    min-width: 32px;
    height: 32px;
    padding: var(--spacing-xs);
  }
`;

const PageSizeSelect = styled.select`
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  background: var(--background);
  cursor: pointer;
  height: 40px;
  font-size: var(--font-size-sm);

  &:focus {
    outline: 2px solid var(--primary);
    outline-offset: 2px;
  }

  @media (max-width: 768px) {
    height: 32px;
    padding: var(--spacing-xs);
  }
`;

// Helper Functions
const calculatePageCount = (totalItems: number, pageSize: number): number => {
  return Math.max(1, Math.ceil(totalItems / pageSize));
};

const generatePageNumbers = (currentPage: number, totalPages: number): (number | string)[] => {
  const pages: (number | string)[] = [];
  const SIBLINGS = 1;
  const ELLIPSIS = '...';

  // Always show first page
  pages.push(1);

  if (currentPage - SIBLINGS > 2) {
    pages.push(ELLIPSIS);
  }

  // Show current page and siblings
  for (let i = Math.max(2, currentPage - SIBLINGS); i <= Math.min(totalPages - 1, currentPage + SIBLINGS); i++) {
    pages.push(i);
  }

  if (currentPage + SIBLINGS < totalPages - 1) {
    pages.push(ELLIPSIS);
  }

  // Always show last page if there is more than one page
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
};

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  isLoading = false,
  errorMessage,
}) => {
  const totalPages = useMemo(() => calculatePageCount(totalItems, pageSize), [totalItems, pageSize]);
  const pageNumbers = useMemo(() => generatePageNumbers(currentPage, totalPages), [currentPage, totalPages]);

  const handlePageChange = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages && !isLoading) {
      onPageChange(page);
    }
  }, [totalPages, onPageChange, isLoading]);

  const handleKeyboardNavigation = useCallback((event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        handlePageChange(currentPage - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        handlePageChange(currentPage + 1);
        break;
      case 'Home':
        event.preventDefault();
        handlePageChange(1);
        break;
      case 'End':
        event.preventDefault();
        handlePageChange(totalPages);
        break;
      default:
        if (/^\d$/.test(event.key)) {
          const page = parseInt(event.key, 10);
          if (page <= totalPages) {
            event.preventDefault();
            handlePageChange(page);
          }
        }
    }
  }, [currentPage, totalPages, handlePageChange]);

  if (errorMessage) {
    return <div role="alert" aria-live="polite">{errorMessage}</div>;
  }

  return (
    <nav aria-label="Pagination" role="navigation">
      <PaginationContainer onKeyDown={handleKeyboardNavigation}>
        <PageButton
          onClick={() => handlePageChange(1)}
          disabled={currentPage === 1 || isLoading}
          aria-label="Go to first page"
        >
          ⟪
        </PageButton>
        <PageButton
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          aria-label="Go to previous page"
        >
          ←
        </PageButton>

        {pageNumbers.map((pageNum, index) => (
          typeof pageNum === 'number' ? (
            <PageButton
              key={index}
              onClick={() => handlePageChange(pageNum)}
              className={currentPage === pageNum ? 'active' : ''}
              disabled={isLoading}
              aria-current={currentPage === pageNum ? 'page' : undefined}
              aria-label={`Go to page ${pageNum}`}
            >
              {pageNum}
            </PageButton>
          ) : (
            <span key={index} aria-hidden="true">{pageNum}</span>
          )
        ))}

        <PageButton
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          aria-label="Go to next page"
        >
          →
        </PageButton>
        <PageButton
          onClick={() => handlePageChange(totalPages)}
          disabled={currentPage === totalPages || isLoading}
          aria-label="Go to last page"
        >
          ⟫
        </PageButton>

        {onPageSizeChange && (
          <PageSizeSelect
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            disabled={isLoading}
            aria-label="Select number of items per page"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / page
              </option>
            ))}
          </PageSizeSelect>
        )}
      </PaginationContainer>
    </nav>
  );
};

export default Pagination;