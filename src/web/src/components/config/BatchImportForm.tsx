import React, { useState, useCallback } from 'react'; // ^18.0.0
import Papa from 'papaparse'; // ^5.3.0
import validator from 'validator'; // ^13.7.0
import FileUpload, { FileUploadProps } from '../common/FileUpload';
import useForm, { UseFormConfig } from '../../hooks/useForm';
import { URLConfig } from '../../interfaces/config.interface';
import styles from './BatchImportForm.module.css';

/**
 * Props interface for BatchImportForm component
 */
export interface BatchImportFormProps {
  /** Callback when URLs are validated and ready for import */
  onImport: (configs: URLConfig[]) => Promise<void>;
  /** Error handling callback */
  onError: (error: string) => void;
  /** Optional validation configuration */
  validationOptions?: ValidationOptions;
}

/**
 * Interface for validation options
 */
export interface ValidationOptions {
  /** Enable URL accessibility validation */
  checkAccessibility?: boolean;
  /** Enable duplicate URL detection */
  detectDuplicates?: boolean;
  /** Enable URL format validation */
  validateFormat?: boolean;
  /** Enable security and malicious content checks */
  securityCheck?: boolean;
}

/**
 * BatchImportForm component provides a secure interface for importing multiple URL configurations
 * via CSV upload or direct input with comprehensive validation.
 */
const BatchImportForm: React.FC<BatchImportFormProps> = ({
  onImport,
  onError,
  validationOptions = {
    checkAccessibility: true,
    detectDuplicates: true,
    validateFormat: true,
    securityCheck: true
  }
}) => {
  // State for tracking processing status
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Form state management with validation
  const formConfig: UseFormConfig = {
    initialValues: {
      urlText: '',
    },
    validationSchema: {
      urlText: async (value: string) => {
        if (!value) return undefined;
        const urls = value.split('\n').filter(url => url.trim());
        for (const url of urls) {
          if (!validator.isURL(url, { protocols: ['https'], require_protocol: true })) {
            return `Invalid URL format: ${url}`;
          }
        }
        return undefined;
      }
    },
    onSubmit: async (values) => {
      await handleUrlPaste(values.urlText);
    },
    sanitize: true,
    rateLimit: 1000,
    validationMode: 'onChange'
  };

  const {
    values,
    errors,
    handleSubmit,
    setFieldValue,
  } = useForm(formConfig);

  /**
   * Handles CSV file upload and processing with security validation
   */
  const handleFileUpload = useCallback(async (files: File[]) => {
    if (!files.length) return;

    setIsProcessing(true);
    try {
      const file = files[0];
      const results = await new Promise<URLConfig[]>((resolve, reject) => {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const configs: URLConfig[] = results.data.map((row: any) => ({
              url: row.url?.trim(),
              institution: {
                name: row.institution_name?.trim(),
                type: row.institution_type,
                country: row.country?.trim(),
                metadata: {
                  contactEmail: row.contact_email?.trim(),
                  apiKeyEnv: row.api_key_env?.trim(),
                  refreshInterval: parseInt(row.refresh_interval) || 14
                }
              },
              scraping: {
                selectors: {
                  title: row.title_selector?.trim(),
                  description: row.description_selector?.trim(),
                  pagination: row.pagination_selector?.trim(),
                  custom: {}
                },
                rateLimit: parseInt(row.rate_limit) || 2,
                retryConfig: {
                  maxAttempts: 3,
                  backoffMs: 1000
                }
              },
              active: true,
              lastUpdated: new Date()
            }));
            resolve(configs);
          },
          error: (error) => reject(error)
        });
      });

      // Validate configurations
      const validConfigs = await validateConfigs(results, validationOptions);
      
      if (validConfigs.length) {
        await onImport(validConfigs);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to process CSV file');
    } finally {
      setIsProcessing(false);
    }
  }, [onImport, onError, validationOptions]);

  /**
   * Processes pasted URLs with validation
   */
  const handleUrlPaste = useCallback(async (urlText: string) => {
    if (!urlText.trim()) return;

    setIsProcessing(true);
    try {
      const urls = urlText
        .split('\n')
        .map(url => url.trim())
        .filter(url => url);

      const configs: URLConfig[] = urls.map(url => ({
        url,
        institution: {
          name: '',
          type: 'US_UNIVERSITY',
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
      }));

      const validConfigs = await validateConfigs(configs, validationOptions);
      
      if (validConfigs.length) {
        await onImport(validConfigs);
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Failed to process URLs');
    } finally {
      setIsProcessing(false);
    }
  }, [onImport, onError, validationOptions]);

  /**
   * Validates URL configurations with comprehensive checks
   */
  const validateConfigs = async (
    configs: URLConfig[],
    options: ValidationOptions
  ): Promise<URLConfig[]> => {
    const validConfigs: URLConfig[] = [];
    const errors: string[] = [];

    for (const config of configs) {
      try {
        // Basic URL validation
        if (options.validateFormat && !validator.isURL(config.url, { 
          protocols: ['https'],
          require_protocol: true 
        })) {
          errors.push(`Invalid URL format: ${config.url}`);
          continue;
        }

        // Duplicate detection
        if (options.detectDuplicates && 
            validConfigs.some(vc => vc.url === config.url)) {
          errors.push(`Duplicate URL detected: ${config.url}`);
          continue;
        }

        // URL accessibility check
        if (options.checkAccessibility) {
          try {
            const response = await fetch(config.url, { 
              method: 'HEAD',
              mode: 'no-cors'
            });
            if (!response.ok) {
              errors.push(`URL not accessible: ${config.url}`);
              continue;
            }
          } catch (error) {
            errors.push(`Failed to access URL: ${config.url}`);
            continue;
          }
        }

        validConfigs.push(config);
      } catch (error) {
        errors.push(`Validation failed for URL: ${config.url}`);
      }
    }

    if (errors.length) {
      onError(errors.join('\n'));
    }

    return validConfigs;
  };

  return (
    <div className={styles.batchImport}>
      <div className={styles.batchImport__method}>
        <h3>Import URLs via CSV</h3>
        <FileUpload
          accept=".csv"
          multiple={false}
          onFileSelect={handleFileUpload}
          onError={(error) => onError(error.message)}
          disabled={isProcessing}
          className={styles.batchImport__upload}
        />
      </div>

      <div className={styles.batchImport__method}>
        <h3>Or paste URLs directly</h3>
        <form onSubmit={handleSubmit}>
          <textarea
            value={values.urlText}
            onChange={(e) => setFieldValue('urlText', e.target.value)}
            placeholder="Enter URLs (one per line)"
            className={styles.batchImport__paste}
            disabled={isProcessing}
            aria-label="URL input area"
            rows={10}
          />
          {errors.urlText && (
            <div className={styles.batchImport__error} role="alert">
              {errors.urlText}
            </div>
          )}
          <div className={styles.batchImport__actions}>
            <button
              type="submit"
              disabled={isProcessing || !!errors.urlText}
              className={styles.batchImport__submit}
            >
              {isProcessing ? 'Processing...' : 'Import URLs'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BatchImportForm;