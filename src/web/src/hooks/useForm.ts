/**
 * @fileoverview Enhanced form management hook with advanced validation, security features,
 * and performance optimizations for handling URL configuration forms and sensitive data.
 * @version 1.0.0
 */

import { useState, useCallback, useEffect, useRef } from 'react'; // v18.0.0
import { validateURL } from '../utils/validation.util';
import debounce from 'lodash/debounce'; // v4.17.21
import DOMPurify from 'dompurify'; // v3.0.1

/**
 * Configuration options for the useForm hook
 */
export interface UseFormConfig {
  initialValues: Record<string, any>;
  validationSchema: Record<string, (value: any, allValues: Record<string, any>) => Promise<string | undefined> | string | undefined>;
  onSubmit: (values: Record<string, any>) => Promise<void> | void;
  sanitize?: boolean;
  rateLimit?: number;
  validationMode?: 'onChange' | 'onBlur' | 'onSubmit';
  validateDependencies?: Record<string, string[]>;
}

/**
 * Return type for the useForm hook containing form state and handlers
 */
export interface UseFormReturn {
  values: Record<string, any>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
  isValidating: boolean;
  submitCount: number;
  setFieldValue: (field: string, value: any) => void;
  setFieldTouched: (field: string, touched: boolean) => void;
  validateField: (field: string) => Promise<string | undefined>;
  validateForm: () => Promise<Record<string, string>>;
  resetForm: () => void;
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
}

/**
 * Enhanced form management hook with security features and validation
 * @param config Form configuration options
 * @returns Form state and handlers
 */
export function useForm({
  initialValues,
  validationSchema,
  onSubmit,
  sanitize = true,
  rateLimit = 1000,
  validationMode = 'onChange',
  validateDependencies = {}
}: UseFormConfig): UseFormReturn {
  // Form state
  const [values, setValues] = useState<Record<string, any>>(sanitizeValues(initialValues));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  // Validation cache for performance optimization
  const validationCache = useRef<Record<string, { value: any; result: string | undefined }>>({});
  
  // Rate limiting state
  const lastSubmitTime = useRef<number>(0);

  /**
   * Sanitizes form values to prevent XSS attacks
   */
  function sanitizeValues(values: Record<string, any>): Record<string, any> {
    if (!sanitize) return values;
    
    return Object.entries(values).reduce((acc, [key, value]) => {
      if (typeof value === 'string') {
        acc[key] = DOMPurify.sanitize(value);
      } else {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);
  }

  /**
   * Validates a single field with caching and dependency tracking
   */
  const validateField = useCallback(async (
    field: string,
    value: any = values[field],
    shouldUpdateState = true
  ): Promise<string | undefined> => {
    // Check cache for unchanged values
    const cached = validationCache.current[field];
    if (cached && cached.value === value) {
      return cached.result;
    }

    const validator = validationSchema[field];
    if (!validator) return undefined;

    try {
      const error = await validator(value, values);
      
      // Cache validation result
      validationCache.current[field] = { value, result: error };

      // Update form state if needed
      if (shouldUpdateState) {
        setErrors(prev => ({
          ...prev,
          [field]: error || ''
        }));
      }

      // Validate dependent fields
      if (validateDependencies[field]) {
        await Promise.all(
          validateDependencies[field].map(dependentField =>
            validateField(dependentField, values[dependentField], shouldUpdateState)
          )
        );
      }

      return error;
    } catch (err) {
      console.error(`Validation error for field ${field}:`, err);
      return 'Validation failed';
    }
  }, [values, validationSchema, validateDependencies]);

  /**
   * Debounced validation handler for performance
   */
  const debouncedValidation = useCallback(
    debounce(validateField, 300),
    [validateField]
  );

  /**
   * Sets field value with sanitization and validation
   */
  const setFieldValue = useCallback(async (field: string, value: any) => {
    const sanitizedValue = sanitize && typeof value === 'string'
      ? DOMPurify.sanitize(value)
      : value;

    setValues(prev => ({
      ...prev,
      [field]: sanitizedValue
    }));

    if (validationMode === 'onChange') {
      debouncedValidation(field, sanitizedValue);
    }
  }, [sanitize, validationMode, debouncedValidation]);

  /**
   * Sets field touched state and triggers validation
   */
  const setFieldTouched = useCallback(async (field: string, isTouched: boolean) => {
    setTouched(prev => ({
      ...prev,
      [field]: isTouched
    }));

    if (validationMode === 'onBlur' && isTouched) {
      await validateField(field);
    }
  }, [validationMode, validateField]);

  /**
   * Validates entire form
   */
  const validateForm = useCallback(async (): Promise<Record<string, string>> => {
    setIsValidating(true);
    const validationPromises = Object.keys(validationSchema).map(field =>
      validateField(field, values[field], false)
    );

    try {
      const validationResults = await Promise.all(validationPromises);
      const newErrors = Object.keys(validationSchema).reduce((acc, field, index) => {
        if (validationResults[index]) {
          acc[field] = validationResults[index] || '';
        }
        return acc;
      }, {} as Record<string, string>);

      setErrors(newErrors);
      setIsValidating(false);
      return newErrors;
    } catch (err) {
      console.error('Form validation failed:', err);
      setIsValidating(false);
      return { form: 'Validation failed' };
    }
  }, [values, validationSchema, validateField]);

  /**
   * Handles form submission with rate limiting and validation
   */
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Rate limiting check
    const now = Date.now();
    if (now - lastSubmitTime.current < rateLimit) {
      console.warn('Submission rate limited');
      return;
    }
    lastSubmitTime.current = now;

    setIsSubmitting(true);
    setSubmitCount(prev => prev + 1);

    try {
      const formErrors = await validateForm();
      if (Object.keys(formErrors).length === 0) {
        await onSubmit(values);
      }
    } catch (err) {
      console.error('Form submission failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validateForm, onSubmit, rateLimit]);

  /**
   * Resets form to initial state
   */
  const resetForm = useCallback(() => {
    setValues(sanitizeValues(initialValues));
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
    setIsValidating(false);
    validationCache.current = {};
  }, [initialValues, sanitize]);

  // Calculate form validity
  const isValid = Object.keys(errors).length === 0;

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isValidating,
    submitCount,
    setFieldValue,
    setFieldTouched,
    validateField,
    validateForm,
    resetForm,
    handleSubmit
  };
}

export default useForm;