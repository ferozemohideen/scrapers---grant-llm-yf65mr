/**
 * Configuration Service
 * Provides enterprise-grade service for managing URL configurations, institution settings,
 * and scraping configurations with comprehensive validation and monitoring.
 * 
 * @version 1.0.0
 */

import { isURL } from 'validator'; // ^13.7.0
import { ApiService } from './api.service';
import { API_ENDPOINTS } from '../constants/api.constants';
import { 
  URLConfig, 
  InstitutionConfig, 
  InstitutionType,
  ScrapingConfig 
} from '../interfaces/config.interface';

/**
 * Interface for configuration service options
 */
interface ConfigServiceOptions {
  requestTimeout?: number;
  maxRetries?: number;
  validateUrls?: boolean;
}

/**
 * Interface for URL configuration filter options
 */
interface URLConfigFilter {
  institutionType?: InstitutionType;
  country?: string;
  active?: boolean;
  searchTerm?: string;
}

/**
 * Interface for pagination options
 */
interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Interface for batch import options
 */
interface ImportOptions {
  validateUrls?: boolean;
  checkDuplicates?: boolean;
  batchSize?: number;
}

/**
 * Interface for URL test results
 */
interface URLTestResult {
  accessible: boolean;
  responseTime: number;
  validSelectors: boolean;
  errors?: string[];
  warnings?: string[];
}

/**
 * Interface for batch import results
 */
interface BatchImportResult {
  successful: URLConfig[];
  failed: Array<{
    config: URLConfig;
    error: string;
  }>;
  duplicates: URLConfig[];
  metrics: {
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    duplicateCount: number;
    processingTime: number;
  };
}

/**
 * Enhanced service class for managing URL and institution configurations
 */
export class ConfigService {
  private readonly requestTimeout: number;
  private readonly maxRetries: number;
  private readonly validateUrls: boolean;

  /**
   * Initializes the configuration service with enhanced options
   * @param apiService - Instance of ApiService for HTTP requests
   * @param options - Configuration options
   */
  constructor(
    private readonly apiService: ApiService,
    options: ConfigServiceOptions = {}
  ) {
    this.requestTimeout = options.requestTimeout || 30000;
    this.maxRetries = options.maxRetries || 3;
    this.validateUrls = options.validateUrls !== false;
  }

  /**
   * Validates URL configuration
   * @param config - URL configuration to validate
   * @throws Error if validation fails
   */
  private validateURLConfig(config: URLConfig): void {
    if (!config.url || !isURL(config.url)) {
      throw new Error('Invalid URL format');
    }

    if (!config.institution?.name) {
      throw new Error('Institution name is required');
    }

    if (!Object.values(InstitutionType).includes(config.institution.type)) {
      throw new Error('Invalid institution type');
    }

    if (!config.scraping?.selectors?.title || !config.scraping?.selectors?.description) {
      throw new Error('Required selectors are missing');
    }

    if (config.scraping.rateLimit < 0) {
      throw new Error('Invalid rate limit');
    }
  }

  /**
   * Retrieves paginated list of URL configurations with filtering
   * @param filter - Filter criteria
   * @param options - Pagination options
   * @returns Promise with paginated URL configurations
   */
  public async getURLConfigs(
    filter: URLConfigFilter = {},
    options: PaginationOptions
  ): Promise<{
    data: URLConfig[];
    total: number;
    page: number;
    limit: number;
  }> {
    const response = await this.apiService.get<{
      data: URLConfig[];
      total: number;
    }>(API_ENDPOINTS.CONFIG.URL, {
      ...filter,
      ...options
    });

    return {
      data: response.data.data,
      total: response.data.total,
      page: options.page,
      limit: options.limit
    };
  }

  /**
   * Creates new URL configuration with comprehensive validation
   * @param config - URL configuration to create
   * @returns Promise with created configuration
   */
  public async createURLConfig(config: URLConfig): Promise<URLConfig> {
    this.validateURLConfig(config);

    if (this.validateUrls) {
      const testResult = await this.testURLConfig(config);
      if (!testResult.accessible) {
        throw new Error(`URL inaccessible: ${testResult.errors?.join(', ')}`);
      }
    }

    const response = await this.apiService.post<URLConfig>(
      API_ENDPOINTS.CONFIG.URL,
      config
    );

    return response.data;
  }

  /**
   * Updates existing URL configuration
   * @param id - Configuration ID
   * @param config - Updated configuration
   * @returns Promise with updated configuration
   */
  public async updateURLConfig(id: string, config: Partial<URLConfig>): Promise<URLConfig> {
    if (config.url) {
      this.validateURLConfig(config as URLConfig);
    }

    const response = await this.apiService.put<URLConfig>(
      `${API_ENDPOINTS.CONFIG.URL}/${id}`,
      config
    );

    return response.data;
  }

  /**
   * Batch imports URL configurations with comprehensive validation
   * @param configs - Array of URL configurations
   * @param options - Import options
   * @returns Promise with import results
   */
  public async importURLConfigs(
    configs: URLConfig[],
    options: ImportOptions = {}
  ): Promise<BatchImportResult> {
    const startTime = Date.now();
    const result: BatchImportResult = {
      successful: [],
      failed: [],
      duplicates: [],
      metrics: {
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        duplicateCount: 0,
        processingTime: 0
      }
    };

    const batchSize = options.batchSize || 10;
    const batches = Array.from({ length: Math.ceil(configs.length / batchSize) })
      .map((_, i) => configs.slice(i * batchSize, (i + 1) * batchSize));

    for (const batch of batches) {
      const response = await this.apiService.post<{
        successful: URLConfig[];
        failed: Array<{ config: URLConfig; error: string }>;
        duplicates: URLConfig[];
      }>(API_ENDPOINTS.CONFIG.URL_IMPORT, {
        configs: batch,
        options
      });

      result.successful.push(...response.data.successful);
      result.failed.push(...response.data.failed);
      result.duplicates.push(...response.data.duplicates);
    }

    // Update metrics
    result.metrics = {
      totalProcessed: configs.length,
      successCount: result.successful.length,
      failureCount: result.failed.length,
      duplicateCount: result.duplicates.length,
      processingTime: Date.now() - startTime
    };

    return result;
  }

  /**
   * Tests URL configuration accessibility and validity
   * @param config - URL configuration to test
   * @returns Promise with test results
   */
  public async testURLConfig(config: URLConfig): Promise<URLTestResult> {
    const response = await this.apiService.post<URLTestResult>(
      API_ENDPOINTS.CONFIG.URL_TEST,
      config
    );

    return response.data;
  }

  /**
   * Exports URL configurations in specified format
   * @param format - Export format (json/csv)
   * @param filter - Filter criteria
   * @returns Promise with export data
   */
  public async exportURLConfigs(
    format: 'json' | 'csv' = 'json',
    filter?: URLConfigFilter
  ): Promise<Blob> {
    const response = await this.apiService.get<Blob>(
      API_ENDPOINTS.CONFIG.URL_EXPORT,
      {
        format,
        ...filter
      },
      {
        responseType: 'blob'
      }
    );

    return response.data;
  }
}

// Export singleton instance
export default new ConfigService(new ApiService());