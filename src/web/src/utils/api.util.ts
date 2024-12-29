/**
 * API Utilities Module
 * Provides enterprise-grade utilities for API request handling, error management,
 * authentication, and monitoring capabilities.
 * 
 * @version 1.0.0
 * @module utils/api
 */

import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.4.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0
import {
  API_BASE_URL,
  API_TIMEOUT,
  API_RETRY_CONFIG,
  API_ERROR_MESSAGES,
  HTTP_STATUS
} from '../constants/api.constants';

/**
 * Interface for standardized API error objects
 */
export interface ApiError {
  message: string;
  code: number;
  details: Record<string, any> | null;
  requestId: string;
  timestamp: Date;
  retryable: boolean;
}

/**
 * Interface for API request metrics
 */
export interface ApiMetrics {
  requestId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  endpoint: string;
  method: string;
  status: number;
  success: boolean;
}

/**
 * Enhanced error handler with retry logic and detailed error mapping
 * @param error - Axios error object
 * @param requestId - Unique request identifier
 * @returns Standardized API error object
 */
export const handleApiError = (error: AxiosError, requestId: string): ApiError => {
  const timestamp = new Date();
  
  // Default error structure
  const apiError: ApiError = {
    message: API_ERROR_MESSAGES.SERVER_ERROR,
    code: HTTP_STATUS.SERVER_ERROR,
    details: null,
    requestId,
    timestamp,
    retryable: false
  };

  if (error.response) {
    // Server responded with error
    apiError.code = error.response.status;
    apiError.message = error.response.data?.message || API_ERROR_MESSAGES.SERVER_ERROR;
    apiError.details = error.response.data?.details || null;
    
    // Determine if error is retryable based on status code
    apiError.retryable = [
      HTTP_STATUS.SERVER_ERROR,
      503, // Service Unavailable
      504  // Gateway Timeout
    ].includes(error.response.status);
  } else if (error.request) {
    // Request made but no response received
    apiError.message = API_ERROR_MESSAGES.NETWORK_ERROR;
    apiError.code = 0;
    apiError.retryable = true;
  }

  // Log error for monitoring
  console.error(`API Error [${requestId}]:`, {
    ...apiError,
    stack: error.stack
  });

  return apiError;
};

/**
 * Enhanced authentication header manager with token refresh logic
 * @param token - Authentication token
 * @param refreshToken - Refresh token
 */
export const setAuthHeader = async (
  token: string | null,
  refreshToken: string | null
): Promise<void> => {
  if (token) {
    try {
      // Check token expiration
      const tokenData = JSON.parse(atob(token.split('.')[1]));
      const isExpired = tokenData.exp * 1000 < Date.now();

      if (isExpired && refreshToken) {
        // Attempt to refresh token
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh`,
          { refreshToken }
        );
        token = response.data.token;
      }

      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      console.error('Token processing error:', error);
      // Clear invalid tokens
      token = null;
      refreshToken = null;
      delete axios.defaults.headers.common['Authorization'];
    }
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
};

/**
 * Creates a configured axios instance with monitoring and retry capabilities
 * @param config - Axios configuration options
 * @returns Configured axios instance
 */
export const createApiInstance = (config?: AxiosRequestConfig): AxiosInstance => {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    timeout: API_TIMEOUT,
    ...config
  });

  // Request interceptor
  instance.interceptors.request.use((config) => {
    const requestId = uuidv4();
    config.headers['X-Request-ID'] = requestId;
    
    // Initialize metrics collection
    const metrics: ApiMetrics = {
      requestId,
      startTime: new Date(),
      endTime: new Date(),
      duration: 0,
      endpoint: config.url || '',
      method: config.method?.toUpperCase() || 'UNKNOWN',
      status: 0,
      success: false
    };

    // Attach metrics to request for later use
    (config as any).metrics = metrics;

    return config;
  });

  // Response interceptor
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      const metrics = (response.config as any).metrics as ApiMetrics;
      metrics.endTime = new Date();
      metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
      metrics.status = response.status;
      metrics.success = true;

      // Collect metrics asynchronously
      collectMetrics(metrics).catch(console.error);

      return response;
    },
    async (error: AxiosError) => {
      const metrics = (error.config as any)?.metrics as ApiMetrics;
      if (metrics) {
        metrics.endTime = new Date();
        metrics.duration = metrics.endTime.getTime() - metrics.startTime.getTime();
        metrics.status = error.response?.status || 0;
        metrics.success = false;

        // Collect metrics asynchronously
        collectMetrics(metrics).catch(console.error);
      }

      // Implement retry logic
      if (error.config && API_RETRY_CONFIG.attempts > 0) {
        const retryConfig = error.config as any;
        retryConfig.retryCount = retryConfig.retryCount || 0;

        if (retryConfig.retryCount < API_RETRY_CONFIG.attempts) {
          retryConfig.retryCount += 1;
          await new Promise(resolve => 
            setTimeout(resolve, API_RETRY_CONFIG.delay * retryConfig.retryCount)
          );
          return instance(retryConfig);
        }
      }

      const requestId = error.config?.headers?.['X-Request-ID'] || uuidv4();
      throw handleApiError(error, requestId);
    }
  );

  return instance;
};

/**
 * Collects and processes API request metrics
 * @param metrics - API metrics object
 */
export const collectMetrics = async (metrics: ApiMetrics): Promise<void> => {
  try {
    // Format metrics for monitoring system
    const formattedMetrics = {
      ...metrics,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    };

    // Send metrics to monitoring system
    // This would typically integrate with your monitoring service
    // For now, we'll just log them
    console.debug('API Metrics:', formattedMetrics);

    // Check performance thresholds
    if (metrics.duration > API_TIMEOUT * 0.8) {
      console.warn('API Performance Warning:', {
        endpoint: metrics.endpoint,
        duration: metrics.duration,
        threshold: API_TIMEOUT * 0.8
      });
    }
  } catch (error) {
    console.error('Error collecting metrics:', error);
  }
};

// Create and export default API instance
export default createApiInstance();