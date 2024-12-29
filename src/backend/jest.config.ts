import type { Config } from '@jest/types';
import { compilerOptions } from './tsconfig.json';

// Constants for configuration
const TEST_TIMEOUT = 30000;
const COVERAGE_THRESHOLD = {
  branches: 80,
  functions: 80,
  lines: 80,
  statements: 80,
};

/**
 * Generates the complete Jest configuration for TypeScript testing environment
 * Includes settings for:
 * - TypeScript preprocessing with ts-jest
 * - Test file patterns and locations
 * - Coverage collection and thresholds
 * - Module resolution and path mapping
 * - Test environment and timeout settings
 * @returns {Config.InitialOptions} Complete Jest configuration object
 */
const getJestConfig = (): Config.InitialOptions => {
  return {
    // Use ts-jest preset for TypeScript support
    preset: 'ts-jest',
    
    // Set Node.js as the test environment
    testEnvironment: 'node',
    
    // Define root directories for tests and source files
    roots: [
      '<rootDir>/src',
      '<rootDir>/tests'
    ],
    
    // Test file patterns
    testMatch: [
      '**/__tests__/**/*.ts',
      '**/?(*.)+(spec|test).ts'
    ],
    
    // TypeScript file transformation
    transform: {
      '^.+\\.tsx?$': 'ts-jest'
    },
    
    // Module resolution settings
    moduleNameMapper: {
      '@/(.*)': '<rootDir>/src/$1'
    },
    
    // Supported file extensions
    moduleFileExtensions: [
      'ts',
      'tsx',
      'js',
      'jsx',
      'json',
      'node'
    ],
    
    // Coverage collection configuration
    collectCoverageFrom: [
      'src/**/*.{ts,tsx}',
      '!src/**/*.d.ts',
      '!src/types/**/*'
    ],
    coverageDirectory: 'coverage',
    coverageReporters: [
      'text',
      'lcov',
      'json-summary'
    ],
    coverageThreshold: {
      global: COVERAGE_THRESHOLD
    },
    
    // Test setup and configuration
    setupFilesAfterEnv: [
      '<rootDir>/tests/setup.ts'
    ],
    
    // Paths to ignore during testing
    testPathIgnorePatterns: [
      '/node_modules/',
      '/dist/',
      '/coverage/'
    ],
    
    // Additional test configuration
    verbose: true,
    testTimeout: TEST_TIMEOUT,
    clearMocks: true,
    restoreMocks: true,
    
    // Inherit TypeScript compiler options
    globals: {
      'ts-jest': {
        tsconfig: compilerOptions
      }
    }
  };
};

// Export the configuration
const config = getJestConfig();
export default config;