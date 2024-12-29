import React, { useCallback, useId } from 'react';
import classNames from '../../utils/format.util';

import styles from './RadioButton.module.css';

/**
 * Props interface for the RadioButton component
 */
export interface RadioButtonProps {
  /** Name attribute for the radio input */
  name: string;
  /** Value attribute for the radio input */
  value: string;
  /** Label text to display next to the radio button */
  label: string;
  /** Whether the radio button is selected */
  checked: boolean;
  /** Whether the radio button is disabled */
  disabled?: boolean;
  /** Whether the radio button is in an error state */
  error?: boolean;
  /** Help text to display below the radio button */
  helpText?: string;
  /** Change event handler */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Additional CSS class names */
  className?: string;
  /** HTML id attribute */
  id?: string;
  /** Test identifier for testing purposes */
  'data-testid'?: string;
}

/**
 * A reusable radio button component that provides accessible form input functionality
 * with consistent styling and behavior across the application.
 * 
 * @version 1.0.0
 * @example
 * ```tsx
 * <RadioButton
 *   name="option"
 *   value="choice1"
 *   label="Choice 1"
 *   checked={selectedOption === 'choice1'}
 *   onChange={handleChange}
 *   helpText="Optional help text"
 * />
 * ```
 */
export const RadioButton = React.memo<RadioButtonProps>(({
  name,
  value,
  label,
  checked,
  disabled = false,
  error = false,
  helpText,
  onChange,
  className,
  id: providedId,
  'data-testid': testId,
}) => {
  // Generate unique IDs for accessibility
  const uniqueId = useId();
  const inputId = providedId || `radio-${uniqueId}`;
  const helpTextId = helpText ? `${inputId}-help` : undefined;
  
  // Memoize change handler for performance
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!disabled) {
      onChange(e);
    }
  }, [disabled, onChange]);

  // Compose CSS classes
  const containerClasses = classNames(
    styles['radio-container'],
    className,
    {
      [styles['radio-container--disabled']]: disabled,
      [styles['radio-container--error']]: error,
    }
  );

  const inputClasses = classNames(
    styles['radio-input'],
    {
      [styles['radio-input--checked']]: checked,
      [styles['radio-input--disabled']]: disabled,
      [styles['radio-input--error']]: error,
    }
  );

  const helpTextClasses = classNames(
    styles['radio-help-text'],
    {
      [styles['radio-help-text--error']]: error,
    }
  );

  return (
    <div className={containerClasses}>
      <div className={styles['radio-wrapper']}>
        <input
          type="radio"
          id={inputId}
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          className={inputClasses}
          aria-checked={checked}
          aria-disabled={disabled}
          aria-describedby={helpTextId}
          aria-invalid={error}
          data-testid={testId}
        />
        <label 
          htmlFor={inputId}
          className={styles['radio-label']}
        >
          {label}
        </label>
      </div>
      {helpText && (
        <div 
          id={helpTextId}
          className={helpTextClasses}
          role="note"
        >
          {helpText}
        </div>
      )}
    </div>
  );
});

RadioButton.displayName = 'RadioButton';

// CSS Module styles
const cssModule = `
.radio-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-2);
}

.radio-wrapper {
  display: flex;
  align-items: center;
  gap: var(--spacing-2);
}

.radio-input {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color);
  border-radius: 50%;
  background-color: var(--background-color);
  cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
}

.radio-input:checked {
  border-color: var(--primary-color);
}

.radio-input:checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background-color: var(--primary-color);
}

.radio-input:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

.radio-input--disabled {
  border-color: var(--border-color-disabled);
  background-color: var(--background-color-disabled);
  cursor: not-allowed;
}

.radio-input--error {
  border-color: var(--error-color);
}

.radio-label {
  color: var(--text-color);
  font-size: 1rem;
  line-height: 1.5;
  cursor: pointer;
}

.radio-container--disabled .radio-label {
  color: var(--text-color-disabled);
  cursor: not-allowed;
}

.radio-help-text {
  color: var(--help-text-color);
  font-size: 0.875rem;
  line-height: 1.4;
}

.radio-help-text--error {
  color: var(--error-color);
}

@media (forced-colors: active) {
  .radio-input {
    border: 2px solid ButtonText;
  }
  
  .radio-input:checked::after {
    background-color: ButtonText;
  }
  
  .radio-input--disabled {
    border-color: GrayText;
  }
}
`;

export default RadioButton;