/**
 * BatchImport Page Component
 * 
 * Provides a secure and validated batch URL import interface with comprehensive
 * validation, security checks, and user feedback mechanisms.
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/common/Layout';
import BatchImportForm from '../../components/config/BatchImportForm';
import ConfigService from '../../services/config.service';
import useToast from '../../hooks/useToast';
import useAuth from '../../hooks/useAuth';
import { URLConfig } from '../../interfaces/config.interface';
import { CONFIG_ROUTES } from '../../constants/routes.constants';
import styles from './BatchImport.module.css';

/**
 * BatchImport page component with enhanced security and validation
 */
const BatchImport: React.FC = () => {
  // Hooks initialization
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState<{
    total: number;
    processed: number;
    successful: number;
    failed: number;
  }>({
    total: 0,
    processed: 0,
    successful: 0,
    failed: 0,
  });

  /**
   * Handles the batch import process with comprehensive validation and error handling
   */
  const handleImport = useCallback(async (configs: URLConfig[]) => {
    if (!hasPermission('manage:urls')) {
      showToast({
        type: 'error',
        message: 'Insufficient permissions to import URLs',
      });
      return;
    }

    setIsProcessing(true);
    setProgress({
      total: configs.length,
      processed: 0,
      successful: 0,
      failed: 0,
    });

    try {
      const importOptions = {
        validateUrls: true,
        checkDuplicates: true,
        batchSize: 10,
      };

      const result = await ConfigService.importURLConfigs(configs, importOptions);

      // Update progress and show results
      setProgress({
        total: result.metrics.totalProcessed,
        processed: result.metrics.totalProcessed,
        successful: result.metrics.successCount,
        failed: result.metrics.failureCount,
      });

      // Show appropriate toast notifications
      if (result.successful.length > 0) {
        showToast({
          type: 'success',
          message: `Successfully imported ${result.successful.length} URLs`,
        });
      }

      if (result.failed.length > 0) {
        showToast({
          type: 'error',
          message: `Failed to import ${result.failed.length} URLs. Check the error log for details.`,
          duration: 5000,
        });
      }

      if (result.duplicates.length > 0) {
        showToast({
          type: 'warning',
          message: `${result.duplicates.length} duplicate URLs were skipped`,
          duration: 4000,
        });
      }

      // Navigate to URL configuration page on success
      if (result.successful.length > 0) {
        setTimeout(() => {
          navigate(CONFIG_ROUTES.URL_CONFIG);
        }, 2000);
      }
    } catch (error) {
      showToast({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to import URLs',
        duration: 5000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [hasPermission, navigate, showToast]);

  /**
   * Handles import errors with detailed feedback
   */
  const handleError = useCallback((error: string) => {
    showToast({
      type: 'error',
      message: error,
      duration: 5000,
    });
  }, [showToast]);

  return (
    <Layout
      className={styles.batchImport}
      requiredRole="manager"
    >
      <div className={styles.batchImport__header}>
        <h1>Batch URL Import</h1>
        <p className={styles.batchImport__description}>
          Import multiple URL configurations via CSV file or direct input.
          All URLs will be validated before import.
        </p>
      </div>

      {isProcessing && progress.total > 0 && (
        <div className={styles.batchImport__progress}>
          <h3>Import Progress</h3>
          <div className={styles.batchImport__progressStats}>
            <span>Processed: {progress.processed}/{progress.total}</span>
            <span>Successful: {progress.successful}</span>
            <span>Failed: {progress.failed}</span>
          </div>
        </div>
      )}

      <BatchImportForm
        onImport={handleImport}
        onError={handleError}
        validationOptions={{
          checkAccessibility: true,
          detectDuplicates: true,
          validateFormat: true,
          securityCheck: true,
        }}
      />
    </Layout>
  );
};

export default BatchImport;