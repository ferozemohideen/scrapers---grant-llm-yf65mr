import React from 'react';
import { render, fireEvent, waitFor, screen, within } from '@testing-library/react';
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import SearchBar, { SearchBarProps } from '../../src/components/search/SearchBar';
import SearchService from '../../src/services/search.service';

// Mock the search service
jest.mock('../../src/services/search.service', () => ({
  search: jest.fn(),
  getSuggestions: jest.fn()
}));

describe('SearchBar', () => {
  // Default props for testing
  const defaultProps: SearchBarProps = {
    onSearch: jest.fn(),
    placeholder: 'Search technologies...',
    autoFocus: false,
    debounceTime: 300,
    maxSuggestions: 5
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Reset search service mock implementation
    (SearchService.getSuggestions as jest.Mock).mockResolvedValue([]);
  });

  describe('Component Rendering', () => {
    it('should render correctly with default props', () => {
      render(<SearchBar {...defaultProps} />);
      
      const searchContainer = screen.getByRole('search');
      const searchInput = screen.getByRole('textbox');
      
      expect(searchContainer).toBeInTheDocument();
      expect(searchInput).toBeInTheDocument();
      expect(searchInput).toHaveAttribute('placeholder', 'Search technologies...');
      expect(searchInput).toHaveAttribute('aria-expanded', 'false');
    });

    it('should apply custom className when provided', () => {
      const { container } = render(
        <SearchBar {...defaultProps} className="custom-search" />
      );
      expect(container.firstChild).toHaveClass('custom-search');
    });
  });

  describe('Input Handling', () => {
    it('should update input value on change', async () => {
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'test query' } });
      expect(input).toHaveValue('test query');
    });

    it('should debounce input changes', async () => {
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'test' } });
      
      // Fast-forward timers
      jest.advanceTimersByTime(200);
      expect(SearchService.getSuggestions).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(100);
      await waitFor(() => {
        expect(SearchService.getSuggestions).toHaveBeenCalledWith('test');
      });
    });

    it('should clear input and suggestions on clear button click', () => {
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'test' } });
      expect(input).toHaveValue('test');
      
      const clearButton = screen.getByLabelText('Clear search');
      fireEvent.click(clearButton);
      
      expect(input).toHaveValue('');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('should trigger search on form submission', async () => {
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByRole('textbox');
      const form = screen.getByRole('search').querySelector('form');
      
      fireEvent.change(input, { target: { value: 'test query' } });
      fireEvent.submit(form!);
      
      expect(defaultProps.onSearch).toHaveBeenCalledWith('test query');
    });

    it('should not trigger search with empty query', () => {
      render(<SearchBar {...defaultProps} />);
      const form = screen.getByRole('search').querySelector('form');
      
      fireEvent.submit(form!);
      expect(defaultProps.onSearch).not.toHaveBeenCalled();
    });

    it('should show loading state during search', async () => {
      defaultProps.onSearch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      render(<SearchBar {...defaultProps} />);
      
      const input = screen.getByRole('textbox');
      const form = screen.getByRole('search').querySelector('form');
      
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.submit(form!);
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      });
    });
  });

  describe('Suggestions Display', () => {
    const mockSuggestions = ['suggestion 1', 'suggestion 2', 'suggestion 3'];

    beforeEach(() => {
      (SearchService.getSuggestions as jest.Mock).mockResolvedValue(mockSuggestions);
    });

    it('should display suggestions when input has 2 or more characters', async () => {
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'te' } });
      jest.advanceTimersByTime(300);
      
      await waitFor(() => {
        const suggestions = screen.getByRole('listbox');
        expect(suggestions).toBeInTheDocument();
        expect(suggestions.children).toHaveLength(3);
      });
    });

    it('should limit suggestions to maxSuggestions prop', async () => {
      render(<SearchBar {...defaultProps} maxSuggestions={2} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'test' } });
      jest.advanceTimersByTime(300);
      
      await waitFor(() => {
        const suggestions = screen.getByRole('listbox');
        expect(suggestions.children).toHaveLength(2);
      });
    });
  });

  describe('Keyboard Navigation', () => {
    const mockSuggestions = ['suggestion 1', 'suggestion 2'];

    beforeEach(() => {
      (SearchService.getSuggestions as jest.Mock).mockResolvedValue(mockSuggestions);
    });

    it('should navigate suggestions with arrow keys', async () => {
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'test' } });
      jest.advanceTimersByTime(300);
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByText('suggestion 1')).toHaveAttribute('aria-selected', 'true');
      
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByText('suggestion 2')).toHaveAttribute('aria-selected', 'true');
    });

    it('should select suggestion with Enter key', async () => {
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'test' } });
      jest.advanceTimersByTime(300);
      
      await waitFor(() => {
        expect(screen.getByRole('listbox')).toBeInTheDocument();
      });
      
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'Enter' });
      
      expect(input).toHaveValue('suggestion 1');
      expect(defaultProps.onSearch).toHaveBeenCalledWith('suggestion 1');
    });
  });

  describe('Accessibility Features', () => {
    it('should have proper ARIA attributes', () => {
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      expect(input).toHaveAttribute('aria-label', 'Search');
      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).toHaveAttribute('aria-controls', 'search-suggestions');
    });

    it('should announce loading state', async () => {
      defaultProps.onSearch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)));
      render(<SearchBar {...defaultProps} />);
      
      const form = screen.getByRole('search').querySelector('form');
      fireEvent.submit(form!);
      
      const loadingIndicator = screen.getByText('Loading...');
      expect(loadingIndicator).toHaveAttribute('aria-live', 'polite');
      expect(loadingIndicator).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('Error Handling', () => {
    it('should display error message on search failure', async () => {
      const error = new Error('Search failed');
      defaultProps.onSearch.mockRejectedValue(error);
      
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByRole('textbox');
      const form = screen.getByRole('search').querySelector('form');
      
      fireEvent.change(input, { target: { value: 'test' } });
      fireEvent.submit(form!);
      
      await waitFor(() => {
        const errorMessage = screen.getByRole('alert');
        expect(errorMessage).toHaveTextContent('Search failed. Please try again.');
      });
    });
  });

  describe('Performance Optimization', () => {
    it('should cleanup on unmount', () => {
      const { unmount } = render(<SearchBar {...defaultProps} />);
      unmount();
      // Verify that all timers and subscriptions are cleaned up
      expect(jest.getTimerCount()).toBe(0);
    });

    it('should abort previous suggestions request when new input is received', async () => {
      render(<SearchBar {...defaultProps} />);
      const input = screen.getByRole('textbox');
      
      fireEvent.change(input, { target: { value: 'test1' } });
      fireEvent.change(input, { target: { value: 'test2' } });
      
      jest.advanceTimersByTime(300);
      
      await waitFor(() => {
        expect(SearchService.getSuggestions).toHaveBeenCalledTimes(1);
        expect(SearchService.getSuggestions).toHaveBeenLastCalledWith('test2');
      });
    });
  });
});