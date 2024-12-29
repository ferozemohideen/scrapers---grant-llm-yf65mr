// External imports - versions specified in package.json
import React, { useId, useRef, useCallback } from 'react';
import classNames from 'classnames';

// Styles
import styles from './TextArea.module.css';

/**
 * Props interface for TextArea component
 * @interface TextAreaProps
 */
export interface TextAreaProps {
  /** Input field name for form identification */
  name: string;
  /** Current input value */
  value: string;
  /** Change event handler */
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  /** Blur event handler for validation */
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void;
  /** Error message to display */
  error?: string;
  /** Label text for the textarea */
  label: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state flag */
  disabled?: boolean;
  /** Required field flag */
  required?: boolean;
  /** Number of visible text rows */
  rows?: number;
  /** Maximum character length */
  maxLength?: number;
  /** Additional CSS classes */
  className?: string;
  /** Custom ID for the textarea */
  id?: string;
}

/**
 * TextArea component provides multi-line text input functionality with accessibility,
 * validation, and character counting features.
 *
 * @component
 * @example
 * ```tsx
 * <TextArea
 *   name="description"
 *   label="Description"
 *   value={description}
 *   onChange={handleChange}
 *   required
 *   maxLength={500}
 * />
 * ```
 */
export const TextArea: React.FC<TextAreaProps> = ({
  name,
  value,
  onChange,
  onBlur,
  error,
  label,
  placeholder,
  disabled = false,
  required = false,
  rows = 4,
  maxLength,
  className,
  id: customId,
}) => {
  // Generate unique IDs for accessibility
  const generatedId = useId();
  const id = customId || `textarea-${generatedId}`;
  const errorId = `${id}-error`;
  const descriptionId = `${id}-description`;
  
  // Ref for focus management
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Calculate remaining characters if maxLength is provided
  const remainingChars = maxLength ? maxLength - value.length : null;

  // Debounced onChange handler for performance
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (maxLength && e.target.value.length > maxLength) {
        return;
      }
      onChange(e);
    },
    [maxLength, onChange]
  );

  // Compose CSS classes
  const textareaClasses = classNames(
    styles.textarea,
    {
      [styles['textarea--error']]: error,
      [styles['textarea--disabled']]: disabled,
    },
    className
  );

  // Compose aria-describedby value
  const ariaDescribedBy = [
    error && errorId,
    maxLength && descriptionId,
  ].filter(Boolean).join(' ');

  return (
    <div className={styles['textarea-container']}>
      {/* Label */}
      <label 
        htmlFor={id}
        className={styles.textarea__label}
      >
        {label}
        {required && <span className={styles['textarea__label--required']}>*</span>}
      </label>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        id={id}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={onBlur}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        rows={rows}
        maxLength={maxLength}
        className={textareaClasses}
        aria-invalid={!!error}
        aria-required={required}
        aria-describedby={ariaDescribedBy || undefined}
        aria-errormessage={error ? errorId : undefined}
      />

      {/* Error message */}
      {error && (
        <div 
          id={errorId}
          className={styles.textarea__error}
          role="alert"
        >
          {error}
        </div>
      )}

      {/* Character counter */}
      {maxLength && (
        <div 
          id={descriptionId}
          className={styles.textarea__counter}
        >
          {remainingChars} characters remaining
        </div>
      )}
    </div>
  );
};

// Default export
export default TextArea;