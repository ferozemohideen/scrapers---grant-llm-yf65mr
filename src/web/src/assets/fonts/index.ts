/**
 * Font Configuration Module
 * Defines typography system constants and utilities for the web application
 * Ensures accessibility and responsive design through semantic font definitions
 * @version 1.0.0
 */

/**
 * Valid font weight options for the typography system
 * Follows standard CSS font-weight naming conventions
 */
export type FontWeight = '400' | '500' | '600' | '700';

/**
 * Supported font file formats for web fonts
 * Modern formats prioritized for better performance and compatibility
 */
export type FontFormat = 'woff' | 'woff2' | 'ttf';

/**
 * Semantic font weight mappings
 * Provides meaningful names for numerical weights
 */
export const FONT_WEIGHTS = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700'
} as const;

/**
 * Comprehensive font size scale using rem units for accessibility
 * Follows a modular scale for consistent visual hierarchy
 * Uses rem units to respect user's browser font size settings
 */
export const FONT_SIZES = {
  xs: '0.75rem',    // 12px base
  sm: '0.875rem',   // 14px base
  base: '1rem',     // 16px base
  lg: '1.125rem',   // 18px base
  xl: '1.25rem',    // 20px base
  '2xl': '1.5rem',  // 24px base
  '3xl': '1.875rem',// 30px base
  '4xl': '2.25rem', // 36px base
  '5xl': '3rem',    // 48px base
  '6xl': '3.75rem'  // 60px base
} as const;

/**
 * Primary font family stack with system fallbacks
 * Uses Inter as primary font with system fonts as fallbacks
 * for optimal performance and consistency across platforms
 */
export const FONT_FAMILY = "'Inter', system-ui, -apple-system, sans-serif" as const;

/**
 * Returns the validated path to a font file
 * @param weight - Font weight value from FontWeight type
 * @param format - Font format value from FontFormat type
 * @returns Full path to the font file
 * @throws Error if weight or format is invalid
 */
export const getFontPath = (weight: FontWeight, format: FontFormat): string => {
  // Validate font weight
  if (!Object.values(FONT_WEIGHTS).includes(weight)) {
    throw new Error(
      `Invalid font weight: ${weight}. Must be one of: ${Object.values(FONT_WEIGHTS).join(', ')}`
    );
  }

  // Validate font format
  const validFormats: FontFormat[] = ['woff', 'woff2', 'ttf'];
  if (!validFormats.includes(format)) {
    throw new Error(
      `Invalid font format: ${format}. Must be one of: ${validFormats.join(', ')}`
    );
  }

  // Construct and return the font file path
  const basePath = '/assets/fonts/inter';
  return `${basePath}/Inter-${weight}.${format}`;
};