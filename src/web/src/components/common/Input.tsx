import React, { useState, useCallback, useRef, useEffect } from 'react';
import classNames from 'classnames'; // v2.3.1
import { validateURL } from '../../utils/validation.util';
import useDebounce from '../../hooks/useDebounce';

// Input types supported by the component
type InputType = 'text' | 'email' | 'url' | 'password' | 'number';

// Validation error interface
interface ValidationError {
  message: string;
  type: 'error' | 'warning';
}

// Event handler types
type InputChangeHandler = (value: string) => void;
type InputBlurHandler = () => void;
type InputKeyboardHandler = (event: React.KeyboardEvent<HTMLInputElement>) => void;

// Custom validation function type
type ValidationFunction = (value: string) => ValidationError | null;

// Props interface with comprehensive type definitions
interface InputProps {
  id: string;
  name: string;
  type: InputType;
  value: string;
  label: string;
  placeholder?: string;
  error?: ValidationError;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  validate?: ValidationFunction;
  onChange: InputChangeHandler;
  onBlur?: InputBlurHandler;
  onKeyDown?: InputKeyboardHandler;
}

/**
 * Enhanced Input component with accessibility and validation support
 * Implements ARIA attributes and keyboard navigation
 */
const Input: React.FC<InputProps> = React.memo(({
  id,
  name,
  type,
  value,
  label,
  placeholder,
  error: externalError,
  disabled = false,
  required = false,
  className,
  validate,
  onChange,
  onBlur,
  onKeyDown
}) => {
  // Internal state management
  const [isFocused, setIsFocused] = useState(false);
  const [internalError, setInternalError] = useState<ValidationError | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate unique IDs for accessibility
  const inputId = `input-${id}`;
  const errorId = `error-${id}`;

  // Debounce validation for performance
  const debouncedValue = useDebounce(value, 300);

  // Internal validation logic
  const validateInput = useCallback((inputValue: string) => {
    if (!inputValue && required) {
      return { message: `${label} is required`, type: 'error' as const };
    }

    if (type === 'url' && inputValue) {
      const urlValidation = validateURL(inputValue);
      if (!urlValidation.isValid) {
        return { message: urlValidation.errors[0], type: 'error' as const };
      }
    }

    if (validate) {
      return validate(inputValue);
    }

    return null;
  }, [label, required, type, validate]);

  // Effect for validation on value changes
  useEffect(() => {
    const validationResult = validateInput(debouncedValue);
    setInternalError(validationResult);
  }, [debouncedValue, validateInput]);

  // Combine external and internal errors
  const error = externalError || internalError;

  // Event handlers
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    onBlur?.();
  }, [onBlur]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
  }, [onKeyDown]);

  // CSS classes composition
  const containerClasses = classNames(
    'input-container',
    className,
    {
      'input-container--disabled': disabled,
      'input-container--error': error,
      'input-container--focused': isFocused
    }
  );

  const inputClasses = classNames(
    'input',
    {
      'input--error': error,
      'input--disabled': disabled,
      'input--focused': isFocused
    }
  );

  return (
    <div className={containerClasses}>
      <label 
        htmlFor={inputId}
        className="input-label"
      >
        {label}
        {required && <span className="input-required" aria-hidden="true">*</span>}
      </label>

      <input
        ref={inputRef}
        id={inputId}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClasses}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={error ? errorId : undefined}
        aria-label={label}
      />

      {error && (
        <div 
          id={errorId}
          className="input-error-message"
          role="alert"
          aria-live="polite"
        >
          <span className="input-error-icon" aria-hidden="true">⚠</span>
          {error.message}
        </div>
      )}
    </div>
  );
});

Input.displayName = 'Input';

// Export component and types
export type { InputProps, ValidationError, InputType };
export default Input;