/**
 * @fileoverview Utility functions for formatting data types with accessibility support
 * Provides consistent, type-safe formatting for currency, numbers, percentages,
 * text content, and byte sizes across the web application.
 * @version 1.0.0
 */

import numeral from 'numeral'; // ^2.0.6
import { IProposalMetadata } from '../interfaces/grant.interface';
import { formatDate } from './date.util';
import memoize from 'lodash/memoize'; // For performance optimization

// Global constants for formatting
export const DEFAULT_CURRENCY = 'USD';

export const NUMBER_FORMATS = {
  compact: '0.0a',
  percentage: '0.0%',
  decimal: '0,0.00',
  integer: '0,0',
  bytes: '0.00b'
} as const;

// Cache size for memoized functions
const FORMAT_CACHE_SIZE = 100;

/**
 * Formats a number as currency with proper symbol and accessibility attributes
 * @param amount - Numeric amount to format
 * @param currency - Optional currency code (defaults to USD)
 * @returns Formatted currency string with ARIA attributes
 */
export const formatCurrency = memoize((amount: number, currency: string = DEFAULT_CURRENCY): string => {
  try {
    // Handle invalid inputs
    if (amount === null || amount === undefined || isNaN(amount)) {
      return '';
    }

    // Format the number with proper decimal places
    const formattedAmount = numeral(amount).format('0,0.00');
    
    // Add currency symbol and accessibility attributes
    const currencySymbol = currency === 'USD' ? '$' : currency;
    const formattedCurrency = `${currencySymbol}${formattedAmount}`;
    
    return `<span aria-label="${amount} ${currency}">${formattedCurrency}</span>`;
  } catch (error) {
    console.error('Error formatting currency:', error);
    return '';
  }
}, (amount, currency) => `${amount}-${currency}`);

/**
 * Formats a decimal number as a percentage with accessibility support
 * @param value - Decimal value to format as percentage
 * @returns Formatted percentage string with ARIA attributes
 */
export const formatPercentage = memoize((value: number): string => {
  try {
    // Handle invalid inputs
    if (value === null || value === undefined || isNaN(value)) {
      return '';
    }

    // Convert decimal to percentage and format
    const percentage = numeral(value).format(NUMBER_FORMATS.percentage);
    
    return `<span aria-label="${value * 100} percent">${percentage}</span>`;
  } catch (error) {
    console.error('Error formatting percentage:', error);
    return '';
  }
});

/**
 * Formats a number with proper thousand separators and decimal places
 * @param value - Number to format
 * @param format - Optional format string from NUMBER_FORMATS
 * @returns Formatted number string with ARIA attributes
 */
export const formatNumber = memoize((
  value: number,
  format: keyof typeof NUMBER_FORMATS = 'decimal'
): string => {
  try {
    // Handle invalid inputs
    if (value === null || value === undefined || isNaN(value)) {
      return '';
    }

    // Format the number using specified format
    const formattedNumber = numeral(value).format(NUMBER_FORMATS[format]);
    
    return `<span aria-label="${value}">${formattedNumber}</span>`;
  } catch (error) {
    console.error('Error formatting number:', error);
    return '';
  }
}, (value, format) => `${value}-${format}`);

/**
 * Truncates text to specified length with ellipsis and accessibility
 * @param text - Text string to truncate
 * @param length - Maximum length before truncation
 * @returns Truncated text string with ARIA attributes
 */
export const truncateText = (text: string, length: number): string => {
  try {
    // Handle invalid inputs
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Return original if shorter than length
    if (text.length <= length) {
      return text;
    }

    // Truncate at word boundary
    const truncated = text.substring(0, length).replace(/\s+\S*$/, '');
    
    return `<span 
      aria-label="${text}"
      title="${text}"
    >${truncated}...</span>`;
  } catch (error) {
    console.error('Error truncating text:', error);
    return text;
  }
};

/**
 * Formats byte size to human readable format with proper units
 * @param bytes - Number of bytes to format
 * @returns Formatted byte size string with ARIA attributes
 */
export const formatBytes = memoize((bytes: number): string => {
  try {
    // Handle invalid inputs
    if (bytes === null || bytes === undefined || isNaN(bytes) || bytes < 0) {
      return '';
    }

    // Format using numeral's byte format
    const formatted = numeral(bytes).format(NUMBER_FORMATS.bytes);
    
    return `<span aria-label="${bytes} bytes">${formatted}</span>`;
  } catch (error) {
    console.error('Error formatting bytes:', error);
    return '';
  }
});

// Type guard for runtime type checking
const isValidNumber = (value: any): value is number => {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
};

// Clear memoization caches periodically to prevent memory leaks
setInterval(() => {
  formatCurrency.cache.clear?.();
  formatPercentage.cache.clear?.();
  formatNumber.cache.clear?.();
  formatBytes.cache.clear?.();
}, 3600000); // Clear every hour

// Export type definitions for external use
export type FormatOptions = keyof typeof NUMBER_FORMATS;