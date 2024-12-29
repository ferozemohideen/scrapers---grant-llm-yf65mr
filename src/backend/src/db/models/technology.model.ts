/**
 * @fileoverview TypeORM entity model for technology transfer opportunities
 * Implements optimized indexing and search capabilities with comprehensive validation
 * @version 1.0.0
 */

import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Index, 
  Check 
} from 'typeorm'; // ^0.3.0
import { ScraperResult } from '../../interfaces/scraper.interface';
import { SearchResult } from '../../interfaces/search.interface';

/**
 * Technology entity representing research commercialization opportunities
 * Implements optimized indexing for sub-2 second search response times
 */
@Entity('technologies')
@Index(['institution', 'category']) // Composite index for common filters
@Index(['discoveredAt']) // Index for temporal queries
@Index(['title', 'description'], { using: 'GiST' }) // Full-text search optimization
export class Technology {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  institution: string;

  @Column()
  @Index()
  title: string;

  @Column('text')
  description: string;

  @Column()
  @Index()
  category: string;

  @Column()
  country: string;

  @Column()
  url: string;

  @CreateDateColumn()
  @Index()
  discoveredAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column('jsonb', { nullable: true })
  metadata: Record<string, any>;

  @Column({ default: true })
  @Check('active IN (true, false)')
  active: boolean;

  /**
   * Creates a new technology instance with validation
   * @param data Optional partial technology data
   */
  constructor(data?: Partial<Technology>) {
    if (data) {
      // Validate and apply provided data
      Object.assign(this, data);
      
      // Initialize metadata if not provided
      if (!this.metadata) {
        this.metadata = {};
      }
      
      // Ensure active status is set
      if (this.active === undefined) {
        this.active = true;
      }
    }
  }

  /**
   * Creates a validated technology instance from scraper result data
   * @param result ScraperResult containing raw scraped data
   * @returns New validated technology instance
   * @throws Error if required data is missing or invalid
   */
  static fromScraperResult(result: ScraperResult): Technology {
    if (!result.data || !result.data.title || !result.data.description) {
      throw new Error('Invalid scraper result: Missing required fields');
    }

    // Extract and normalize data
    const technology = new Technology({
      title: result.data.title.trim(),
      description: result.data.description.trim(),
      institution: result.data.institution,
      category: result.data.category,
      country: result.data.country,
      url: result.url,
      metadata: {
        ...result.data.metadata,
        scrapedAt: result.timestamp,
        validationResults: result.validationResults,
        performanceMetrics: result.performanceMetrics
      }
    });

    // Validate the created instance
    if (!technology.validateMetadata(technology.metadata)) {
      throw new Error('Invalid metadata structure in scraper result');
    }

    return technology;
  }

  /**
   * Converts technology instance to optimized search result format
   * @param score Optional relevance score for search results
   * @returns SearchResult representation of the technology
   */
  toSearchResult(score?: number): SearchResult {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      institution: this.institution,
      category: this.category,
      country: this.country,
      discoveredAt: this.discoveredAt,
      updatedAt: this.updatedAt,
      score: score || 0
    };
  }

  /**
   * Validates and normalizes metadata structure
   * @param metadata Raw metadata object to validate
   * @returns boolean indicating validation success
   */
  validateMetadata(metadata: Record<string, any>): boolean {
    if (!metadata) {
      return false;
    }

    // Required metadata fields
    const requiredFields = ['scrapedAt'];
    for (const field of requiredFields) {
      if (!(field in metadata)) {
        return false;
      }
    }

    // Validate data types
    if (!(metadata.scrapedAt instanceof Date) && !Date.parse(metadata.scrapedAt)) {
      return false;
    }

    // Validate nested structures if present
    if (metadata.validationResults && 
        (!('isValid' in metadata.validationResults) || 
         !Array.isArray(metadata.validationResults.errors))) {
      return false;
    }

    if (metadata.performanceMetrics && 
        (!('startTime' in metadata.performanceMetrics) || 
         !('endTime' in metadata.performanceMetrics))) {
      return false;
    }

    return true;
  }
}