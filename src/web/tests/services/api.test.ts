import { describe, beforeEach, afterEach, it, expect, jest } from '@jest/globals';
import MockAdapter from 'axios-mock-adapter';
import { v4 as uuidv4 } from 'uuid';

import { ApiService, ApiResponse, RetryConfig } from '../../src/services/api.service';
import { handleApiError, createApiInstance } from '../../src/utils/api.util';
import { 
  API_BASE_URL, 
  API_TIMEOUT, 
  HTTP_STATUS, 
  API_ERROR_MESSAGES 
} from '../../src/constants/api.constants';

describe('ApiService', () => {
  let apiService: ApiService;
  let mockAxios: MockAdapter;
  const TEST_ENDPOINT = '/test';
  const CORRELATION_ID = uuidv4();
  const TEST_AUTH_TOKEN = 'test-jwt-token';

  // Test data
  const mockResponse = { data: 'test response' };
  const mockError = { message: 'test error' };

  beforeEach(() => {
    // Initialize new ApiService instance for each test
    apiService = new ApiService({
      maxRetries: 3,
      retryDelay: 100,
      retryableStatuses: [408, 429, 500, 502, 503, 504]
    });

    // Setup mock adapter
    const axiosInstance = createApiInstance({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT
    });
    mockAxios = new MockAdapter(axiosInstance);

    // Mock uuid generation for consistent correlation IDs in tests
    jest.spyOn(global, 'crypto').mockImplementation(() => ({
      randomUUID: () => CORRELATION_ID,
      // Add other required crypto methods
      subtle: {} as SubtleCrypto,
      getRandomValues: () => new Uint8Array(0)
    }));
  });

  afterEach(() => {
    mockAxios.reset();
    jest.clearAllMocks();
    apiService.cancelAllRequests();
  });

  describe('Request Validation', () => {
    it('should validate required fields in request payload', async () => {
      const invalidPayload = {};
      
      mockAxios.onPost(TEST_ENDPOINT).reply(422, {
        message: API_ERROR_MESSAGES.VALIDATION_ERROR,
        details: ['Required field missing']
      });

      await expect(apiService.post(TEST_ENDPOINT, invalidPayload))
        .rejects
        .toMatchObject({
          code: HTTP_STATUS.BAD_REQUEST,
          message: API_ERROR_MESSAGES.VALIDATION_ERROR
        });
    });

    it('should enforce content type requirements', async () => {
      const response = await apiService.get(TEST_ENDPOINT);
      expect(response.config.headers['Content-Type']).toBe('application/json');
    });

    it('should validate request headers', async () => {
      mockAxios.onGet(TEST_ENDPOINT).reply(config => {
        expect(config.headers).toHaveProperty('X-Correlation-ID');
        expect(config.headers['X-Correlation-ID']).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
        );
        return [200, mockResponse];
      });

      await apiService.get(TEST_ENDPOINT);
    });
  });

  describe('Retry Logic', () => {
    it('should retry failed requests up to max attempts', async () => {
      let attempts = 0;
      mockAxios.onGet(TEST_ENDPOINT).reply(() => {
        attempts++;
        return attempts < 3 ? [503, mockError] : [200, mockResponse];
      });

      const response = await apiService.get(TEST_ENDPOINT);
      expect(attempts).toBe(3);
      expect(response.data).toEqual(mockResponse);
    });

    it('should apply exponential backoff', async () => {
      const startTime = Date.now();
      mockAxios.onGet(TEST_ENDPOINT).reply(503);

      try {
        await apiService.get(TEST_ENDPOINT);
      } catch (error) {
        const duration = Date.now() - startTime;
        // Should wait: 100ms, 200ms, 400ms = 700ms total minimum
        expect(duration).toBeGreaterThanOrEqual(700);
      }
    });

    it('should respect retry status codes', async () => {
      mockAxios.onGet(TEST_ENDPOINT).reply(400, mockError);

      await expect(apiService.get(TEST_ENDPOINT))
        .rejects
        .toMatchObject({
          code: HTTP_STATUS.BAD_REQUEST,
          retryable: false
        });
    });
  });

  describe('Correlation Tracking', () => {
    it('should generate unique correlation IDs', async () => {
      const responses: ApiResponse<any>[] = [];

      mockAxios.onGet(TEST_ENDPOINT).reply(200, mockResponse);
      
      for (let i = 0; i < 3; i++) {
        const response = await apiService.get(TEST_ENDPOINT);
        responses.push(response);
      }

      const uniqueIds = new Set(responses.map(r => r.correlationId));
      expect(uniqueIds.size).toBe(3);
    });

    it('should maintain correlation ID across retries', async () => {
      let correlationId: string | undefined;
      
      mockAxios.onGet(TEST_ENDPOINT).reply(config => {
        if (!correlationId) {
          correlationId = config.headers['X-Correlation-ID'];
        } else {
          expect(config.headers['X-Correlation-ID']).toBe(correlationId);
        }
        return [503, mockError];
      });

      try {
        await apiService.get(TEST_ENDPOINT);
      } catch (error) {
        expect(error.requestId).toBe(correlationId);
      }
    });
  });

  describe('Authentication', () => {
    it('should set authentication token correctly', async () => {
      apiService.setAuthToken(TEST_AUTH_TOKEN);

      mockAxios.onGet(TEST_ENDPOINT).reply(config => {
        expect(config.headers['Authorization']).toBe(`Bearer ${TEST_AUTH_TOKEN}`);
        return [200, mockResponse];
      });

      await apiService.get(TEST_ENDPOINT);
    });

    it('should handle unauthorized requests', async () => {
      mockAxios.onGet(TEST_ENDPOINT).reply(401, {
        message: API_ERROR_MESSAGES.UNAUTHORIZED
      });

      await expect(apiService.get(TEST_ENDPOINT))
        .rejects
        .toMatchObject({
          code: HTTP_STATUS.UNAUTHORIZED,
          message: API_ERROR_MESSAGES.UNAUTHORIZED
        });
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel active requests', async () => {
      const promise = apiService.get(TEST_ENDPOINT);
      apiService.cancelAllRequests();

      await expect(promise).rejects.toThrow('canceled');
    });

    it('should cleanup aborted requests', async () => {
      const promise = apiService.get(TEST_ENDPOINT);
      apiService.cancelAllRequests();

      try {
        await promise;
      } catch {
        // Verify active requests map is cleared
        expect(apiService['activeRequests'].size).toBe(0);
      }
    });
  });

  describe('Timeout Handling', () => {
    it('should respect global timeout settings', async () => {
      mockAxios.onGet(TEST_ENDPOINT).reply(() => {
        return new Promise(resolve => setTimeout(resolve, API_TIMEOUT + 100));
      });

      await expect(apiService.get(TEST_ENDPOINT))
        .rejects
        .toMatchObject({
          message: API_ERROR_MESSAGES.TIMEOUT
        });
    });

    it('should handle per-request timeouts', async () => {
      const customTimeout = 500;
      mockAxios.onGet(TEST_ENDPOINT).reply(() => {
        return new Promise(resolve => setTimeout(resolve, customTimeout + 100));
      });

      await expect(apiService.get(TEST_ENDPOINT, undefined, { timeout: customTimeout }))
        .rejects
        .toMatchObject({
          message: API_ERROR_MESSAGES.TIMEOUT
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockAxios.onGet(TEST_ENDPOINT).networkError();

      await expect(apiService.get(TEST_ENDPOINT))
        .rejects
        .toMatchObject({
          message: API_ERROR_MESSAGES.NETWORK_ERROR,
          retryable: true
        });
    });

    it('should handle server errors', async () => {
      mockAxios.onGet(TEST_ENDPOINT).reply(500, {
        message: API_ERROR_MESSAGES.SERVER_ERROR
      });

      await expect(apiService.get(TEST_ENDPOINT))
        .rejects
        .toMatchObject({
          code: HTTP_STATUS.SERVER_ERROR,
          message: API_ERROR_MESSAGES.SERVER_ERROR,
          retryable: true
        });
    });
  });
});