/**
 * API Service Class
 * Provides enterprise-grade HTTP request handling with comprehensive error management,
 * authentication, metrics collection, and retry logic.
 * 
 * @version 1.0.0
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'; // ^1.4.0
import { v4 as uuidv4 } from 'uuid'; // ^9.0.0

import { 
  API_BASE_URL, 
  API_TIMEOUT 
} from '../constants/api.constants';

import { 
  createApiInstance, 
  handleApiError 
} from '../utils/api.util';

/**
 * Generic interface for API responses
 */
export interface ApiResponse<T> {
  data: T;
  status: number;
  message: string;
  correlationId: string;
}

/**
 * Configuration interface for retry behavior
 */
export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  retryableStatuses: number[];
}

/**
 * Request configuration interface extending AxiosRequestConfig
 */
export interface RequestConfig extends AxiosRequestConfig {
  skipRetry?: boolean;
  timeout?: number;
  validateStatus?: (status: number) => boolean;
}

/**
 * Enhanced API service class for handling all API communications
 */
export class ApiService {
  private axiosInstance: AxiosInstance;
  private retryConfig: RetryConfig;
  private activeRequests: Map<string, AbortController>;

  /**
   * Initializes the API service with configured axios instance and monitoring
   * @param retryConfig - Configuration for request retry behavior
   */
  constructor(retryConfig?: Partial<RetryConfig>) {
    this.activeRequests = new Map();
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
      ...retryConfig
    };

    this.axiosInstance = createApiInstance({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      validateStatus: (status) => status >= 200 && status < 300
    });

    this.setupInterceptors();
  }

  /**
   * Configures request and response interceptors
   */
  private setupInterceptors(): void {
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const correlationId = uuidv4();
        const controller = new AbortController();
        
        config.headers = {
          ...config.headers,
          'X-Correlation-ID': correlationId,
          'Content-Type': 'application/json'
        };
        
        config.signal = controller.signal;
        this.activeRequests.set(correlationId, controller);

        return config;
      },
      (error) => Promise.reject(handleApiError(error, error.config?.correlationId))
    );

    this.axiosInstance.interceptors.response.use(
      (response) => {
        const correlationId = response.config.headers['X-Correlation-ID'];
        this.activeRequests.delete(correlationId);
        return response;
      },
      (error) => {
        const correlationId = error.config?.headers['X-Correlation-ID'];
        this.activeRequests.delete(correlationId);
        return Promise.reject(handleApiError(error, correlationId));
      }
    );
  }

  /**
   * Performs GET request with retry and metrics
   * @param endpoint - API endpoint
   * @param params - Query parameters
   * @param config - Request configuration
   * @returns Promise with typed response
   */
  public async get<T>(
    endpoint: string,
    params?: Record<string, any>,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.get<T>(endpoint, {
        params,
        ...config
      });

      return {
        data: response.data,
        status: response.status,
        message: 'Success',
        correlationId: response.config.headers['X-Correlation-ID']
      };
    } catch (error) {
      if (!config?.skipRetry) {
        return this.handleRetry<T>(endpoint, 'get', { params, ...config });
      }
      throw error;
    }
  }

  /**
   * Performs POST request with retry and metrics
   * @param endpoint - API endpoint
   * @param data - Request payload
   * @param config - Request configuration
   * @returns Promise with typed response
   */
  public async post<T>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.post<T>(endpoint, data, config);

      return {
        data: response.data,
        status: response.status,
        message: 'Success',
        correlationId: response.config.headers['X-Correlation-ID']
      };
    } catch (error) {
      if (!config?.skipRetry) {
        return this.handleRetry<T>(endpoint, 'post', { data, ...config });
      }
      throw error;
    }
  }

  /**
   * Performs PUT request with retry and metrics
   * @param endpoint - API endpoint
   * @param data - Request payload
   * @param config - Request configuration
   * @returns Promise with typed response
   */
  public async put<T>(
    endpoint: string,
    data?: any,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.put<T>(endpoint, data, config);

      return {
        data: response.data,
        status: response.status,
        message: 'Success',
        correlationId: response.config.headers['X-Correlation-ID']
      };
    } catch (error) {
      if (!config?.skipRetry) {
        return this.handleRetry<T>(endpoint, 'put', { data, ...config });
      }
      throw error;
    }
  }

  /**
   * Performs DELETE request with retry and metrics
   * @param endpoint - API endpoint
   * @param config - Request configuration
   * @returns Promise with typed response
   */
  public async delete<T>(
    endpoint: string,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    try {
      const response = await this.axiosInstance.delete<T>(endpoint, config);

      return {
        data: response.data,
        status: response.status,
        message: 'Success',
        correlationId: response.config.headers['X-Correlation-ID']
      };
    } catch (error) {
      if (!config?.skipRetry) {
        return this.handleRetry<T>(endpoint, 'delete', config);
      }
      throw error;
    }
  }

  /**
   * Handles request retry logic with exponential backoff
   * @param endpoint - API endpoint
   * @param method - HTTP method
   * @param config - Request configuration
   * @returns Promise with typed response
   */
  private async handleRetry<T>(
    endpoint: string,
    method: string,
    config?: RequestConfig,
    retryCount: number = 0
  ): Promise<ApiResponse<T>> {
    if (retryCount >= this.retryConfig.maxRetries) {
      throw new Error(`Max retry attempts (${this.retryConfig.maxRetries}) exceeded`);
    }

    const delay = this.retryConfig.retryDelay * Math.pow(2, retryCount);
    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      const response = await this.axiosInstance.request<T>({
        url: endpoint,
        method,
        ...config,
        skipRetry: true
      });

      return {
        data: response.data,
        status: response.status,
        message: 'Success',
        correlationId: response.config.headers['X-Correlation-ID']
      };
    } catch (error) {
      if (this.isRetryableError(error)) {
        return this.handleRetry<T>(endpoint, method, config, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Determines if an error is retryable based on configuration
   * @param error - Axios error
   * @returns boolean indicating if error is retryable
   */
  private isRetryableError(error: any): boolean {
    return (
      !error.response ||
      this.retryConfig.retryableStatuses.includes(error.response.status)
    );
  }

  /**
   * Sets authentication token for requests
   * @param token - JWT token
   */
  public setAuthToken(token: string | null): void {
    if (token) {
      this.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.axiosInstance.defaults.headers.common['Authorization'];
    }
  }

  /**
   * Cancels all active requests
   */
  public cancelAllRequests(): void {
    this.activeRequests.forEach(controller => controller.abort());
    this.activeRequests.clear();
  }

  /**
   * Updates retry configuration
   * @param config - New retry configuration
   */
  public configureRetry(config: Partial<RetryConfig>): void {
    this.retryConfig = {
      ...this.retryConfig,
      ...config
    };
  }
}

// Export singleton instance
export default new ApiService();