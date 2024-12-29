/**
 * @file Search configuration for Technology Transfer Data Aggregation platform
 * Provides comprehensive configuration for Elasticsearch, caching, and search behavior
 * Optimized for sub-2 second response times with high availability and scalability
 * @version 1.0.0
 */

import { config } from 'dotenv'; // v16.0.0
import { SearchParams, SearchFilters, SearchResponse } from '../interfaces/search.interface';

// Load environment variables
config();

/**
 * Comprehensive search configuration object with optimized settings
 * for high-performance technology transfer data search functionality
 */
export const searchConfig = {
  elasticsearch: {
    // Connection settings
    node: process.env.ELASTICSEARCH_NODE || 'http://localhost:9200',
    auth: {
      username: process.env.ELASTICSEARCH_USERNAME,
      password: process.env.ELASTICSEARCH_PASSWORD
    },
    
    // Index configuration
    indices: {
      technology: 'technology_index',
      proposals: 'proposals_index'
    },
    
    // Performance-optimized cluster settings
    settings: {
      numberOfShards: 3, // Optimized for parallel processing
      numberOfReplicas: 2, // High availability with load distribution
      refreshInterval: '1s', // Balance between freshness and performance
      maxResultWindow: 10000, // Prevent deep pagination performance issues
      translogDurability: 'async', // Optimize write performance
      translogSyncInterval: '5s' // Balance durability and performance
    },
    
    // Field mappings optimized for search performance
    mappings: {
      technology: {
        properties: {
          title: {
            type: 'text',
            analyzer: 'english',
            boost: 2.0, // Higher relevance for title matches
            fields: {
              keyword: {
                type: 'keyword',
                ignore_above: 256
              }
            }
          },
          description: {
            type: 'text',
            analyzer: 'english',
            boost: 1.0
          },
          institution: {
            type: 'keyword',
            boost: 1.5 // Boost institution matches
          },
          category: {
            type: 'keyword'
          },
          country: {
            type: 'keyword'
          },
          discoveredAt: {
            type: 'date'
          },
          updatedAt: {
            type: 'date'
          }
        }
      }
    }
  },

  // Redis cache configuration for search results
  cache: {
    enabled: true,
    ttl: 3600, // Cache lifetime in seconds
    maxSize: 10000, // Maximum number of cached queries
    keyPrefix: 'search:', // Namespace for cache keys
    invalidationPatterns: [
      'technology:*',
      'proposals:*'
    ],
    compressionEnabled: true,
    compressionThreshold: 1024, // Bytes
    evictionPolicy: 'volatile-lru', // Least Recently Used eviction
    errorTTL: 300 // Error caching duration
  },

  // Search behavior configuration
  search: {
    maxResults: 100, // Maximum results per query
    defaultPageSize: 20,
    minScore: 0.3, // Minimum relevance score threshold
    highlightFields: ['title', 'description'],
    facets: {
      maxCategories: 50,
      maxInstitutions: 100,
      maxCountries: 200,
      minDocCount: 1
    },
    weights: {
      title: 2.0,
      description: 1.0,
      institution: 1.5
    },
    timeout: {
      search: '2s', // Enforce sub-2 second response requirement
      suggest: '1s'
    }
  }
};

/**
 * Elasticsearch index settings for optimal search performance
 * These settings are used during index creation and updates
 */
export const ELASTICSEARCH_CONFIG = {
  settings: {
    analysis: {
      analyzer: {
        custom_analyzer: {
          type: 'custom',
          tokenizer: 'standard',
          filter: [
            'lowercase',
            'stop',
            'snowball'
          ]
        }
      }
    },
    // Additional index-level settings
    'index.queries.cache.enabled': true,
    'index.number_of_routing_shards': 6,
    'index.refresh_interval': '1s',
    'index.max_result_window': 10000
  }
};

/**
 * Redis cache configuration for optimized search result caching
 * Implements LRU eviction policy with compression for large results
 */
export const SEARCH_CACHE_CONFIG = {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    autoResendUnfulfilledCommands: true,
    retryStrategy: (times: number) => Math.min(times * 50, 2000)
  },
  options: {
    prefix: 'search:cache:',
    ttl: 3600,
    maxSize: 10000,
    compression: {
      enabled: true,
      threshold: 1024,
      algorithm: 'gzip'
    }
  }
};