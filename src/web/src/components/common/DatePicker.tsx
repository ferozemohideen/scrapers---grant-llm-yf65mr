import React, { useState, useCallback, useEffect } from 'react';
import classNames from 'classnames'; // v2.3.1
import { Input } from './Input';
import { formatDate, parseDate, isValidDate, sanitizeDateInput } from '../../utils/date.util';

// DatePicker validation modes
type ValidationMode = 'strict' | 'loose';

// Interface for date validation error messages
interface DateErrorMessages {
  required?: string;
  invalid?: string;
  minDate?: string;
  maxDate?: string;
  format?: string;
}

// Props interface with comprehensive type definitions
interface DatePickerProps {
  /** Input field name */
  name: string;
  /** Current date value */
  value: Date | string | null;
  /** Handler for date changes */
  onChange: (date: Date | null, isValid: boolean) => void;
  /** Handler for blur events */
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Error message to display */
  error?: string;
  /** Whether the field has been touched */
  touched?: boolean;
  /** Placeholder text */
  placeholder?: string;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Input field ID */
  id?: string;
  /** Minimum allowed date */
  minDate?: Date;
  /** Maximum allowed date */
  maxDate?: Date;
  /** Date format string */
  format?: string;
  /** Locale for date formatting */
  locale?: string;
  /** ARIA label */
  ariaLabel?: string;
  /** Validation mode */
  validationMode?: ValidationMode;
  /** Custom error messages */
  errorMessages?: DateErrorMessages;
}

/**
 * Enhanced DatePicker component with comprehensive validation and accessibility support
 */
const DatePicker: React.FC<DatePickerProps> = ({
  name,
  value,
  onChange,
  onBlur,
  error,
  touched = false,
  placeholder,
  disabled = false,
  required = false,
  className,
  id,
  minDate,
  maxDate,
  format = 'yyyy-MM-dd',
  locale = 'en-US',
  ariaLabel,
  validationMode = 'strict',
  errorMessages = {}
}) => {
  // Initialize state with formatted value
  const [inputValue, setInputValue] = useState(() => {
    return value ? formatDate(value, format) : '';
  });

  // Default error messages
  const defaultErrorMessages: Required<DateErrorMessages> = {
    required: 'This field is required',
    invalid: 'Please enter a valid date',
    minDate: `Date must be after ${minDate ? formatDate(minDate, format) : ''}`,
    maxDate: `Date must be before ${maxDate ? formatDate(maxDate, format) : ''}`,
    format: `Please enter date in ${format} format`,
    ...errorMessages
  };

  // Validate date with comprehensive checks
  const validateDate = useCallback((dateStr: string): boolean => {
    if (!dateStr && required) {
      return false;
    }

    if (!dateStr) {
      return true;
    }

    const parsedDate = parseDate(dateStr, format);
    if (!parsedDate) {
      return false;
    }

    if (minDate && parsedDate < minDate) {
      return false;
    }

    if (maxDate && parsedDate > maxDate) {
      return false;
    }

    return true;
  }, [format, required, minDate, maxDate]);

  // Handle input changes with validation
  const handleChange = useCallback((newValue: string) => {
    // Sanitize input to prevent XSS
    const sanitizedValue = sanitizeDateInput(newValue);
    setInputValue(sanitizedValue);

    // Parse and validate date
    const parsedDate = parseDate(sanitizedValue, format);
    const isValid = validateDate(sanitizedValue);

    // Notify parent with parsed date and validation status
    onChange(parsedDate, isValid);
  }, [format, onChange, validateDate]);

  // Update input value when prop value changes
  useEffect(() => {
    const formattedValue = value ? formatDate(value, format) : '';
    setInputValue(formattedValue);
  }, [value, format]);

  // Generate unique IDs for accessibility
  const inputId = id || `datepicker-${name}`;
  const errorId = `${inputId}-error`;

  // Compose CSS classes
  const containerClasses = classNames(
    'datepicker',
    className,
    {
      'datepicker--error': error && touched,
      'datepicker--disabled': disabled
    }
  );

  return (
    <div className={containerClasses}>
      <Input
        id={inputId}
        name={name}
        type="text"
        value={inputValue}
        onChange={handleChange}
        onBlur={onBlur}
        error={touched && error ? { message: error, type: 'error' } : undefined}
        disabled={disabled}
        required={required}
        placeholder={placeholder || format}
        aria-label={ariaLabel || `Date input in ${format} format`}
        aria-invalid={!!(touched && error)}
        aria-required={required}
        aria-describedby={error ? errorId : undefined}
      />
      
      {touched && error && (
        <div 
          id={errorId}
          className="datepicker__error"
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
};

// Export component and types
export type { DatePickerProps, ValidationMode, DateErrorMessages };
export default DatePicker;