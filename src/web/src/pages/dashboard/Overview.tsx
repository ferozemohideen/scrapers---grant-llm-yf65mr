/**
 * Dashboard Overview Page
 * 
 * Displays comprehensive system monitoring information including health status,
 * scraper performance, and security metrics. Implements real-time updates and
 * responsive design as specified in the technical requirements.
 * 
 * @version 1.0.0
 */

import React, { useCallback, useMemo } from 'react';
import { Grid } from '@mui/material'; // ^5.0.0
import { useDebounce } from 'use-debounce'; // ^9.0.0

// Internal imports
import DashboardLayout from '../../layouts/DashboardLayout';
import HealthStatus from '../../components/monitoring/HealthStatus';
import ScraperStatus from '../../components/monitoring/ScraperStatus';
import Card from '../../components/common/Card';
import { MonitoringService } from '../../services/monitoring.service';
import { SecurityMetrics, SystemHealth } from '../../interfaces/monitoring.interface';

// Styles
import styles from './Overview.module.css';

/**
 * Props interface for the Overview component
 */
interface OverviewProps {
  className?: string;
}

/**
 * Interface for overview metrics state
 */
interface OverviewMetrics {
  loading: boolean;
  error: Error | null;
  systemHealth: SystemHealth | null;
  securityMetrics: SecurityMetrics | null;
}

/**
 * Custom hook for managing overview page data with enhanced error handling and caching
 */
const useOverviewData = (refreshInterval: number = 30000, retryAttempts: number = 3): OverviewMetrics => {
  const [metrics, setMetrics] = React.useState<OverviewMetrics>({
    loading: true,
    error: null,
    systemHealth: null,
    securityMetrics: null
  });

  // Create memoized monitoring service instance
  const monitoringService = useMemo(() => new MonitoringService(), []);

  // Debounce the refresh to prevent excessive updates
  const [debouncedRefresh] = useDebounce(metrics, 1000);

  // Fetch data with retry mechanism
  const fetchData = useCallback(async (attempt: number = 0) => {
    try {
      const [health, security] = await Promise.all([
        monitoringService.getSystemHealth(),
        monitoringService.getSecurityMetrics('1h', 'high')
      ]);

      setMetrics({
        loading: false,
        error: null,
        systemHealth: health,
        securityMetrics: security
      });
    } catch (error) {
      console.error('Error fetching overview data:', error);
      
      if (attempt < retryAttempts) {
        // Exponential backoff retry
        setTimeout(() => fetchData(attempt + 1), Math.pow(2, attempt) * 1000);
      } else {
        setMetrics(prev => ({
          ...prev,
          loading: false,
          error: error as Error
        }));
      }
    }
  }, [monitoringService, retryAttempts]);

  // Set up data refresh interval
  React.useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(), refreshInterval);

    return () => {
      clearInterval(interval);
    };
  }, [fetchData, refreshInterval]);

  return debouncedRefresh;
};

/**
 * Overview Component
 * Main dashboard overview page displaying system monitoring information
 */
const Overview: React.FC<OverviewProps> = ({ className }) => {
  const { loading, error, systemHealth, securityMetrics } = useOverviewData();

  // Memoized error card renderer
  const renderError = useCallback(() => (
    <Card
      variant="outlined"
      className={styles.overview__error}
      aria-label="Error message"
    >
      <div className="text-error-color p-4">
        <h3 className="text-lg font-medium mb-2">Error Loading Dashboard</h3>
        <p>{error?.message || 'An unexpected error occurred'}</p>
      </div>
    </Card>
  ), [error]);

  // Memoized metrics grid renderer
  const renderMetricsGrid = useCallback(() => (
    <Grid container spacing={3}>
      {/* System Health Status */}
      <Grid item xs={12} lg={8}>
        <HealthStatus
          className={styles.overview__card}
          refreshInterval={30000}
          showComponentStatus={true}
          showSecurityMetrics={true}
        />
      </Grid>

      {/* Scraper Performance */}
      <Grid item xs={12} lg={4}>
        <ScraperStatus
          className={styles.overview__card}
          refreshInterval={30000}
          securityMonitoring={true}
        />
      </Grid>

      {/* Security Metrics */}
      {securityMetrics && (
        <Grid item xs={12}>
          <Card
            className={styles.overview__card}
            variant="outlined"
            header={<h3 className="text-lg font-medium">Security Overview</h3>}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <span className="text-sm text-text-color-light">Failed Logins</span>
                <p className="text-xl font-medium">{securityMetrics.failedLogins}</p>
              </div>
              <div>
                <span className="text-sm text-text-color-light">Active Threats</span>
                <p className="text-xl font-medium">{securityMetrics.activeThreats}</p>
              </div>
              <div>
                <span className="text-sm text-text-color-light">Security Scan</span>
                <p className="text-xl font-medium">
                  {new Date(securityMetrics.lastSecurityScan).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </Card>
        </Grid>
      )}
    </Grid>
  ), [securityMetrics]);

  return (
    <DashboardLayout>
      <div 
        className={`${styles.overview} ${className || ''}`}
        role="main"
        aria-label="Dashboard Overview"
        aria-busy={loading}
      >
        {loading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <span className="text-text-color-light">Loading dashboard data...</span>
          </div>
        ) : error ? (
          renderError()
        ) : (
          renderMetricsGrid()
        )}
      </div>
    </DashboardLayout>
  );
};

// Set display name for debugging
Overview.displayName = 'Overview';

export default React.memo(Overview);