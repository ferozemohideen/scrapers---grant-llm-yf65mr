import React, { useState, useCallback, useRef, useEffect } from 'react';
import classNames from 'classnames'; // v2.3.1
import useDebounce from '../../hooks/useDebounce';
import Input from '../common/Input';
import SearchService from '../../services/search.service';
import { SearchFilters } from '../../interfaces/search.interface';

/**
 * Props interface for SearchBar component with comprehensive type definitions
 */
export interface SearchBarProps {
  /** Async callback function triggered when search is executed */
  onSearch: (query: string, filters?: SearchFilters) => Promise<void>;
  /** Customizable placeholder text for search input */
  placeholder?: string;
  /** Additional CSS classes for styling customization */
  className?: string;
  /** Control input auto-focus behavior */
  autoFocus?: boolean;
  /** Custom debounce timing in milliseconds */
  debounceTime?: number;
  /** Maximum number of suggestions to display */
  maxSuggestions?: number;
}

/**
 * Enhanced SearchBar component with accessibility and performance optimizations
 */
const SearchBar: React.FC<SearchBarProps> = React.memo(({
  onSearch,
  placeholder = 'Search technologies...',
  className,
  autoFocus = false,
  debounceTime = 300,
  maxSuggestions = 5
}) => {
  // State management
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);

  // Refs
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search value for performance
  const debouncedSearchValue = useDebounce(inputValue, debounceTime);

  // Effect to fetch suggestions when debounced value changes
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!debouncedSearchValue || debouncedSearchValue.length < 2) {
        setSuggestions([]);
        return;
      }

      try {
        // Cancel previous request if exists
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        abortControllerRef.current = new AbortController();
        setIsLoading(true);
        setError(null);

        const suggestionResults = await SearchService.getSuggestions(debouncedSearchValue);
        setSuggestions(suggestionResults.slice(0, maxSuggestions));
        setShowSuggestions(true);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('Failed to fetch suggestions');
          console.error('Suggestion fetch error:', err);
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedSearchValue, maxSuggestions]);

  // Handle input changes
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    setSelectedSuggestionIndex(-1);
    setError(null);
  }, []);

  // Handle suggestion selection
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setInputValue(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion);
  }, [onSearch]);

  // Handle form submission
  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    setShowSuggestions(false);
    setIsLoading(true);
    setError(null);

    try {
      await onSearch(inputValue);
    } catch (err) {
      setError('Search failed. Please try again.');
      console.error('Search error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, onSearch]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || !suggestions.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedSuggestionIndex(prev => prev > -1 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedSuggestionIndex >= 0) {
          handleSuggestionClick(suggestions[selectedSuggestionIndex]);
        } else {
          handleSubmit(e);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  }, [showSuggestions, suggestions, selectedSuggestionIndex, handleSuggestionClick, handleSubmit]);

  // Click outside handler to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compose class names
  const containerClasses = classNames(
    'search-container',
    className,
    {
      'search-container--loading': isLoading,
      'search-container--error': error
    }
  );

  return (
    <div 
      ref={searchContainerRef}
      className={containerClasses}
      role="search"
      aria-label="Search technologies"
    >
      <form onSubmit={handleSubmit}>
        <Input
          id="search-input"
          name="search"
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="search-input"
          autoFocus={autoFocus}
          aria-expanded={showSuggestions}
          aria-controls="search-suggestions"
          aria-activedescendant={
            selectedSuggestionIndex >= 0 
              ? `suggestion-${selectedSuggestionIndex}` 
              : undefined
          }
          aria-invalid={!!error}
          disabled={isLoading}
          label="Search"
        />

        {isLoading && (
          <div 
            className="loading-indicator" 
            aria-live="polite"
            aria-busy="true"
          >
            Loading...
          </div>
        )}

        {error && (
          <div 
            className="error-message" 
            role="alert"
            aria-live="assertive"
          >
            {error}
          </div>
        )}

        {showSuggestions && suggestions.length > 0 && (
          <ul
            id="search-suggestions"
            className="suggestions-dropdown"
            role="listbox"
          >
            {suggestions.map((suggestion, index) => (
              <li
                key={suggestion}
                id={`suggestion-${index}`}
                className={classNames('suggestion-item', {
                  'suggestion-item--selected': index === selectedSuggestionIndex
                })}
                role="option"
                aria-selected={index === selectedSuggestionIndex}
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion}
              </li>
            ))}
          </ul>
        )}
      </form>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;