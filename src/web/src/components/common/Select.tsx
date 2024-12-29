/**
 * @fileoverview A reusable select/dropdown component with comprehensive accessibility,
 * form integration, and validation support for the Technology Transfer Data Aggregation system.
 * @version 1.0.0
 */

import React, { useCallback, useMemo } from 'react'; // v18.0.0
import classNames from 'classnames'; // v2.3.1
import { useForm } from '../../hooks/useForm';

import styles from './Select.module.css';

/**
 * Interface for select option items
 */
interface SelectOption {
  value: string;
  label: string;
}

/**
 * Props interface for the Select component
 */
export interface SelectProps {
  /** Input name for form integration */
  name: string;
  /** Unique identifier for ARIA attributes */
  id: string;
  /** Array of selectable options */
  options: SelectOption[];
  /** Currently selected value */
  value: string;
  /** Change handler function */
  onChange: (value: string) => void;
  /** Blur handler function */
  onBlur?: () => void;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Error message for validation feedback */
  error?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Custom aria-label */
  ariaLabel?: string;
}

/**
 * A fully accessible select component with form integration and validation support.
 * Implements WAI-ARIA combobox pattern for enhanced accessibility.
 */
export const Select = React.memo(({
  name,
  id,
  options,
  value,
  onChange,
  onBlur,
  disabled = false,
  error,
  placeholder = 'Select an option',
  className,
  required = false,
  ariaLabel
}: SelectProps) => {
  // Generate unique IDs for ARIA attributes
  const errorId = useMemo(() => `${id}-error`, [id]);
  const labelId = useMemo(() => `${id}-label`, [id]);

  // Form integration
  const { setFieldValue, setFieldTouched } = useForm({
    initialValues: { [name]: value },
    validationSchema: {},
    onSubmit: () => {}
  });

  /**
   * Handles change events and updates form state
   */
  const handleChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = event.target.value;
    onChange(newValue);
    setFieldValue(name, newValue);
  }, [onChange, name, setFieldValue]);

  /**
   * Handles blur events for validation
   */
  const handleBlur = useCallback(() => {
    setFieldTouched(name, true);
    onBlur?.();
  }, [name, onBlur, setFieldTouched]);

  /**
   * Handles keyboard navigation for accessibility
   */
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLSelectElement>) => {
    switch (event.key) {
      case 'Escape':
        event.currentTarget.blur();
        break;
      case 'Enter':
      case ' ':
        if (!event.currentTarget.open) {
          event.currentTarget.click();
        }
        break;
      default:
        break;
    }
  }, []);

  // Compute class names for styling
  const selectClasses = classNames(
    styles.select,
    {
      [styles['select--error']]: error,
      [styles['select--disabled']]: disabled
    },
    className
  );

  return (
    <div className={styles.selectContainer}>
      <select
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={selectClasses}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        aria-label={ariaLabel}
        aria-labelledby={labelId}
        aria-required={required}
        required={required}
      >
        <option value="" disabled hidden>
          {placeholder}
        </option>
        {options.map(({ value: optionValue, label }) => (
          <option key={optionValue} value={optionValue}>
            {label}
          </option>
        ))}
      </select>

      {error && (
        <div 
          id={errorId}
          className={styles.select__error}
          role="alert"
          aria-live="polite"
        >
          {error}
        </div>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;