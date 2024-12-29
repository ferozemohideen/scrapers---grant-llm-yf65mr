/**
 * URL Testing Page Component
 * 
 * Implements comprehensive URL configuration testing with security controls,
 * accessibility features, and performance monitoring.
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import URLTestResults from '../../components/config/URLTestResults';
import useAuth from '../../hooks/useAuth';
import useToast from '../../hooks/useToast';
import ConfigService from '../../services/config.service';
import { URLConfig } from '../../interfaces/config.interface';
import { USER_ROLES } from '../../constants/auth.constants';
import { STATUS } from '../../constants/ui.constants';

// Enhanced interface for test results with performance metrics
interface TestResult {
  urlId: string;
  institution: string;
  url: string;
  status: typeof STATUS[keyof typeof STATUS];
  errorMessage?: string;
  errorCode?: string;
  retryCount: number;
  timestamp: string;
  performanceMetrics: {
    responseTime: number;
    selectorValidation: number;
    totalDuration: number;
  };
}

/**
 * URL Test Page Component
 * Provides secure URL testing functionality with comprehensive error handling
 * and accessibility features.
 */
const URLTest: React.FC = () => {
  // State management
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [retryCount, setRetryCount] = useState<Record<string, number>>({});

  // Hooks
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();

  // Security validation for page access
  useEffect(() => {
    if (!user || !hasPermission('manage:urls')) {
      showToast({
        type: 'error',
        message: 'Unauthorized access',
        duration: 5000
      });
      navigate('/dashboard');
    }
  }, [user, hasPermission, navigate, showToast]);

  /**
   * Loads and tests URL configurations with performance monitoring
   */
  const loadAndTestURLs = useCallback(async () => {
    if (!hasPermission('manage:urls')) return;

    setLoading(true);
    try {
      // Fetch URL configurations
      const response = await ConfigService.getURLConfigs(
        { active: true },
        { page: 1, limit: 100 }
      );

      // Initialize test results
      const initialResults: TestResult[] = response.data.map(config => ({
        urlId: config.url,
        institution: config.institution.name,
        url: config.url,
        status: STATUS.LOADING,
        retryCount: 0,
        timestamp: new Date().toISOString(),
        performanceMetrics: {
          responseTime: 0,
          selectorValidation: 0,
          totalDuration: 0
        }
      }));

      setResults(initialResults);

      // Test URLs in parallel with rate limiting
      const testPromises = response.data.map(async (config) => {
        const startTime = performance.now();
        try {
          const testResult = await ConfigService.testURLConfig(config);
          
          return {
            urlId: config.url,
            institution: config.institution.name,
            url: config.url,
            status: testResult.accessible ? STATUS.SUCCESS : STATUS.ERROR,
            errorMessage: testResult.errors?.join(', '),
            retryCount: 0,
            timestamp: new Date().toISOString(),
            performanceMetrics: {
              responseTime: testResult.responseTime,
              selectorValidation: performance.now() - startTime,
              totalDuration: performance.now() - startTime
            }
          };
        } catch (error) {
          return {
            urlId: config.url,
            institution: config.institution.name,
            url: config.url,
            status: STATUS.ERROR,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
            retryCount: 0,
            timestamp: new Date().toISOString(),
            performanceMetrics: {
              responseTime: 0,
              selectorValidation: 0,
              totalDuration: performance.now() - startTime
            }
          };
        }
      });

      const completedResults = await Promise.all(testPromises);
      setResults(completedResults);

      // Show summary toast
      const failedCount = completedResults.filter(r => r.status === STATUS.ERROR).length;
      if (failedCount > 0) {
        showToast({
          type: 'warning',
          message: `Testing complete. ${failedCount} URLs require attention.`,
          duration: 5000
        });
      } else {
        showToast({
          type: 'success',
          message: 'All URLs tested successfully',
          duration: 3000
        });
      }
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to load URL configurations',
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  }, [hasPermission, showToast]);

  // Load URLs on component mount
  useEffect(() => {
    loadAndTestURLs();
  }, [loadAndTestURLs]);

  /**
   * Handles retrying failed URL tests with exponential backoff
   */
  const handleRetry = useCallback(async (urlId: string) => {
    if (!hasPermission('manage:urls')) return;

    const currentRetries = retryCount[urlId] || 0;
    const backoffDelay = Math.min(1000 * Math.pow(2, currentRetries), 10000);

    setRetryCount(prev => ({
      ...prev,
      [urlId]: currentRetries + 1
    }));

    try {
      // Update status to retrying
      setResults(prev => 
        prev.map(result => 
          result.urlId === urlId 
            ? { ...result, status: STATUS.LOADING }
            : result
        )
      );

      // Wait for backoff delay
      await new Promise(resolve => setTimeout(resolve, backoffDelay));

      // Retry test
      const config = results.find(r => r.urlId === urlId);
      if (!config) return;

      const startTime = performance.now();
      const testResult = await ConfigService.testURLConfig({
        url: config.url,
        institution: { name: config.institution } as any,
        active: true
      } as URLConfig);

      // Update results with retry outcome
      setResults(prev =>
        prev.map(result =>
          result.urlId === urlId
            ? {
                ...result,
                status: testResult.accessible ? STATUS.SUCCESS : STATUS.ERROR,
                errorMessage: testResult.errors?.join(', '),
                retryCount: currentRetries + 1,
                timestamp: new Date().toISOString(),
                performanceMetrics: {
                  responseTime: testResult.responseTime,
                  selectorValidation: performance.now() - startTime,
                  totalDuration: performance.now() - startTime
                }
              }
            : result
        )
      );

      showToast({
        type: testResult.accessible ? 'success' : 'error',
        message: testResult.accessible 
          ? 'URL test successful' 
          : `Test failed: ${testResult.errors?.join(', ')}`,
        duration: 3000
      });
    } catch (error) {
      showToast({
        type: 'error',
        message: 'Failed to retry URL test',
        duration: 5000
      });
    }
  }, [results, retryCount, hasPermission, showToast]);

  /**
   * Handles navigation to URL configuration edit page
   */
  const handleEdit = useCallback((urlId: string) => {
    if (!hasPermission('manage:urls')) {
      showToast({
        type: 'error',
        message: 'Unauthorized to edit configurations',
        duration: 3000
      });
      return;
    }
    navigate(`/config/url/${urlId}`);
  }, [navigate, hasPermission, showToast]);

  return (
    <DashboardLayout
      requiredRole={USER_ROLES.MANAGER}
      className="url-test-page"
    >
      <URLTestResults
        results={results}
        onRetry={handleRetry}
        onEdit={handleEdit}
        loading={loading}
        retryCount={retryCount}
      />
    </DashboardLayout>
  );
};

// Add display name for debugging
URLTest.displayName = 'URLTest';

export default URLTest;