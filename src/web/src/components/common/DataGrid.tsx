import React, { useState, useMemo, useCallback, useRef } from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import { Table, TableProps, TableColumn } from './Table';
import { Loading } from './Loading';
import { Pagination } from './Pagination';

// Types and Interfaces
export interface DataGridColumn<T> extends TableColumn<T> {
  filterable?: boolean;
  filterType?: 'text' | 'number' | 'select' | 'date';
  filterOptions?: { label: string; value: any }[];
  minWidth?: string;
  maxWidth?: string;
}

export interface DataGridProps<T> extends Omit<TableProps<T>, 'columns'> {
  columns: DataGridColumn<T>[];
  onFilterChange?: (filters: Record<string, any>) => void;
  onSelectionChange?: (selectedRows: T[]) => void;
  defaultFilters?: Record<string, any>;
  defaultSort?: { key: string; order: 'asc' | 'desc' };
  virtualScroll?: boolean;
  rowHeight?: number;
  stickyHeader?: boolean;
  selectable?: boolean;
  loading?: boolean;
  error?: string;
}

// Styled Components
const GridContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  width: 100%;
  position: relative;
`;

const FilterContainer = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--spacing-3);
  padding: var(--spacing-3);
  background: var(--background-color-dark);
  border-radius: var(--border-radius-md);
  margin-bottom: var(--spacing-2);

  @media (max-width: var(--breakpoint-md)) {
    grid-template-columns: 1fr;
  }
`;

const FilterInput = styled.input`
  width: 100%;
  padding: var(--spacing-2);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  background: var(--background-color);

  &:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }

  &:disabled {
    background: var(--background-color-disabled);
    cursor: not-allowed;
  }
`;

const FilterSelect = styled.select`
  width: 100%;
  padding: var(--spacing-2);
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  background: var(--background-color);

  &:focus {
    outline: none;
    box-shadow: var(--focus-ring);
  }
`;

const ErrorMessage = styled.div`
  color: var(--error-color);
  padding: var(--spacing-3);
  text-align: center;
  background: var(--background-color-dark);
  border-radius: var(--border-radius-md);
  margin: var(--spacing-2) 0;
`;

// Custom Hook for DataGrid State Management
function useDataGrid<T>({
  data,
  defaultFilters,
  defaultSort,
  onFilterChange,
  onSelectionChange,
  virtualScroll,
  rowHeight = 48,
}: Pick<DataGridProps<T>, 'data' | 'defaultFilters' | 'defaultSort' | 'onFilterChange' | 'onSelectionChange' | 'virtualScroll' | 'rowHeight'>) {
  const [filters, setFilters] = useState<Record<string, any>>(defaultFilters || {});
  const [sortConfig, setSortConfig] = useState(defaultSort);
  const [selectedRows, setSelectedRows] = useState<T[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const containerRef = useRef<HTMLDivElement>(null);

  // Memoized filtered and sorted data
  const processedData = useMemo(() => {
    let result = [...data];

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(item => {
          const itemValue = item[key as keyof T];
          if (typeof value === 'string') {
            return String(itemValue).toLowerCase().includes(value.toLowerCase());
          }
          return itemValue === value;
        });
      }
    });

    // Apply sorting
    if (sortConfig) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof T];
        const bValue = b[sortConfig.key as keyof T];
        const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortConfig.order === 'asc' ? comparison : -comparison;
      });
    }

    return result;
  }, [data, filters, sortConfig]);

  // Debounced filter handler
  const handleFilterChange = useCallback(
    debounce((key: string, value: any) => {
      const newFilters = { ...filters, [key]: value };
      setFilters(newFilters);
      setCurrentPage(1);
      onFilterChange?.(newFilters);
    }, 300),
    [filters, onFilterChange]
  );

  // Selection handlers
  const handleRowSelection = useCallback((row: T) => {
    setSelectedRows(prev => {
      const newSelection = prev.includes(row)
        ? prev.filter(r => r !== row)
        : [...prev, row];
      onSelectionChange?.(newSelection);
      return newSelection;
    });
  }, [onSelectionChange]);

  // Pagination handlers
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  return {
    processedData,
    filters,
    sortConfig,
    selectedRows,
    currentPage,
    pageSize,
    containerRef,
    handleFilterChange,
    handleRowSelection,
    handlePageChange,
    handlePageSizeChange,
    setSortConfig,
  };
}

// Main Component
export const DataGrid = <T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  error,
  defaultFilters,
  defaultSort,
  onFilterChange,
  onSelectionChange,
  virtualScroll = false,
  rowHeight = 48,
  stickyHeader = true,
  selectable = false,
  className,
  ...tableProps
}: DataGridProps<T>): JSX.Element => {
  const {
    processedData,
    filters,
    sortConfig,
    selectedRows,
    currentPage,
    pageSize,
    containerRef,
    handleFilterChange,
    handleRowSelection,
    handlePageChange,
    handlePageSizeChange,
    setSortConfig,
  } = useDataGrid({
    data,
    defaultFilters,
    defaultSort,
    onFilterChange,
    onSelectionChange,
    virtualScroll,
    rowHeight,
  });

  // Filter rendering
  const renderFilters = useMemo(() => {
    return columns.filter(col => col.filterable).map(column => (
      <div key={`filter-${column.key}`}>
        {column.filterType === 'select' ? (
          <FilterSelect
            value={filters[column.key] || ''}
            onChange={e => handleFilterChange(column.key, e.target.value)}
            aria-label={`Filter by ${column.title}`}
            disabled={loading}
          >
            <option value="">All {column.title}</option>
            {column.filterOptions?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </FilterSelect>
        ) : (
          <FilterInput
            type={column.filterType || 'text'}
            placeholder={`Filter by ${column.title}`}
            value={filters[column.key] || ''}
            onChange={e => handleFilterChange(column.key, e.target.value)}
            aria-label={`Filter by ${column.title}`}
            disabled={loading}
          />
        )}
      </div>
    ));
  }, [columns, filters, handleFilterChange, loading]);

  // Calculate visible data for current page
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return processedData.slice(start, start + pageSize);
  }, [processedData, currentPage, pageSize]);

  return (
    <GridContainer ref={containerRef} className={className}>
      {columns.some(col => col.filterable) && (
        <FilterContainer role="search">{renderFilters}</FilterContainer>
      )}

      {error ? (
        <ErrorMessage role="alert">{error}</ErrorMessage>
      ) : (
        <>
          <Table
            columns={columns}
            data={paginatedData}
            loading={loading}
            sortable
            onSort={(key, order) => setSortConfig({ key, order })}
            virtualScroll={virtualScroll}
            {...tableProps}
          />

          <Pagination
            currentPage={currentPage}
            totalItems={processedData.length}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            isLoading={loading}
          />
        </>
      )}
    </GridContainer>
  );
};

export type { DataGridProps, DataGridColumn };