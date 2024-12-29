/**
 * @fileoverview Enhanced filter panel component for technology transfer search refinement
 * Implements comprehensive filtering with accessibility and performance optimizations
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo, useReducer } from 'react';
import classNames from 'classnames'; // v2.3.1
import { VirtualizedList, AutoSizer } from 'react-virtualized'; // v9.22.3
import { Checkbox, CheckboxProps } from '../common/Checkbox';
import { DatePicker } from '../common/DatePicker';
import { useDebounce } from '../../hooks/useDebounce';
import { SearchFilters, SearchFacets, DateRange } from '../../interfaces/search.interface';
import styles from './FilterPanel.module.css';

// Action types for filter state management
type FilterAction = 
  | { type: 'SET_INSTITUTIONS'; payload: string[] }
  | { type: 'SET_CATEGORIES'; payload: string[] }
  | { type: 'SET_DATE_RANGE'; payload: DateRange }
  | { type: 'RESET_FILTERS' };

// Enhanced props interface with error handling
export interface FilterPanelProps {
  filters: SearchFilters;
  onFilterChange: (filters: SearchFilters) => void;
  facets: SearchFacets;
  loading?: boolean;
  className?: string;
  error?: boolean;
  errorMessage?: string;
}

// Initial state factory for filter reducer
const createInitialState = (filters: SearchFilters): SearchFilters => ({
  institutions: [...filters.institutions],
  categories: [...filters.categories],
  dateRange: { ...filters.dateRange },
  tags: [...filters.tags]
});

// Filter state reducer with immutable updates
const filterReducer = (state: SearchFilters, action: FilterAction): SearchFilters => {
  switch (action.type) {
    case 'SET_INSTITUTIONS':
      return { ...state, institutions: action.payload };
    case 'SET_CATEGORIES':
      return { ...state, categories: action.payload };
    case 'SET_DATE_RANGE':
      return { ...state, dateRange: action.payload };
    case 'RESET_FILTERS':
      return createInitialState({
        institutions: [],
        categories: [],
        dateRange: { start: '', end: '' },
        tags: []
      });
    default:
      return state;
  }
};

/**
 * Enhanced FilterPanel component with performance optimizations
 */
export const FilterPanel: React.FC<FilterPanelProps> = React.memo(({
  filters,
  onFilterChange,
  facets,
  loading = false,
  className,
  error = false,
  errorMessage
}) => {
  // Initialize filter state with reducer for better performance
  const [filterState, dispatch] = useReducer(filterReducer, filters, createInitialState);

  // Debounce filter changes to prevent excessive updates
  const debouncedFilters = useDebounce(filterState, 300);

  // Notify parent of filter changes
  useEffect(() => {
    onFilterChange(debouncedFilters);
  }, [debouncedFilters, onFilterChange]);

  // Memoized handlers for filter changes
  const handleInstitutionChange = useCallback((institution: string, checked: boolean) => {
    const newInstitutions = checked
      ? [...filterState.institutions, institution]
      : filterState.institutions.filter(i => i !== institution);
    dispatch({ type: 'SET_INSTITUTIONS', payload: newInstitutions });
  }, [filterState.institutions]);

  const handleCategoryChange = useCallback((category: string, checked: boolean) => {
    const newCategories = checked
      ? [...filterState.categories, category]
      : filterState.categories.filter(c => c !== category);
    dispatch({ type: 'SET_CATEGORIES', payload: newCategories });
  }, [filterState.categories]);

  const handleDateRangeChange = useCallback((dateRange: DateRange) => {
    dispatch({ type: 'SET_DATE_RANGE', payload: dateRange });
  }, []);

  // Virtualized institution list renderer
  const renderInstitution = useCallback(({ index, style }: any) => {
    const institution = facets.institutions[index];
    return (
      <div style={style} className={styles['filter-panel__checkbox-item']}>
        <Checkbox
          name={`institution-${institution.key}`}
          label={`${institution.key} (${institution.count})`}
          checked={filterState.institutions.includes(institution.key)}
          onChange={(e) => handleInstitutionChange(institution.key, e.target.checked)}
          className={styles['filter-panel__checkbox']}
        />
      </div>
    );
  }, [facets.institutions, filterState.institutions, handleInstitutionChange]);

  // Virtualized category list renderer
  const renderCategory = useCallback(({ index, style }: any) => {
    const category = facets.categories[index];
    return (
      <div style={style} className={styles['filter-panel__checkbox-item']}>
        <Checkbox
          name={`category-${category.key}`}
          label={`${category.key} (${category.count})`}
          checked={filterState.categories.includes(category.key)}
          onChange={(e) => handleCategoryChange(category.key, e.target.checked)}
          className={styles['filter-panel__checkbox']}
        />
      </div>
    );
  }, [facets.categories, filterState.categories, handleCategoryChange]);

  // Compute container classes
  const containerClasses = classNames(
    styles['filter-panel'],
    {
      [styles['filter-panel--loading']]: loading,
      [styles['filter-panel--error']]: error
    },
    className
  );

  return (
    <div 
      className={containerClasses}
      role="complementary"
      aria-label="Search filters"
      aria-busy={loading}
    >
      {error && (
        <div 
          className={styles['filter-panel__error']}
          role="alert"
          aria-live="polite"
        >
          {errorMessage || 'Error loading filters'}
        </div>
      )}

      <section className={styles['filter-panel__section']}>
        <h3 className={styles['filter-panel__section-title']}>
          Institutions
        </h3>
        <div className={styles['filter-panel__checkbox-list']}>
          <AutoSizer>
            {({ width, height }) => (
              <VirtualizedList
                width={width}
                height={height}
                rowCount={facets.institutions.length}
                rowHeight={40}
                rowRenderer={renderInstitution}
                overscanRowCount={5}
                aria-label="Institution filters"
              />
            )}
          </AutoSizer>
        </div>
      </section>

      <section className={styles['filter-panel__section']}>
        <h3 className={styles['filter-panel__section-title']}>
          Categories
        </h3>
        <div className={styles['filter-panel__checkbox-list']}>
          <AutoSizer>
            {({ width, height }) => (
              <VirtualizedList
                width={width}
                height={height}
                rowCount={facets.categories.length}
                rowHeight={40}
                rowRenderer={renderCategory}
                overscanRowCount={5}
                aria-label="Category filters"
              />
            )}
          </AutoSizer>
        </div>
      </section>

      <section className={styles['filter-panel__section']}>
        <h3 className={styles['filter-panel__section-title']}>
          Date Range
        </h3>
        <div className={styles['filter-panel__date-range']}>
          <DatePicker
            name="date-range-start"
            value={filterState.dateRange.start}
            onChange={(date) => handleDateRangeChange({
              ...filterState.dateRange,
              start: date ? date.toISOString() : ''
            })}
            placeholder="Start Date"
            className={styles['filter-panel__date-picker']}
          />
          <DatePicker
            name="date-range-end"
            value={filterState.dateRange.end}
            onChange={(date) => handleDateRangeChange({
              ...filterState.dateRange,
              end: date ? date.toISOString() : ''
            })}
            placeholder="End Date"
            className={styles['filter-panel__date-picker']}
          />
        </div>
      </section>
    </div>
  );
});

FilterPanel.displayName = 'FilterPanel';

export default FilterPanel;