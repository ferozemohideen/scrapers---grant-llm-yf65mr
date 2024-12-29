import React, { useState, useMemo, useCallback } from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import { Loading } from './Loading';
import { Pagination } from './Pagination';

// Interfaces
export interface TableColumn<T> {
  key: string;
  title: string;
  sortable?: boolean;
  width?: string;
  render?: (value: T[keyof T], record: T, index: number) => React.ReactNode;
  ariaLabel?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  sortable?: boolean;
  onSort?: (key: string, order: 'asc' | 'desc') => void;
  className?: string;
  ariaLabel?: string;
  virtualScroll?: boolean;
  pageSize?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
}

// Styled Components
const TableContainer = styled.div`
  overflow-x: auto;
  width: 100%;
  background: var(--background-color);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-sm);
  position: relative;
  -webkit-overflow-scrolling: touch;
  
  @media (max-width: var(--breakpoint-md)) {
    border-radius: 0;
  }
`;

const StyledTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  min-width: 600px;
  table-layout: fixed;
`;

const TableHeader = styled.th<{ width?: string; sortable?: boolean }>`
  padding: var(--spacing-3);
  text-align: left;
  font-weight: var(--font-weight-medium);
  color: var(--text-color);
  background: var(--background-color-dark);
  border-bottom: 1px solid var(--border-color);
  width: ${props => props.width || 'auto'};
  cursor: ${props => props.sortable ? 'pointer' : 'default'};
  user-select: none;
  white-space: nowrap;
  position: sticky;
  top: 0;
  z-index: 1;

  &:hover {
    ${props => props.sortable && `
      background: var(--background-color-disabled);
    `}
  }

  &:focus-visible {
    outline: none;
    box-shadow: var(--focus-ring);
  }
`;

const TableCell = styled.td`
  padding: var(--spacing-3);
  border-bottom: 1px solid var(--border-color);
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SortIcon = styled.span<{ order?: 'asc' | 'desc' }>`
  margin-left: var(--spacing-2);
  opacity: ${props => props.order ? 1 : 0.3};
  &::after {
    content: '${props => props.order === 'asc' ? '↑' : '↓'}';
  }
`;

const LoadingOverlay = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
`;

// Main Component
export const Table = <T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  sortable = false,
  onSort,
  className,
  ariaLabel = 'Data table',
  virtualScroll = false,
  pageSize = 10,
  currentPage = 1,
  onPageChange
}: TableProps<T>): JSX.Element => {
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    order: 'asc' | 'desc';
  } | null>(null);

  // Memoized sorted data
  const sortedData = useMemo(() => {
    if (!sortConfig) return data;

    return [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;
      
      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.order === 'asc' ? comparison : -comparison;
    });
  }, [data, sortConfig]);

  // Handle sort
  const handleSort = useCallback((key: string) => {
    if (!sortable || !onSort) return;

    const newOrder = sortConfig?.key === key && sortConfig.order === 'asc' ? 'desc' : 'asc';
    setSortConfig({ key, order: newOrder });
    onSort(key, newOrder);
  }, [sortConfig, sortable, onSort]);

  // Handle keyboard sort
  const handleKeyDown = useCallback((event: React.KeyboardEvent, key: string) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleSort(key);
    }
  }, [handleSort]);

  // Calculate visible data range for pagination or virtual scroll
  const visibleData = useMemo(() => {
    if (virtualScroll) {
      // Implement virtual scrolling logic here if needed
      return sortedData;
    }

    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return sortedData.slice(start, end);
  }, [sortedData, currentPage, pageSize, virtualScroll]);

  return (
    <TableContainer className={className}>
      <StyledTable role="table" aria-label={ariaLabel}>
        <thead>
          <tr role="row">
            {columns.map(({ key, title, sortable: columnSortable, width, ariaLabel: columnAriaLabel }) => (
              <TableHeader
                key={key}
                width={width}
                sortable={sortable && columnSortable}
                onClick={() => columnSortable && handleSort(key)}
                onKeyDown={(e) => columnSortable && handleKeyDown(e, key)}
                tabIndex={columnSortable ? 0 : -1}
                role="columnheader"
                aria-sort={
                  sortConfig?.key === key
                    ? sortConfig.order === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
                aria-label={columnAriaLabel || title}
              >
                {title}
                {columnSortable && (
                  <SortIcon
                    order={sortConfig?.key === key ? sortConfig.order : undefined}
                    aria-hidden="true"
                  />
                )}
              </TableHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleData.map((record, index) => (
            <tr key={index} role="row">
              {columns.map(({ key, render }) => (
                <TableCell key={key} role="cell">
                  {render ? render(record[key], record, index) : record[key]}
                </TableCell>
              ))}
            </tr>
          ))}
        </tbody>
      </StyledTable>

      {loading && (
        <LoadingOverlay>
          <Loading size="medium" overlay={false} ariaLabel="Loading table data..." />
        </LoadingOverlay>
      )}

      {onPageChange && (
        <Pagination
          currentPage={currentPage}
          totalItems={data.length}
          pageSize={pageSize}
          onPageChange={onPageChange}
          isLoading={loading}
        />
      )}
    </TableContainer>
  );
};

export type { TableColumn, TableProps };