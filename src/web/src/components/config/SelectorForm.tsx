import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames'; // v2.3.1
import Form, { FormProps } from '../common/Form';
import Input, { ValidationError } from '../common/Input';
import { SelectorConfig } from '../../interfaces/config.interface';
import debounce from 'lodash/debounce'; // v4.17.21

/**
 * Props interface for the SelectorForm component
 */
interface SelectorFormProps {
  /** Initial selector configuration values */
  initialValues: SelectorConfig;
  /** Async callback for form submission */
  onSubmit: (selectors: SelectorConfig) => Promise<void>;
  /** Optional CSS class name */
  className?: string;
  /** Loading state indicator */
  isLoading?: boolean;
}

/**
 * Validates a CSS selector string for syntax and specificity
 * @param selector - CSS selector to validate
 * @param field - Field name for error messages
 * @returns Validation error message if invalid
 */
const validateSelector = debounce(async (selector: string, field: string): Promise<ValidationError | undefined> => {
  if (!selector.trim()) {
    return {
      message: `${field} selector is required`,
      type: 'error'
    };
  }

  try {
    // Test selector validity by attempting to parse it
    document.querySelector(selector);
    
    // Check selector specificity
    if (selector.includes('*') || selector === 'body' || selector === 'html') {
      return {
        message: `${field} selector is too generic`,
        type: 'error'
      };
    }

    // Warn about potentially problematic selectors
    if (!selector.includes('.') && !selector.includes('#')) {
      return {
        message: `${field} selector should use classes or IDs for better stability`,
        type: 'warning'
      };
    }
  } catch (error) {
    return {
      message: `Invalid ${field.toLowerCase()} selector syntax`,
      type: 'error'
    };
  }
}, 300);

/**
 * Form component for configuring and validating HTML selectors used in web scraping
 */
const SelectorForm: React.FC<SelectorFormProps> = ({
  initialValues,
  onSubmit,
  className,
  isLoading = false
}) => {
  // Validation schema for selector fields
  const validationSchema = useMemo(() => ({
    title: async (value: string) => {
      const error = await validateSelector(value, 'Title');
      return error?.message;
    },
    description: async (value: string) => {
      const error = await validateSelector(value, 'Description');
      return error?.message;
    },
    pagination: async (value: string) => {
      const error = await validateSelector(value, 'Pagination');
      return error?.message;
    }
  }), []);

  // Handle form submission
  const handleSubmit = useCallback(async (values: Record<string, string>) => {
    const selectorConfig: SelectorConfig = {
      title: values.title,
      description: values.description,
      pagination: values.pagination,
      custom: {} // Initialize empty custom selectors
    };

    await onSubmit(selectorConfig);
  }, [onSubmit]);

  const formClasses = classNames(
    'selector-form',
    className,
    {
      'selector-form--loading': isLoading
    }
  );

  return (
    <Form
      id="selector-config-form"
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      className={formClasses}
      isLoading={isLoading}
    >
      <div className="selector-form__field">
        <Input
          id="title-selector"
          name="title"
          type="text"
          label="Title Selector"
          placeholder="e.g., .tech-title, #title"
          required
          aria-label="CSS selector for technology titles"
        />
      </div>

      <div className="selector-form__field">
        <Input
          id="description-selector"
          name="description"
          type="text"
          label="Description Selector"
          placeholder="e.g., .tech-description, #description"
          required
          aria-label="CSS selector for technology descriptions"
        />
      </div>

      <div className="selector-form__field">
        <Input
          id="pagination-selector"
          name="pagination"
          type="text"
          label="Pagination Selector"
          placeholder="e.g., .pagination, #page-nav"
          required
          aria-label="CSS selector for pagination elements"
        />
      </div>

      {/* Accessibility status region */}
      <div
        className="selector-form__status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isLoading && (
          <span className="selector-form__loading-text">
            Validating selectors...
          </span>
        )}
      </div>
    </Form>
  );
};

// Add display name for debugging
SelectorForm.displayName = 'SelectorForm';

// Export component and types
export type { SelectorFormProps };
export default SelectorForm;