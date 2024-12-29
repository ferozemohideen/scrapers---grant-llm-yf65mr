/**
 * @fileoverview Barrel file that aggregates and re-exports all API controllers
 * for centralized access and simplified imports. Implements clean architecture patterns
 * by providing a single entry point for controller access.
 * @version 1.0.0
 */

// Import controllers
import { AuthController } from './auth.controller';
import { ConfigController } from './config.controller';
import { GrantController } from './grant.controller';
import { SearchController } from './search.controller';

// Re-export controllers with their exposed methods
export {
  // Authentication controller for user session management
  AuthController,
  
  // Configuration management controller for system settings
  ConfigController,
  
  // Grant proposal management controller
  GrantController,
  
  // Technology transfer search controller
  SearchController
};

// Export singleton instances for controllers that implement singleton pattern
export const searchController = SearchController.getInstance();

// Export default object with all controllers for convenience
export default {
  AuthController,
  ConfigController,
  GrantController,
  SearchController,
  // Singleton instances
  instances: {
    searchController
  }
};