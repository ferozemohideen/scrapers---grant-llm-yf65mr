import { renderHook, act, waitFor } from '@testing-library/react'; // ^14.0.0
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'; // ^29.0.0
import type { MockedFunction } from 'jest';

import { useFetch } from '../../src/hooks/useFetch';
import ApiService from '../../src/services/api.service';
import { API_ERROR_MESSAGES, HTTP_STATUS } from '../../src/constants/api.constants';

// Mock API Service
jest.mock('../../src/services/api.service', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    setCorrelationId: jest.fn(),
    cancelAllRequests: jest.fn()
  }
}));

// Mock console.error to prevent noise in test output
jest.spyOn(console, 'error').mockImplementation(() => {});

describe('useFetch Hook', () => {
  // Type definitions for test data
  interface TestData {
    id: number;
    name: string;
  }

  const mockData: TestData = { id: 1, name: 'Test' };
  const mockEndpoint = '/api/test';
  const mockCorrelationId = '123e4567-e89b-12d3-a456-426614174000';
  const mockError = {
    message: 'Test error',
    code: HTTP_STATUS.SERVER_ERROR,
    details: null,
    requestId: mockCorrelationId,
    timestamp: new Date(),
    retryable: true
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Functionality', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useFetch<TestData>(mockEndpoint));

      expect(result.current).toEqual({
        data: null,
        loading: false,
        error: null,
        correlationId: null,
        retryCount: 0,
        execute: expect.any(Function),
        reset: expect.any(Function)
      });
    });

    it('should handle successful GET request', async () => {
      (ApiService.get as MockedFunction<typeof ApiService.get>).mockResolvedValueOnce({
        data: mockData,
        status: HTTP_STATUS.OK,
        message: 'Success',
        correlationId: mockCorrelationId
      });

      const { result } = renderHook(() => useFetch<TestData>(mockEndpoint));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toEqual(mockData);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.correlationId).toBe(mockCorrelationId);
    });

    it('should handle API error', async () => {
      (ApiService.get as MockedFunction<typeof ApiService.get>).mockRejectedValueOnce(mockError);

      const { result } = renderHook(() => useFetch<TestData>(mockEndpoint));

      await act(async () => {
        await result.current.execute();
      });

      expect(result.current.data).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toEqual(mockError);
      expect(result.current.retryCount).toBe(1);
    });
  });

  describe('Advanced Features', () => {
    it('should handle request cancellation on unmount', () => {
      const { unmount } = renderHook(() => useFetch<TestData>(mockEndpoint));
      
      unmount();
      
      expect(ApiService.cancelAllRequests).toHaveBeenCalled();
    });

    it('should support request caching for GET requests', async () => {
      const mockResponse = {
        data: mockData,
        status: HTTP_STATUS.OK,
        message: 'Success',
        correlationId: mockCorrelationId
      };

      (ApiService.get as MockedFunction<typeof ApiService.get>).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => 
        useFetch<TestData>(mockEndpoint, 'GET', { cache: true })
      );

      // First request
      await act(async () => {
        await result.current.execute();
      });

      // Second request should use cache
      await act(async () => {
        await result.current.execute();
      });

      expect(ApiService.get).toHaveBeenCalledTimes(1);
      expect(result.current.data).toEqual(mockData);
    });

    it('should implement retry logic with exponential backoff', async () => {
      const retryConfig = {
        maxRetries: 2,
        retryDelay: 100,
        retryableStatuses: [500]
      };

      (ApiService.get as MockedFunction<typeof ApiService.get>)
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({
          data: mockData,
          status: HTTP_STATUS.OK,
          message: 'Success',
          correlationId: mockCorrelationId
        });

      const { result } = renderHook(() => 
        useFetch<TestData>(mockEndpoint, 'GET', { retryConfig })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(ApiService.get).toHaveBeenCalledTimes(3);
      expect(result.current.data).toEqual(mockData);
      expect(result.current.retryCount).toBe(2);
    });

    it('should handle request timeout', async () => {
      const timeout = 1000;
      const timeoutError = {
        ...mockError,
        message: API_ERROR_MESSAGES.TIMEOUT
      };

      (ApiService.get as MockedFunction<typeof ApiService.get>).mockRejectedValueOnce(timeoutError);

      const { result } = renderHook(() => 
        useFetch<TestData>(mockEndpoint, 'GET', { timeout })
      );

      await act(async () => {
        await result.current.execute();
      });

      expect(ApiService.get).toHaveBeenCalledWith(
        mockEndpoint,
        undefined,
        expect.objectContaining({ timeout })
      );
      expect(result.current.error).toEqual(timeoutError);
    });

    it('should support custom status validation', async () => {
      const validateStatus = (status: number) => status === 201;
      
      const { result } = renderHook(() => 
        useFetch<TestData>(mockEndpoint, 'POST', { validateStatus })
      );

      await act(async () => {
        await result.current.execute(mockData);
      });

      expect(ApiService.post).toHaveBeenCalledWith(
        mockEndpoint,
        mockData,
        expect.objectContaining({ validateStatus })
      );
    });

    it('should track correlation IDs', async () => {
      const mockResponse = {
        data: mockData,
        status: HTTP_STATUS.OK,
        message: 'Success',
        correlationId: mockCorrelationId
      };

      (ApiService.post as MockedFunction<typeof ApiService.post>).mockResolvedValueOnce(mockResponse);

      const { result } = renderHook(() => useFetch<TestData>(mockEndpoint, 'POST'));

      await act(async () => {
        await result.current.execute(mockData);
      });

      expect(result.current.correlationId).toBe(mockCorrelationId);
    });

    it('should reset state correctly', async () => {
      const { result } = renderHook(() => useFetch<TestData>(mockEndpoint));

      await act(async () => {
        result.current.reset();
      });

      expect(result.current).toEqual({
        data: null,
        loading: false,
        error: null,
        correlationId: null,
        retryCount: 0,
        execute: expect.any(Function),
        reset: expect.any(Function)
      });
    });
  });
});