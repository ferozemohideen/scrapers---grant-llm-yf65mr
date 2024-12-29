/**
 * @fileoverview A reusable, accessible checkbox component that provides consistent styling,
 * form integration capabilities, and comprehensive error handling across the application.
 * @version 1.0.0
 */

import React, { useCallback, useState } from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.1
import { useFormContext } from '../../hooks/useForm';
import styles from './Checkbox.module.css';

/**
 * Props interface for the Checkbox component with comprehensive accessibility support
 */
export interface CheckboxProps {
  /** Unique identifier for the checkbox */
  name: string;
  /** Label text to display next to checkbox */
  label: string;
  /** Current checked state */
  checked?: boolean;
  /** Change handler function */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Blur handler function */
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  /** Keyboard event handler */
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Error message to display */
  error?: string;
  /** Whether the field has been touched */
  touched?: boolean;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Whether the field is required */
  required?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Custom ID for the input */
  id?: string;
  /** Accessible label for screen readers */
  'aria-label'?: string;
  /** ID of element describing the input */
  'aria-describedby'?: string;
  /** Test ID for testing purposes */
  'data-testid'?: string;
}

/**
 * A fully accessible checkbox component with form integration and error handling
 */
export const Checkbox = React.memo(({
  name,
  label,
  checked: controlledChecked,
  onChange,
  onBlur,
  onKeyDown,
  error,
  touched,
  disabled = false,
  required = false,
  className,
  id = name,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
  'data-testid': testId,
}: CheckboxProps) => {
  // Get form context if available
  const formContext = useFormContext();
  
  // Track internal checked state for uncontrolled usage
  const [internalChecked, setInternalChecked] = useState(false);
  
  // Determine if using controlled or uncontrolled checked state
  const isControlled = controlledChecked !== undefined;
  const checked = isControlled ? controlledChecked : internalChecked;

  // Generate unique IDs for accessibility
  const inputId = `checkbox-${id}`;
  const errorId = `${inputId}-error`;
  const labelId = `${inputId}-label`;

  /**
   * Handles checkbox change events with form integration
   */
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      if (!isControlled) {
        setInternalChecked(e.target.checked);
      }
      
      // Call external change handler if provided
      onChange?.(e);
      
      // Update form context if available
      if (formContext) {
        formContext.setFieldValue(name, e.target.checked);
      }
    }
  }, [disabled, isControlled, onChange, name, formContext]);

  /**
   * Handles blur events with form integration
   */
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    onBlur?.(e);
    
    // Update form touched state if available
    if (formContext) {
      formContext.setFieldTouched(name, true);
    }
  }, [onBlur, name, formContext]);

  /**
   * Handles keyboard events for accessibility
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    
    // Toggle checkbox on Space key
    if (e.key === ' ' && !disabled) {
      e.preventDefault();
      const newChecked = !checked;
      
      if (!isControlled) {
        setInternalChecked(newChecked);
      }
      
      onChange?.({
        target: { checked: newChecked }
      } as React.ChangeEvent<HTMLInputElement>);
    }
  }, [onKeyDown, disabled, checked, isControlled, onChange]);

  // Compose class names
  const containerClasses = classNames(
    styles.checkbox,
    {
      [styles['checkbox--error']]: error && touched,
      [styles['checkbox--disabled']]: disabled,
    },
    className
  );

  return (
    <div className={containerClasses} data-testid={testId}>
      <div className={styles.checkbox__container}>
        <input
          id={inputId}
          type="checkbox"
          name={name}
          checked={checked}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          required={required}
          className={styles.checkbox__input}
          aria-label={ariaLabel}
          aria-describedby={classNames(labelId, error && touched && errorId, ariaDescribedBy)}
          aria-invalid={error && touched}
          aria-required={required}
        />
        <label 
          id={labelId}
          htmlFor={inputId}
          className={styles.checkbox__label}
        >
          {label}
          {required && <span className={styles['checkbox__required-indicator']}>*</span>}
        </label>
      </div>
      
      {error && touched && (
        <div
          id={errorId}
          className={styles.checkbox__error}
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';

export default Checkbox;