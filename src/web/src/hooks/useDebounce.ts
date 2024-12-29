// @package react ^18.0.0
import { useState, useEffect } from 'react';

/**
 * A custom hook that provides debounced value updates to optimize performance.
 * Reduces the frequency of state updates and subsequent re-renders or API calls.
 * 
 * @template T The type of value being debounced
 * @param {T} value The value to be debounced
 * @param {number} delay The delay in milliseconds before updating the debounced value
 * @returns {T} The debounced value
 * 
 * @example
 * ```tsx
 * const SearchComponent = () => {
 *   const [searchTerm, setSearchTerm] = useState('');
 *   const debouncedSearchTerm = useDebounce(searchTerm, 500);
 * 
 *   useEffect(() => {
 *     // API call will only be made 500ms after the user stops typing
 *     searchAPI(debouncedSearchTerm);
 *   }, [debouncedSearchTerm]);
 * 
 *   return <input onChange={(e) => setSearchTerm(e.target.value)} />;
 * };
 * ```
 */
function useDebounce<T>(value: T, delay: number): T {
  // Initialize state with the provided value
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // Create a timeout to update the debounced value after the specified delay
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cleanup function to clear the timeout if value changes or component unmounts
    // This prevents memory leaks and ensures proper cleanup
    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delay]); // Only re-run effect if value or delay changes

  return debouncedValue;
}

/**
 * Type definition for the useDebounce hook function signature.
 * Ensures type safety when using the hook across the application.
 */
export type UseDebounceHook = typeof useDebounce;

// Export the hook as the default export for easier imports
export default useDebounce;