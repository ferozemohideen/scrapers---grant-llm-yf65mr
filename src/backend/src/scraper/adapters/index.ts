/**
 * @fileoverview Main entry point for scraper adapters that exports specialized adapters
 * for different institution types and provides a factory method for creating appropriate
 * adapters based on institution type. Implements comprehensive adapter lifecycle management,
 * error handling, performance optimization, and monitoring integration.
 * @version 1.0.0
 */

import { BaseAdapter } from './base.adapter';
import { UniversityAdapter } from './university.adapter';
import { FederalAdapter } from './federal.adapter';
import { InternationalAdapter } from './international.adapter';
import {
  ScraperEngine,
  InstitutionType,
  RateLimitConfig
} from '../../interfaces/scraper.interface';
import { SCRAPER_RATE_LIMITS } from '../../constants/scraper.constants';

// Cache for adapter instances to optimize resource usage
const adapterCache = new Map<string, BaseAdapter>();

/**
 * Enhanced factory function that creates and returns appropriate scraper adapter
 * based on institution type with comprehensive error handling and monitoring
 */
export function createAdapter(
  type: InstitutionType,
  engine: ScraperEngine,
  rateLimitConfig?: Partial<RateLimitConfig>
): BaseAdapter {
  // Generate cache key
  const cacheKey = `${type}-${engine.type}`;

  // Check cache for existing adapter
  if (adapterCache.has(cacheKey)) {
    return adapterCache.get(cacheKey)!;
  }

  // Merge provided rate limit config with defaults
  const finalRateLimitConfig: RateLimitConfig = {
    ...SCRAPER_RATE_LIMITS.DEFAULT,
    ...rateLimitConfig,
    institutionOverrides: {
      ...SCRAPER_RATE_LIMITS.DEFAULT.institutionOverrides,
      ...rateLimitConfig?.institutionOverrides
    },
    burstHandling: {
      ...SCRAPER_RATE_LIMITS.DEFAULT.burstHandling,
      ...rateLimitConfig?.burstHandling
    }
  };

  let adapter: BaseAdapter;

  // Create appropriate adapter based on institution type
  switch (type) {
    case 'US_UNIVERSITIES':
      adapter = new UniversityAdapter(
        engine,
        finalRateLimitConfig,
        { type: 'US', dataValidation: { required: ['title', 'description'], patterns: {} } }
      );
      break;

    case 'INTERNATIONAL_UNIVERSITIES':
      adapter = new InternationalAdapter(engine);
      break;

    case 'FEDERAL_LABS':
      adapter = new FederalAdapter(
        engine,
        {
          apiKey: process.env.FEDERAL_API_KEY || '',
          institutionId: process.env.FEDERAL_INSTITUTION_ID || '',
          securityProtocol: 'api_key',
          dataSchema: {},
          validationRules: {}
        }
      );
      break;

    default:
      throw new Error(`Unsupported institution type: ${type}`);
  }

  // Cache adapter instance
  adapterCache.set(cacheKey, adapter);

  return adapter;
}

/**
 * Clears adapter cache and performs cleanup
 */
export async function clearAdapterCache(): Promise<void> {
  adapterCache.clear();
}

/**
 * Gets cached adapter instance if available
 */
export function getCachedAdapter(
  type: InstitutionType,
  engineType: string
): BaseAdapter | undefined {
  return adapterCache.get(`${type}-${engineType}`);
}

// Export adapters for direct use if needed
export {
  BaseAdapter,
  UniversityAdapter,
  FederalAdapter,
  InternationalAdapter
};

// Export factory function as default
export default createAdapter;