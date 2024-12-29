import React, { useCallback, useMemo } from 'react';
import classNames from 'classnames'; // v2.3.1
import useForm from '../../hooks/useForm';
import Input, { InputProps } from './Input';

/**
 * Props interface for the Form component with comprehensive configuration options
 */
export interface FormProps {
  /** Initial form field values */
  initialValues: Record<string, any>;
  /** Field-level validation schema */
  validationSchema: Record<string, (value: any) => string | undefined>;
  /** Form submission handler */
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
  /** Form content elements */
  children: React.ReactNode;
  /** Optional custom CSS classes */
  className?: string;
  /** Unique form identifier */
  id: string;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Success message */
  successMessage?: string;
  /** Form level error message */
  errorMessage?: string;
}

/**
 * Context interface for providing form state and handlers to child components
 */
export interface FormContextValue {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  isSubmitting: boolean;
  isValid: boolean;
}

// Create form context
const FormContext = React.createContext<FormContextValue | undefined>(undefined);

/**
 * Enhanced Form component with comprehensive validation, accessibility, and security features
 */
export const Form: React.FC<FormProps> = ({
  initialValues,
  validationSchema,
  onSubmit,
  children,
  className,
  id,
  isLoading = false,
  successMessage,
  errorMessage
}) => {
  // Initialize form state using useForm hook
  const {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    setFieldValue,
    setFieldTouched,
    handleSubmit
  } = useForm({
    initialValues,
    validationSchema,
    onSubmit,
    sanitize: true, // Enable input sanitization
    rateLimit: 1000, // Rate limit form submissions
    validationMode: 'onChange'
  });

  // Handle input change events
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFieldValue(name, value);
  }, [setFieldValue]);

  // Handle input blur events
  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const { name } = e.target;
    setFieldTouched(name, true);
  }, [setFieldTouched]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    isSubmitting,
    isValid
  }), [values, errors, touched, handleChange, handleBlur, isSubmitting, isValid]);

  // Compose CSS classes
  const formClasses = classNames(
    'form',
    className,
    {
      'form--loading': isLoading || isSubmitting,
      'form--error': errorMessage,
      'form--success': successMessage
    }
  );

  return (
    <form
      id={id}
      className={formClasses}
      onSubmit={handleSubmit}
      noValidate // Use custom validation
      aria-busy={isLoading || isSubmitting}
    >
      {/* Accessibility announcement region */}
      <div
        className="form__status"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {isSubmitting && 'Submitting form...'}
        {successMessage && (
          <div className="form__success-message">
            {successMessage}
          </div>
        )}
      </div>

      {/* Error message display */}
      {errorMessage && (
        <div
          className="form__error-message"
          role="alert"
          aria-live="assertive"
        >
          {errorMessage}
        </div>
      )}

      {/* Form context provider */}
      <FormContext.Provider value={contextValue}>
        <div className="form__fields">
          {children}
        </div>
      </FormContext.Provider>

      {/* Form controls */}
      <div className="form__controls">
        <button
          type="submit"
          className="form__submit-button"
          disabled={isSubmitting || !isValid || isLoading}
          aria-disabled={isSubmitting || !isValid || isLoading}
        >
          {isSubmitting ? 'Submitting...' : 'Submit'}
        </button>
      </div>
    </form>
  );
};

/**
 * Custom hook for accessing form context in child components
 */
export const useFormContext = () => {
  const context = React.useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a Form component');
  }
  return context;
};

/**
 * Field component for rendering form inputs with context integration
 */
export const Field: React.FC<Omit<InputProps, 'onChange' | 'onBlur' | 'value'>> = ({
  name,
  ...props
}) => {
  const { values, errors, touched, handleChange, handleBlur } = useFormContext();

  return (
    <Input
      {...props}
      name={name}
      value={values[name] || ''}
      onChange={handleChange}
      onBlur={handleBlur}
      error={touched[name] && errors[name] ? {
        message: errors[name],
        type: 'error'
      } : undefined}
    />
  );
};

Form.displayName = 'Form';
Field.displayName = 'Field';

export default Form;
```

This implementation provides a robust form component with the following features:

1. Comprehensive form state management using the custom useForm hook
2. Context-based state sharing with child components
3. Built-in validation with schema support
4. Accessibility features including ARIA attributes and live regions
5. Security measures including input sanitization and rate limiting
6. Loading and error states with visual feedback
7. Reusable Field component for form inputs
8. Type safety with TypeScript interfaces
9. Performance optimizations with useMemo and useCallback
10. Consistent styling support through CSS classes

The component can be used to handle URL configuration forms as specified in the technical requirements, with support for validation, accessibility, and security measures. It integrates with the provided Input component and useForm hook to create a complete form management solution.

Example usage:
```tsx
<Form
  id="url-config-form"
  initialValues={{ url: '', name: '' }}
  validationSchema={{
    url: validateURL,
    name: (value) => !value ? 'Name is required' : undefined
  }}
  onSubmit={handleSubmit}
>
  <Field
    id="url"
    name="url"
    type="url"
    label="URL"
    required
  />
  <Field
    id="name"
    name="name"
    type="text"
    label="Name"
    required
  />
</Form>