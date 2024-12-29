/// <reference types="vite/client" /> // v4.4.0

/**
 * Type definitions for Vite environment variables and module declarations.
 * Provides strict type safety for the web application's environment configuration.
 */

/**
 * Environment variables interface for the application.
 * Defines strongly-typed environment variables accessible via import.meta.env
 */
interface ImportMetaEnv {
  /** API base URL for backend service calls */
  readonly VITE_API_URL: string;

  /** Application environment mode */
  readonly VITE_NODE_ENV: 'development' | 'production' | 'test';

  /** Application title used in various UI components */
  readonly VITE_APP_TITLE: string;
}

/**
 * Extends the ImportMeta interface to include our custom environment variables.
 * This augments the global import.meta object with type-safe environment access.
 */
interface ImportMeta {
  /** Environment variables with strict typing */
  readonly env: ImportMetaEnv;
}