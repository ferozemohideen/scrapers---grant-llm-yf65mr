/**
 * Enterprise-grade React hook for making API requests with comprehensive features
 * including type safety, request cancellation, correlation tracking, and enhanced error handling.
 * 
 * @version 1.0.0
 */

import { useState, useEffect, useCallback } from 'react'; // ^18.0.0
import { AxiosError } from 'axios'; // ^1.4.0
import { handleApiError } from '../utils/api.util';
import ApiService, { ApiResponse, RetryConfig } from '../services/api.service';

/**
 * HTTP methods supported by the hook
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Interface defining the state shape for the useFetch hook
 */
export interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  correlationId: string | null;
  retryCount: number;
}

/**
 * Interface for API error objects
 */
interface ApiError {
  message: string;
  code: number;
  details: Record<string, any> | null;
  requestId: string;
  timestamp: Date;
  retryable: boolean;
}

/**
 * Enhanced interface for hook configuration options
 */
export interface UseFetchOptions<T> {
  immediate?: boolean;
  params?: Record<string, any>;
  onSuccess?: (data: T) => void;
  onError?: (error: ApiError) => void;
  retryConfig?: RetryConfig;
  timeout?: number;
  cache?: boolean;
  validateStatus?: (status: number) => boolean;
}

/**
 * Cache implementation for storing request results
 */
const requestCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Creates a cache key from endpoint and params
 */
const createCacheKey = (endpoint: string, method: HttpMethod, params?: Record<string, any>): string => {
  return `${method}:${endpoint}:${JSON.stringify(params || {})}`;
};

/**
 * Enterprise-grade custom hook for making API requests
 * @param endpoint - API endpoint to call
 * @param method - HTTP method to use
 * @param options - Configuration options for the request
 */
export const useFetch = <T>(
  endpoint: string,
  method: HttpMethod = 'GET',
  options: UseFetchOptions<T> = {}
) => {
  // Initialize state with default values
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: false,
    error: null,
    correlationId: null,
    retryCount: 0
  });

  // Track if the component is mounted
  const [isMounted, setIsMounted] = useState(true);

  // Create a cache key for this request
  const cacheKey = createCacheKey(endpoint, method, options.params);

  /**
   * Reset the hook state to initial values
   */
  const reset = useCallback(() => {
    if (isMounted) {
      setState({
        data: null,
        loading: false,
        error: null,
        correlationId: null,
        retryCount: 0
      });
    }
  }, [isMounted]);

  /**
   * Execute the API request with proper error handling and caching
   */
  const execute = useCallback(async (data?: any) => {
    if (!isMounted) return;

    // Check cache first if enabled
    if (options.cache && method === 'GET') {
      const cached = requestCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        setState(prev => ({
          ...prev,
          data: cached.data,
          loading: false
        }));
        options.onSuccess?.(cached.data);
        return;
      }
    }

    setState(prev => ({
      ...prev,
      loading: true,
      error: null
    }));

    try {
      let response: ApiResponse<T>;

      switch (method) {
        case 'GET':
          response = await ApiService.get<T>(endpoint, options.params, {
            timeout: options.timeout,
            validateStatus: options.validateStatus,
            retryConfig: options.retryConfig
          });
          break;
        case 'POST':
          response = await ApiService.post<T>(endpoint, data, {
            timeout: options.timeout,
            validateStatus: options.validateStatus,
            retryConfig: options.retryConfig
          });
          break;
        case 'PUT':
          response = await ApiService.put<T>(endpoint, data, {
            timeout: options.timeout,
            validateStatus: options.validateStatus,
            retryConfig: options.retryConfig
          });
          break;
        case 'DELETE':
          response = await ApiService.delete<T>(endpoint, {
            timeout: options.timeout,
            validateStatus: options.validateStatus,
            retryConfig: options.retryConfig
          });
          break;
        default:
          throw new Error(`Unsupported HTTP method: ${method}`);
      }

      if (isMounted) {
        setState(prev => ({
          ...prev,
          data: response.data,
          loading: false,
          correlationId: response.correlationId
        }));

        // Cache successful GET requests if enabled
        if (options.cache && method === 'GET') {
          requestCache.set(cacheKey, {
            data: response.data,
            timestamp: Date.now()
          });
        }

        options.onSuccess?.(response.data);
      }
    } catch (error) {
      if (isMounted) {
        const apiError = error instanceof AxiosError
          ? handleApiError(error, error.config?.headers?.['X-Correlation-ID'])
          : {
              message: 'Unknown error occurred',
              code: 500,
              details: null,
              requestId: 'unknown',
              timestamp: new Date(),
              retryable: false
            };

        setState(prev => ({
          ...prev,
          error: apiError,
          loading: false,
          retryCount: prev.retryCount + 1
        }));

        options.onError?.(apiError);
      }
    }
  }, [endpoint, method, options, cacheKey, isMounted]);

  // Handle immediate execution if enabled
  useEffect(() => {
    if (options.immediate) {
      execute();
    }
  }, [execute, options.immediate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      setIsMounted(false);
      ApiService.cancelAllRequests();
    };
  }, []);

  return {
    ...state,
    execute,
    reset
  };
};

export default useFetch;
```

This implementation includes:

1. Comprehensive type safety with TypeScript interfaces
2. Request cancellation on component unmount
3. Automatic retry logic with configurable options
4. Request caching for GET requests
5. Correlation ID tracking
6. Loading and error states
7. Support for all major HTTP methods
8. Success and error callbacks
9. Request timeout configuration
10. Status validation
11. State reset capability
12. Memory leak prevention with mount tracking

The hook can be used like this:

```typescript
// Example usage
const { data, loading, error, execute } = useFetch<UserData>('/api/users', 'GET', {
  immediate: true,
  cache: true,
  timeout: 5000,
  onSuccess: (data) => console.log('Success:', data),
  onError: (error) => console.error('Error:', error),
  retryConfig: {
    maxRetries: 3,
    retryDelay: 1000,
    retryableStatuses: [500, 502, 503, 504]
  }
});