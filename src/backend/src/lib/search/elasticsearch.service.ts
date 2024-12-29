/**
 * @fileoverview High-performance Elasticsearch service implementation using the Singleton pattern
 * Provides semantic search functionality with sub-2 second response times through advanced caching,
 * connection pooling, and performance optimizations.
 * @version 1.0.0
 */

import { Client } from '@elastic/elasticsearch'; // v8.0.0
import { Logger } from 'winston'; // v3.8.0
import { SearchParams, SearchResponse, SearchResult, SearchFacets } from '../../interfaces/search.interface';
import { searchConfig } from '../../config/search.config';
import { RedisService } from '../cache/redis.service';

/**
 * High-performance Elasticsearch service implementing Singleton pattern
 * with advanced caching and monitoring capabilities
 */
export class ElasticsearchService {
  private static instance: ElasticsearchService;
  private client: Client;
  private cacheService: RedisService;
  private logger: Logger;
  private readonly metrics: {
    searchLatency: number;
    cacheHits: number;
    cacheMisses: number;
    errorCount: number;
  };

  /**
   * Private constructor implementing singleton pattern with advanced initialization
   */
  private constructor() {
    // Initialize Elasticsearch client with optimized settings
    this.client = new Client({
      node: searchConfig.elasticsearch.node,
      auth: searchConfig.elasticsearch.auth,
      ssl: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      },
      maxRetries: 3,
      requestTimeout: 2000, // Enforce 2-second timeout
      compression: true,
      sniffOnStart: true,
      sniffInterval: 30000,
      pool: {
        maxRetries: 3,
        resurrectStrategy: 'ping'
      }
    });

    // Initialize Redis cache service
    this.cacheService = RedisService.getInstance({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      ttl: searchConfig.cache.ttl,
      keyPrefix: searchConfig.cache.keyPrefix
    });

    // Initialize metrics
    this.metrics = {
      searchLatency: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errorCount: 0
    };

    // Initialize logger
    this.logger = new Logger({
      level: 'info',
      format: Logger.format.json(),
      transports: [
        new Logger.transports.Console(),
        new Logger.transports.File({ filename: 'elasticsearch.log' })
      ]
    });

    this.initializeIndices();
  }

  /**
   * Returns singleton instance with lazy initialization
   */
  public static getInstance(): ElasticsearchService {
    if (!ElasticsearchService.instance) {
      ElasticsearchService.instance = new ElasticsearchService();
    }
    return ElasticsearchService.instance;
  }

  /**
   * Performs optimized semantic search with caching and monitoring
   * @param params Search parameters
   * @returns Search results with facets
   */
  public async search(params: SearchParams): Promise<SearchResponse> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(params);

    try {
      // Check cache first
      const cachedResult = await this.cacheService.get<SearchResponse>(cacheKey);
      if (cachedResult) {
        this.metrics.cacheHits++;
        this.logger.info('Cache hit for search query', { params });
        return cachedResult;
      }

      this.metrics.cacheMisses++;

      // Build optimized query
      const query = this.buildQuery(params);

      // Execute search with timeout
      const { body } = await this.client.search({
        index: searchConfig.elasticsearch.indices.technology,
        body: query,
        timeout: searchConfig.search.timeout.search
      });

      // Process results
      const response = this.processResults(body);

      // Cache results
      await this.cacheService.set(
        cacheKey,
        response,
        searchConfig.cache.ttl
      );

      // Update metrics
      this.metrics.searchLatency = Date.now() - startTime;

      return response;
    } catch (error) {
      this.metrics.errorCount++;
      this.logger.error('Search error', { error, params });
      throw error;
    }
  }

  /**
   * Builds optimized Elasticsearch query with performance considerations
   * @param params Search parameters
   */
  private buildQuery(params: SearchParams): object {
    const { query, filters, pagination } = params;

    return {
      from: (pagination.page - 1) * pagination.limit,
      size: Math.min(pagination.limit, searchConfig.search.maxResults),
      _source: true,
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query,
                fields: [
                  'title^2',
                  'description',
                  'institution^1.5'
                ],
                type: 'best_fields',
                tie_breaker: 0.3,
                minimum_should_match: '75%'
              }
            }
          ],
          filter: this.buildFilters(filters)
        }
      },
      aggs: {
        categories: {
          terms: {
            field: 'category',
            size: searchConfig.search.facets.maxCategories
          }
        },
        institutions: {
          terms: {
            field: 'institution',
            size: searchConfig.search.facets.maxInstitutions
          }
        },
        countries: {
          terms: {
            field: 'country',
            size: searchConfig.search.facets.maxCountries
          }
        }
      },
      highlight: {
        fields: {
          title: {},
          description: {}
        }
      },
      track_total_hits: true
    };
  }

  /**
   * Processes raw Elasticsearch results into structured response
   * @param results Raw Elasticsearch results
   */
  private processResults(results: any): SearchResponse {
    const hits = results.hits.hits;
    
    return {
      results: hits.map((hit: any): SearchResult => ({
        id: hit._id,
        title: hit._source.title,
        description: hit._source.description,
        institution: hit._source.institution,
        category: hit._source.category,
        country: hit._source.country,
        discoveredAt: new Date(hit._source.discoveredAt),
        updatedAt: new Date(hit._source.updatedAt),
        score: hit._score
      })),
      total: results.hits.total.value,
      facets: this.processFacets(results.aggregations),
      pagination: {
        currentPage: Math.floor(results.hits.from / results.hits.size) + 1,
        totalPages: Math.ceil(results.hits.total.value / results.hits.size),
        limit: results.hits.size,
        total: results.hits.total.value
      }
    };
  }

  /**
   * Processes aggregations into facets
   * @param aggregations Elasticsearch aggregations
   */
  private processFacets(aggregations: any): SearchFacets {
    return {
      institutions: aggregations.institutions.buckets.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count
      })),
      categories: aggregations.categories.buckets.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count
      })),
      countries: aggregations.countries.buckets.map((bucket: any) => ({
        value: bucket.key,
        count: bucket.doc_count
      }))
    };
  }

  /**
   * Builds filter clauses for Elasticsearch query
   * @param filters Search filters
   */
  private buildFilters(filters: SearchParams['filters']): object[] {
    const filterClauses = [];

    if (filters.institution?.length) {
      filterClauses.push({
        terms: { institution: filters.institution }
      });
    }

    if (filters.category?.length) {
      filterClauses.push({
        terms: { category: filters.category }
      });
    }

    if (filters.country?.length) {
      filterClauses.push({
        terms: { country: filters.country }
      });
    }

    if (filters.dateRange) {
      filterClauses.push({
        range: {
          discoveredAt: {
            gte: filters.dateRange.start,
            lte: filters.dateRange.end
          }
        }
      });
    }

    return filterClauses;
  }

  /**
   * Generates cache key from search parameters
   * @param params Search parameters
   */
  private generateCacheKey(params: SearchParams): string {
    return `search:${JSON.stringify(params)}`;
  }

  /**
   * Initializes Elasticsearch indices with optimized mappings
   */
  private async initializeIndices(): Promise<void> {
    try {
      const exists = await this.client.indices.exists({
        index: searchConfig.elasticsearch.indices.technology
      });

      if (!exists) {
        await this.client.indices.create({
          index: searchConfig.elasticsearch.indices.technology,
          body: {
            settings: searchConfig.elasticsearch.settings,
            mappings: searchConfig.elasticsearch.mappings.technology
          }
        });
      }
    } catch (error) {
      this.logger.error('Index initialization error', { error });
      throw error;
    }
  }
}