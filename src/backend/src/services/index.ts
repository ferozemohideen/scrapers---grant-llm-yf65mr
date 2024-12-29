/**
 * @fileoverview Main barrel file exporting core service classes for the Technology Transfer Data Aggregation System.
 * Provides centralized access to authentication, configuration, grant management, and web scraping services.
 * @version 1.0.0
 */

// Import core service classes with their configurations
import { AuthService } from './auth.service';
import { ConfigService } from './config.service';
import { GrantService } from './grant.service';
import { ScraperService } from './scraper.service';

// Re-export service classes and their configurations
export {
  // Authentication service for user management and session handling
  AuthService,
  type AuthServiceConfig,
} from './auth.service';

// Configuration management service for application settings
export {
  ConfigService,
  type ConfigOptions,
} from './config.service';

// Grant proposal generation and management service
export {
  GrantService,
  type GrantServiceOptions,
  type ProposalConfig,
} from './grant.service';

// Web scraping service for technology transfer data collection
export {
  ScraperService,
  type ScraperConfig,
  type ScrapingOptions,
} from './scraper.service';

/**
 * Initializes core services with default configurations
 * @returns Object containing initialized service instances
 */
export function initializeServices() {
  return {
    authService: new AuthService(),
    configService: new ConfigService(),
    grantService: new GrantService(),
    scraperService: new ScraperService()
  };
}

/**
 * Default export of all core services
 */
export default {
  AuthService,
  ConfigService,
  GrantService,
  ScraperService,
  initializeServices
};