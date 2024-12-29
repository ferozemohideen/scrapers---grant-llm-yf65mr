/**
 * @fileoverview Institution configuration form component with comprehensive validation,
 * accessibility features, and secure data handling for managing institution configurations
 * across 375+ global institutions.
 * @version 1.0.0
 */

import React, { useCallback, useEffect, useMemo } from 'react';
import classNames from 'classnames'; // v2.3.1
import * as yup from 'yup'; // v1.0.0

import Form, { FormProps } from '../common/Form';
import Input from '../common/Input';
import Select from '../common/Select';
import { InstitutionConfig, InstitutionType } from '../../interfaces/config.interface';

/**
 * Props interface for InstitutionForm component
 */
export interface InstitutionFormProps {
  initialValues: InstitutionConfig;
  onSubmit: (values: InstitutionConfig) => Promise<void>;
  className?: string;
  isLoading?: boolean;
  isDirty?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

/**
 * Country options for institution configuration
 */
const COUNTRY_OPTIONS = [
  { value: 'US', label: 'United States' },
  { value: 'GB', label: 'United Kingdom' },
  { value: 'CA', label: 'Canada' },
  // Add more countries as needed
];

/**
 * Institution type options mapped from InstitutionType enum
 */
const INSTITUTION_TYPE_OPTIONS = Object.entries(InstitutionType).map(([key, value]) => ({
  value,
  label: key.replace(/_/g, ' ').toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
}));

/**
 * Validation schema for institution form using yup
 */
const validationSchema = yup.object().shape({
  name: yup
    .string()
    .required('Institution name is required')
    .min(2, 'Institution name must be at least 2 characters')
    .max(100, 'Institution name must not exceed 100 characters'),
  type: yup
    .string()
    .required('Institution type is required')
    .oneOf(Object.values(InstitutionType), 'Invalid institution type'),
  country: yup
    .string()
    .required('Country is required')
    .matches(/^[A-Z]{2}$/, 'Invalid country code'),
  metadata: yup.object().shape({
    contactEmail: yup
      .string()
      .required('Contact email is required')
      .email('Invalid email format'),
    refreshInterval: yup
      .number()
      .required('Refresh interval is required')
      .min(1, 'Minimum refresh interval is 1 day')
      .max(30, 'Maximum refresh interval is 30 days'),
    apiKeyEnv: yup
      .string()
      .required('API key environment variable name is required')
      .matches(/^[A-Z_]+$/, 'Must be uppercase letters and underscores only')
  })
});

/**
 * Institution configuration form component with comprehensive validation and accessibility
 */
export const InstitutionForm: React.FC<InstitutionFormProps> = ({
  initialValues,
  onSubmit,
  className,
  isLoading = false,
  isDirty = false,
  onDirtyChange
}) => {
  // Form submission handler with loading state
  const handleSubmit = useCallback(async (values: InstitutionConfig) => {
    try {
      await onSubmit(values);
    } catch (error) {
      console.error('Form submission failed:', error);
      throw error; // Let Form component handle the error
    }
  }, [onSubmit]);

  // Memoized class names
  const formClasses = useMemo(() => classNames(
    'institution-form',
    {
      'institution-form--loading': isLoading,
      'institution-form--dirty': isDirty
    },
    className
  ), [className, isLoading, isDirty]);

  // Track form dirty state
  const handleFormChange = useCallback((values: any) => {
    const newIsDirty = JSON.stringify(values) !== JSON.stringify(initialValues);
    onDirtyChange?.(newIsDirty);
  }, [initialValues, onDirtyChange]);

  return (
    <Form
      id="institution-form"
      className={formClasses}
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
      onChange={handleFormChange}
      isLoading={isLoading}
    >
      <div className="institution-form__section">
        <h3 className="institution-form__section-title" id="basic-info-title">
          Basic Information
        </h3>
        <div className="institution-form__field-group" role="group" aria-labelledby="basic-info-title">
          <Input
            id="institution-name"
            name="name"
            type="text"
            label="Institution Name"
            required
            aria-required="true"
          />

          <Select
            id="institution-type"
            name="type"
            options={INSTITUTION_TYPE_OPTIONS}
            label="Institution Type"
            required
            aria-required="true"
          />

          <Select
            id="institution-country"
            name="country"
            options={COUNTRY_OPTIONS}
            label="Country"
            required
            aria-required="true"
          />
        </div>
      </div>

      <div className="institution-form__section">
        <h3 className="institution-form__section-title" id="metadata-title">
          Additional Settings
        </h3>
        <div className="institution-form__field-group" role="group" aria-labelledby="metadata-title">
          <Input
            id="contact-email"
            name="metadata.contactEmail"
            type="email"
            label="Contact Email"
            required
            aria-required="true"
          />

          <Input
            id="refresh-interval"
            name="metadata.refreshInterval"
            type="number"
            label="Refresh Interval (days)"
            required
            aria-required="true"
            min={1}
            max={30}
          />

          <Input
            id="api-key-env"
            name="metadata.apiKeyEnv"
            type="text"
            label="API Key Environment Variable"
            required
            aria-required="true"
            placeholder="INSTITUTION_API_KEY"
          />
        </div>
      </div>
    </Form>
  );
};

InstitutionForm.displayName = 'InstitutionForm';

export default InstitutionForm;