/**
 * @fileoverview Repository class for managing technology transfer opportunities
 * Implements optimized database operations with caching for sub-2 second search response times
 * @version 1.0.0
 */

import { 
  Repository, 
  EntityRepository, 
  QueryRunner, 
  SelectQueryBuilder,
  ILike, 
  Between, 
  In 
} from 'typeorm'; // ^0.3.0
import { Redis } from 'ioredis'; // ^5.0.0
import { Technology } from '../models/technology.model';
import { ScraperResult } from '../../interfaces/scraper.interface';
import { 
  SearchParams, 
  SearchResponse, 
  SearchResult, 
  SearchFilters, 
  PaginationParams 
} from '../../interfaces/search.interface';

/**
 * Repository class for managing technology transfer opportunities with optimized performance
 * Implements caching strategies and query optimization for high-concurrency support
 */
@EntityRepository(Technology)
export class TechnologyRepository {
  private repository: Repository<Technology>;
  private queryRunner: QueryRunner;
  private readonly CACHE_TTL = 3600; // 1 hour cache TTL
  private readonly SEARCH_TIMEOUT = 2000; // 2 second timeout for searches

  /**
   * Initialize repository with database and cache connections
   * @param cacheClient Redis client instance for caching
   */
  constructor(private readonly cacheClient: Redis) {
    this.repository = this.queryRunner.manager.getRepository(Technology);
  }

  /**
   * Creates a new technology entry from scraper result
   * Implements transaction support and cache invalidation
   * @param scraperResult Validated scraper result data
   * @returns Newly created technology entity
   */
  async create(scraperResult: ScraperResult): Promise<Technology> {
    // Start transaction for data consistency
    await this.queryRunner.startTransaction();

    try {
      // Create and validate technology entity
      const technology = Technology.fromScraperResult(scraperResult);
      
      // Save to database with validation
      const savedTechnology = await this.repository.save(technology);

      // Invalidate relevant caches
      await this.invalidateRelatedCaches(savedTechnology);
      
      // Commit transaction
      await this.queryRunner.commitTransaction();
      
      return savedTechnology;
    } catch (error) {
      // Rollback on error
      await this.queryRunner.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Performs optimized search with caching and pagination
   * Implements sub-2 second response time requirement
   * @param params Search parameters including filters and pagination
   * @returns Paginated and cached search results
   */
  async search(params: SearchParams): Promise<SearchResponse> {
    const cacheKey = this.generateCacheKey(params);
    
    // Check cache first
    const cachedResults = await this.cacheClient.get(cacheKey);
    if (cachedResults) {
      return JSON.parse(cachedResults);
    }

    // Build optimized query
    const query = this.buildSearchQuery(params);
    
    // Execute search with timeout
    const [results, total] = await Promise.race([
      query.getManyAndCount(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), this.SEARCH_TIMEOUT)
      )
    ]);

    // Transform results
    const searchResponse: SearchResponse = {
      results: results.map(tech => tech.toSearchResult()),
      total,
      facets: await this.generateFacets(params.filters),
      pagination: this.generatePaginationInfo(params.pagination, total)
    };

    // Cache results
    await this.cacheClient.setex(
      cacheKey,
      this.CACHE_TTL,
      JSON.stringify(searchResponse)
    );

    return searchResponse;
  }

  /**
   * Builds optimized search query with proper indexes
   * @param params Search parameters
   * @returns Configured query builder
   */
  private buildSearchQuery(params: SearchParams): SelectQueryBuilder<Technology> {
    const { query, filters, pagination } = params;
    
    const queryBuilder = this.repository.createQueryBuilder('technology')
      .where('technology.active = :active', { active: true });

    // Add full-text search if query provided
    if (query) {
      queryBuilder.andWhere(
        '(technology.title ILIKE :query OR technology.description ILIKE :query)',
        { query: `%${query}%` }
      );
    }

    // Apply filters
    this.applyFilters(queryBuilder, filters);

    // Add pagination
    queryBuilder
      .skip((pagination.page - 1) * pagination.limit)
      .take(pagination.limit)
      .orderBy('technology.discoveredAt', 'DESC');

    // Add query hints for optimization
    queryBuilder.setQueryRunner(this.queryRunner);

    return queryBuilder;
  }

  /**
   * Applies search filters to query builder
   * @param queryBuilder Active query builder
   * @param filters Search filters to apply
   */
  private applyFilters(
    queryBuilder: SelectQueryBuilder<Technology>,
    filters: SearchFilters
  ): void {
    const { institution, category, country, dateRange } = filters;

    if (institution?.length) {
      queryBuilder.andWhere({ institution: In(institution) });
    }

    if (category?.length) {
      queryBuilder.andWhere({ category: In(category) });
    }

    if (country?.length) {
      queryBuilder.andWhere({ country: In(country) });
    }

    if (dateRange?.start && dateRange?.end) {
      queryBuilder.andWhere({
        discoveredAt: Between(dateRange.start, dateRange.end)
      });
    }
  }

  /**
   * Generates faceted search aggregations
   * @param filters Current search filters
   * @returns Facet counts for filtering
   */
  private async generateFacets(filters: SearchFilters) {
    const facetQueries = await Promise.all([
      this.repository.createQueryBuilder('technology')
        .select('technology.institution, COUNT(*) as count')
        .groupBy('technology.institution')
        .getRawMany(),
      this.repository.createQueryBuilder('technology')
        .select('technology.category, COUNT(*) as count')
        .groupBy('technology.category')
        .getRawMany(),
      this.repository.createQueryBuilder('technology')
        .select('technology.country, COUNT(*) as count')
        .groupBy('technology.country')
        .getRawMany()
    ]);

    return {
      institutions: facetQueries[0],
      categories: facetQueries[1],
      countries: facetQueries[2]
    };
  }

  /**
   * Generates pagination information
   * @param params Pagination parameters
   * @param total Total result count
   * @returns Pagination details
   */
  private generatePaginationInfo(params: PaginationParams, total: number) {
    return {
      currentPage: params.page,
      totalPages: Math.ceil(total / params.limit),
      limit: params.limit,
      total
    };
  }

  /**
   * Generates cache key for search results
   * @param params Search parameters
   * @returns Unique cache key
   */
  private generateCacheKey(params: SearchParams): string {
    return `search:${JSON.stringify(params)}`;
  }

  /**
   * Invalidates related caches when data changes
   * @param technology Technology entity that was modified
   */
  private async invalidateRelatedCaches(technology: Technology): Promise<void> {
    const patterns = [
      `search:*${technology.institution}*`,
      `search:*${technology.category}*`,
      `search:*${technology.country}*`
    ];

    await Promise.all(
      patterns.map(pattern => this.cacheClient.del(pattern))
    );
  }
}