import React, { useState, useCallback, useEffect } from 'react';
import classNames from 'classnames'; // v2.3.1
import { Form, FormProps } from '../common/Form';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { URLConfig, InstitutionType, ScrapingConfig } from '../../interfaces/config.interface';
import { ConfigService } from '../../services/config.service';
import { validateURL } from '../../utils/validation.util';
import useDebounce from '../../hooks/useDebounce';

import styles from './URLConfigForm.module.css';

/**
 * Props interface for URLConfigForm component
 */
export interface URLConfigFormProps {
  initialValues?: Partial<URLConfig>;
  onSubmit: (config: URLConfig) => Promise<void>;
  onCancel: () => void;
  isEdit?: boolean;
  isLoading?: boolean;
}

/**
 * Form state interface for internal management
 */
interface FormState {
  isTestingConnection: boolean;
  validationErrors: string[];
  isDirty: boolean;
  showApiKeyField: boolean;
}

/**
 * URLConfigForm component for managing technology transfer data source configurations
 */
export const URLConfigForm: React.FC<URLConfigFormProps> = ({
  initialValues,
  onSubmit,
  onCancel,
  isEdit = false,
  isLoading = false
}) => {
  // Form state management
  const [formState, setFormState] = useState<FormState>({
    isTestingConnection: false,
    validationErrors: [],
    isDirty: false,
    showApiKeyField: initialValues?.institution?.type === InstitutionType.FEDERAL_LAB
  });

  // Default values for new configurations
  const defaultValues: URLConfig = {
    url: '',
    institution: {
      name: '',
      type: InstitutionType.US_UNIVERSITY,
      country: 'US',
      metadata: {
        contactEmail: '',
        apiKeyEnv: '',
        refreshInterval: 14
      }
    },
    scraping: {
      selectors: {
        title: '',
        description: '',
        pagination: '',
        custom: {}
      },
      rateLimit: 2,
      retryConfig: {
        maxAttempts: 3,
        backoffMs: 1000
      }
    },
    active: true,
    lastUpdated: new Date()
  };

  // Combine initial values with defaults
  const formValues = { ...defaultValues, ...initialValues };

  // Debounced URL validation
  const debouncedUrlValidation = useDebounce(async (url: string) => {
    if (!url) return;
    const validation = validateURL(url);
    if (!validation.isValid) {
      setFormState(prev => ({
        ...prev,
        validationErrors: validation.errors
      }));
    }
  }, 500);

  /**
   * Handles form field changes with validation
   */
  const handleChange = useCallback((field: string, value: any) => {
    setFormState(prev => ({ ...prev, isDirty: true }));

    if (field === 'url') {
      debouncedUrlValidation(value);
    }

    if (field === 'institution.type') {
      setFormState(prev => ({
        ...prev,
        showApiKeyField: value === InstitutionType.FEDERAL_LAB
      }));
    }
  }, [debouncedUrlValidation]);

  /**
   * Tests URL configuration connection
   */
  const handleTestConnection = useCallback(async (values: URLConfig) => {
    setFormState(prev => ({ ...prev, isTestingConnection: true }));
    try {
      const result = await ConfigService.testURLConfig(values);
      if (!result.accessible) {
        setFormState(prev => ({
          ...prev,
          validationErrors: result.errors || ['URL is not accessible']
        }));
      }
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        validationErrors: [(error as Error).message]
      }));
    } finally {
      setFormState(prev => ({ ...prev, isTestingConnection: false }));
    }
  }, []);

  /**
   * Handles form submission with validation
   */
  const handleSubmit = useCallback(async (values: URLConfig) => {
    const validation = validateURL(values.url);
    if (!validation.isValid) {
      setFormState(prev => ({
        ...prev,
        validationErrors: validation.errors
      }));
      return;
    }

    try {
      await onSubmit(values);
    } catch (error) {
      setFormState(prev => ({
        ...prev,
        validationErrors: [(error as Error).message]
      }));
    }
  }, [onSubmit]);

  return (
    <Form
      className={styles.urlConfigForm}
      onSubmit={handleSubmit}
      initialValues={formValues}
      id="url-config-form"
    >
      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Institution Details</h3>
        
        <Input
          id="institution-name"
          name="institution.name"
          label="Institution Name"
          type="text"
          required
          aria-required="true"
        />

        <Select
          id="institution-type"
          name="institution.type"
          label="Institution Type"
          options={Object.values(InstitutionType).map(type => ({
            value: type,
            label: type.replace('_', ' ')
          }))}
          required
          onChange={(value) => handleChange('institution.type', value)}
        />

        <Input
          id="contact-email"
          name="institution.metadata.contactEmail"
          label="Contact Email"
          type="email"
          required
          aria-required="true"
        />
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>URL Configuration</h3>
        
        <Input
          id="url"
          name="url"
          label="Base URL"
          type="url"
          required
          aria-required="true"
          onChange={(value) => handleChange('url', value)}
        />

        {formState.showApiKeyField && (
          <Input
            id="api-key-env"
            name="institution.metadata.apiKeyEnv"
            label="API Key Environment Variable"
            type="text"
            required
            aria-required="true"
          />
        )}

        <Input
          id="refresh-interval"
          name="institution.metadata.refreshInterval"
          label="Refresh Interval (days)"
          type="number"
          required
          aria-required="true"
        />
      </div>

      <div className={styles.formSection}>
        <h3 className={styles.sectionTitle}>Scraping Configuration</h3>
        
        <Input
          id="selector-title"
          name="scraping.selectors.title"
          label="Title Selector"
          type="text"
          required
          aria-required="true"
        />

        <Input
          id="selector-description"
          name="scraping.selectors.description"
          label="Description Selector"
          type="text"
          required
          aria-required="true"
        />

        <Input
          id="selector-pagination"
          name="scraping.selectors.pagination"
          label="Pagination Selector"
          type="text"
        />

        <Input
          id="rate-limit"
          name="scraping.rateLimit"
          label="Rate Limit (requests/second)"
          type="number"
          required
          aria-required="true"
        />
      </div>

      {formState.validationErrors.length > 0 && (
        <div 
          className={styles.errorMessages}
          role="alert"
          aria-live="polite"
        >
          {formState.validationErrors.map((error, index) => (
            <p key={index} className={styles.errorMessage}>{error}</p>
          ))}
        </div>
      )}

      <div className={styles.formActions}>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleTestConnection(formValues)}
          disabled={isLoading || formState.isTestingConnection}
          loading={formState.isTestingConnection}
        >
          Test Connection
        </Button>

        <Button
          type="submit"
          variant="primary"
          disabled={isLoading || !formState.isDirty || formState.validationErrors.length > 0}
          loading={isLoading}
        >
          {isEdit ? 'Update' : 'Create'} Configuration
        </Button>

        <Button
          type="button"
          variant="text"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
      </div>
    </Form>
  );
};

export default URLConfigForm;