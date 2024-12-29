/**
 * @fileoverview Institution configuration page component providing comprehensive interface
 * for managing institution details with enhanced validation, security, and accessibility.
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import debounce from 'lodash/debounce';

import InstitutionForm, { 
  InstitutionFormProps, 
  InstitutionValidationRules 
} from '../../components/config/InstitutionForm';
import ConfigService from '../../services/config.service';
import useToast from '../../hooks/useToast';
import { InstitutionConfig } from '../../interfaces/config.interface';

/**
 * Props interface for InstitutionConfig page component
 */
interface InstitutionConfigPageProps {
  onSave?: (config: InstitutionConfig) => Promise<void>;
  onError?: (error: Error) => void;
  validationRules?: InstitutionValidationRules;
}

/**
 * Institution configuration page component with comprehensive validation and accessibility
 */
const InstitutionConfigPage: React.FC<InstitutionConfigPageProps> = ({
  onSave,
  onError,
  validationRules
}) => {
  // State management
  const [institution, setInstitution] = useState<InstitutionConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Hooks
  const { id } = useParams<{ id: string }>();
  const { showToast } = useToast();

  /**
   * Fetches institution configuration with error handling
   */
  const fetchInstitutionConfig = useCallback(async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const response = await ConfigService.getInstitutionConfig(id);
      setInstitution(response.data);
    } catch (error) {
      console.error('Failed to fetch institution config:', error);
      showToast({
        type: 'error',
        message: 'Failed to load institution configuration',
        duration: 5000
      });
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  }, [id, showToast, onError]);

  /**
   * Debounced validation handler for form updates
   */
  const validateInstitution = useCallback(
    debounce(async (config: InstitutionConfig) => {
      try {
        await ConfigService.validateInstitutionConfig(config);
      } catch (error) {
        showToast({
          type: 'warning',
          message: 'Configuration validation failed',
          duration: 3000
        });
      }
    }, 500),
    []
  );

  /**
   * Handles form value changes with validation
   */
  const handleFormChange = useCallback((values: InstitutionConfig) => {
    setInstitution(values);
    setIsDirty(true);
    validateInstitution(values);
  }, [validateInstitution]);

  /**
   * Handles form submission with comprehensive error handling
   */
  const handleSubmit = useCallback(async (values: InstitutionConfig) => {
    try {
      setIsSaving(true);

      // Validate before saving
      await ConfigService.validateInstitutionConfig(values);

      // Update configuration
      await ConfigService.updateInstitutionConfig(id!, values);

      setIsDirty(false);
      showToast({
        type: 'success',
        message: 'Institution configuration saved successfully',
        duration: 3000
      });

      onSave?.(values);
    } catch (error) {
      console.error('Failed to save institution config:', error);
      showToast({
        type: 'error',
        message: 'Failed to save institution configuration',
        duration: 5000
      });
      onError?.(error as Error);
    } finally {
      setIsSaving(false);
    }
  }, [id, showToast, onSave, onError]);

  // Load initial data
  useEffect(() => {
    fetchInstitutionConfig();
  }, [fetchInstitutionConfig]);

  // Set up beforeunload handler for unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  if (isLoading) {
    return (
      <div 
        className="institution-config__loading"
        role="status"
        aria-busy="true"
        aria-label="Loading institution configuration"
      >
        <span className="loading-spinner" aria-hidden="true" />
        Loading...
      </div>
    );
  }

  if (!institution) {
    return (
      <div 
        className="institution-config__error"
        role="alert"
        aria-live="polite"
      >
        Institution configuration not found
      </div>
    );
  }

  return (
    <div className="institution-config">
      <header className="institution-config__header">
        <h1>Institution Configuration</h1>
        {isDirty && (
          <span className="unsaved-indicator" role="status">
            Unsaved changes
          </span>
        )}
      </header>

      <main className="institution-config__content">
        <InstitutionForm
          initialValues={institution}
          onSubmit={handleSubmit}
          onChange={handleFormChange}
          isLoading={isSaving}
          isDirty={isDirty}
          onDirtyChange={setIsDirty}
          validationRules={validationRules}
        />
      </main>
    </div>
  );
};

export default InstitutionConfigPage;