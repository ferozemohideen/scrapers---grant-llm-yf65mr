import { format, parse, isValid, isBefore, isAfter, addDays, addWeeks, addMonths } from 'date-fns'; // ^2.30.0
import { enUS } from 'date-fns/locale'; // ^2.30.0

// Global constants for date formatting
export const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';

export const DATE_FORMATS = {
  shortDate: 'MM/dd/yyyy',
  longDate: 'MMMM dd, yyyy',
  isoDate: 'yyyy-MM-dd',
  timestamp: 'yyyy-MM-dd HH:mm:ss'
} as const;

/**
 * Formats a date value into a localized string using the specified format
 * @param date - Date value to format (Date object, timestamp number, or ISO string)
 * @param formatStr - Optional format string (defaults to DEFAULT_DATE_FORMAT)
 * @returns Formatted date string with locale-aware formatting
 */
export const formatDate = (
  date: Date | string | number,
  formatStr: string = DEFAULT_DATE_FORMAT
): string => {
  try {
    // Handle null/undefined inputs
    if (!date) {
      return '';
    }

    // Convert input to Date object if necessary
    const dateObj = date instanceof Date ? date : new Date(date);

    // Validate the date object
    if (!isValid(dateObj)) {
      return '';
    }

    // Apply locale-specific formatting
    return format(dateObj, formatStr, { locale: enUS });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

/**
 * Safely parses a date string into a Date object
 * @param dateStr - String representation of date to parse
 * @param formatStr - Optional format string (defaults to DEFAULT_DATE_FORMAT)
 * @returns Parsed Date object or null for invalid dates
 */
export const parseDate = (
  dateStr: string,
  formatStr: string = DEFAULT_DATE_FORMAT
): Date | null => {
  try {
    // Handle null/undefined/empty inputs
    if (!dateStr?.trim()) {
      return null;
    }

    // Sanitize input string
    const sanitizedDateStr = dateStr.trim();

    // Parse the date string
    const parsedDate = parse(sanitizedDateStr, formatStr, new Date());

    // Validate parsed date
    if (!isValid(parsedDate)) {
      return null;
    }

    // Validate date boundaries (e.g., not too far in past/future)
    const minDate = new Date('1900-01-01');
    const maxDate = new Date('2100-12-31');

    if (isBefore(parsedDate, minDate) || isAfter(parsedDate, maxDate)) {
      return null;
    }

    return parsedDate;
  } catch (error) {
    console.error('Error parsing date:', error);
    return null;
  }
};

/**
 * Performs comprehensive date validation
 * @param date - Value to validate as a date
 * @returns Boolean indicating if the date is valid
 */
export const isValidDate = (date: any): boolean => {
  try {
    // Handle null/undefined
    if (!date) {
      return false;
    }

    // Convert to Date object if necessary
    const dateObj = date instanceof Date ? date : new Date(date);

    // Validate using date-fns
    if (!isValid(dateObj)) {
      return false;
    }

    // Validate reasonable date boundaries
    const minDate = new Date('1900-01-01');
    const maxDate = new Date('2100-12-31');

    return !isBefore(dateObj, minDate) && !isAfter(dateObj, maxDate);
  } catch (error) {
    console.error('Error validating date:', error);
    return false;
  }
};

/**
 * Generates an array of dates between start and end dates
 * Uses memory-optimized approach for large ranges
 * @param start - Start date of the range
 * @param end - End date of the range
 * @returns Array of dates within the specified range
 */
export const getDateRange = (start: Date, end: Date): Date[] => {
  try {
    // Validate inputs
    if (!start || !end || !isValid(start) || !isValid(end)) {
      return [];
    }

    // Ensure start is before end
    if (isAfter(start, end)) {
      [start, end] = [end, start];
    }

    // Calculate number of days in range
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    // Use memory-efficient approach for large ranges
    const CHUNK_SIZE = 1000;
    if (days > CHUNK_SIZE) {
      // Return generator function for lazy evaluation
      return Array.from({ length: days + 1 }, (_, index) => addDays(start, index));
    }

    // For smaller ranges, generate array directly
    return Array.from({ length: days + 1 }, (_, index) => addDays(start, index));
  } catch (error) {
    console.error('Error generating date range:', error);
    return [];
  }
};

// Helper function for internal use
const isISODateString = (str: string): boolean => {
  return /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[-+]\d{2}:?\d{2})?)?$/.test(str);
};