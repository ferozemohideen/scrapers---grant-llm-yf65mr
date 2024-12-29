/**
 * @fileoverview Frontend route constants and path configurations
 * Defines all application routes with authentication and layout metadata
 * Version: 1.0.0
 */

/**
 * Core application routes including public and protected paths
 * Used for main navigation and authentication flows
 */
export enum ROUTES {
  // Public routes
  HOME = '/',
  LOGIN = '/auth/login',
  REGISTER = '/auth/register',
  RESET_PASSWORD = '/auth/reset-password',

  // Protected routes
  DASHBOARD = '/dashboard',
  ANALYTICS = '/dashboard/analytics'
}

/**
 * Configuration management routes
 * Protected routes for URL and institution configuration
 */
export enum CONFIG_ROUTES {
  URL_TEST = '/config/url-test',
  URL_CONFIG = '/config/url',
  INSTITUTION_CONFIG = '/config/institution',
  BATCH_IMPORT = '/config/batch-import'
}

/**
 * System monitoring and health check routes
 * Protected routes for system administrators
 */
export enum MONITORING_ROUTES {
  ERRORS = '/monitoring/errors',
  HEALTH = '/monitoring/health',
  PERFORMANCE = '/monitoring/performance',
  SCRAPER = '/monitoring/scraper'
}

/**
 * Grant management routes
 * Protected routes for grant writing and management
 */
export enum GRANT_ROUTES {
  EDITOR = '/grant/editor',
  LIST = '/grant/list'
}

/**
 * Search functionality routes
 * Public routes with support for query parameters
 */
export enum SEARCH_ROUTES {
  SEARCH = '/search',
  RESULTS = '/search/results'
}

/**
 * Route metadata type definitions for enhanced type safety
 */
export interface RouteMetadata {
  path: string;
  isProtected: boolean;
  layout: 'auth' | 'dashboard' | 'main';
  title: string;
}

/**
 * Route configuration map with metadata
 * Used for route generation and access control
 */
export const routeConfig: Record<string, RouteMetadata> = {
  // Public routes
  [ROUTES.HOME]: {
    path: ROUTES.HOME,
    isProtected: false,
    layout: 'main',
    title: 'Home'
  },
  [ROUTES.LOGIN]: {
    path: ROUTES.LOGIN,
    isProtected: false,
    layout: 'auth',
    title: 'Login'
  },
  [ROUTES.REGISTER]: {
    path: ROUTES.REGISTER,
    isProtected: false,
    layout: 'auth',
    title: 'Register'
  },
  [ROUTES.RESET_PASSWORD]: {
    path: ROUTES.RESET_PASSWORD,
    isProtected: false,
    layout: 'auth',
    title: 'Reset Password'
  },

  // Protected dashboard routes
  [ROUTES.DASHBOARD]: {
    path: ROUTES.DASHBOARD,
    isProtected: true,
    layout: 'dashboard',
    title: 'Dashboard'
  },
  [ROUTES.ANALYTICS]: {
    path: ROUTES.ANALYTICS,
    isProtected: true,
    layout: 'dashboard',
    title: 'Analytics'
  },

  // Protected configuration routes
  [CONFIG_ROUTES.URL_TEST]: {
    path: CONFIG_ROUTES.URL_TEST,
    isProtected: true,
    layout: 'dashboard',
    title: 'URL Testing'
  },
  [CONFIG_ROUTES.URL_CONFIG]: {
    path: CONFIG_ROUTES.URL_CONFIG,
    isProtected: true,
    layout: 'dashboard',
    title: 'URL Configuration'
  },
  [CONFIG_ROUTES.INSTITUTION_CONFIG]: {
    path: CONFIG_ROUTES.INSTITUTION_CONFIG,
    isProtected: true,
    layout: 'dashboard',
    title: 'Institution Configuration'
  },
  [CONFIG_ROUTES.BATCH_IMPORT]: {
    path: CONFIG_ROUTES.BATCH_IMPORT,
    isProtected: true,
    layout: 'dashboard',
    title: 'Batch Import'
  },

  // Protected monitoring routes
  [MONITORING_ROUTES.ERRORS]: {
    path: MONITORING_ROUTES.ERRORS,
    isProtected: true,
    layout: 'dashboard',
    title: 'Error Monitoring'
  },
  [MONITORING_ROUTES.HEALTH]: {
    path: MONITORING_ROUTES.HEALTH,
    isProtected: true,
    layout: 'dashboard',
    title: 'System Health'
  },
  [MONITORING_ROUTES.PERFORMANCE]: {
    path: MONITORING_ROUTES.PERFORMANCE,
    isProtected: true,
    layout: 'dashboard',
    title: 'Performance Monitoring'
  },
  [MONITORING_ROUTES.SCRAPER]: {
    path: MONITORING_ROUTES.SCRAPER,
    isProtected: true,
    layout: 'dashboard',
    title: 'Scraper Monitoring'
  },

  // Protected grant routes
  [GRANT_ROUTES.EDITOR]: {
    path: GRANT_ROUTES.EDITOR,
    isProtected: true,
    layout: 'dashboard',
    title: 'Grant Editor'
  },
  [GRANT_ROUTES.LIST]: {
    path: GRANT_ROUTES.LIST,
    isProtected: true,
    layout: 'dashboard',
    title: 'Grant List'
  },

  // Search routes
  [SEARCH_ROUTES.SEARCH]: {
    path: SEARCH_ROUTES.SEARCH,
    isProtected: false,
    layout: 'main',
    title: 'Search'
  },
  [SEARCH_ROUTES.RESULTS]: {
    path: SEARCH_ROUTES.RESULTS,
    isProtected: false,
    layout: 'main',
    title: 'Search Results'
  }
};

/**
 * Helper function to check if a route is protected
 * @param path - Route path to check
 * @returns boolean indicating if route requires authentication
 */
export const isProtectedRoute = (path: string): boolean => {
  return routeConfig[path]?.isProtected ?? false;
};

/**
 * Helper function to get route layout
 * @param path - Route path to check
 * @returns Layout type for the route
 */
export const getRouteLayout = (path: string): RouteMetadata['layout'] => {
  return routeConfig[path]?.layout ?? 'main';
};