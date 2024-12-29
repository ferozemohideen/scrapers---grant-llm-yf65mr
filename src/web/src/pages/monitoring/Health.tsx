import React, { useState, useCallback, useEffect } from 'react';
import { Grid, useTheme } from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal imports
import DashboardLayout from '../../layouts/DashboardLayout';
import HealthStatus from '../../components/monitoring/HealthStatus';
import MetricsChart from '../../components/monitoring/MetricsChart';
import { AlertSeverity } from '../../interfaces/monitoring.interface';

/**
 * Props interface for the Health page component
 */
interface IHealthPageProps {
  className?: string;
  refreshInterval?: number;
}

/**
 * Health Monitoring Dashboard Page
 * Displays comprehensive system health information including real-time status,
 * performance metrics, and system uptime with enhanced error handling.
 */
const HealthPage: React.FC<IHealthPageProps> = React.memo(({
  className,
  refreshInterval = 30000
}) => {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  // Alert threshold configuration
  const [alertThresholds] = useState({
    performance: {
      warning: 1500, // 1.5s response time warning
      critical: 2000, // 2s response time critical
      enabled: true
    },
    resources: {
      warning: 70, // 70% utilization warning
      critical: 85, // 85% utilization critical
      enabled: true
    }
  });

  // Handle alert threshold changes
  const handleAlertThresholdChange = useCallback((type: string, thresholds: any) => {
    console.log(`Alert thresholds updated for ${type}:`, thresholds);
    // Implementation for threshold updates would go here
  }, []);

  // Handle time range changes for metrics
  const handleTimeRangeChange = useCallback((range: '1h' | '24h' | '7d' | '30d') => {
    setTimeRange(range);
  }, []);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <div 
      className="p-4 m-4 border border-error-color rounded-md"
      role="alert"
      aria-live="assertive"
    >
      <h3 className="text-xl font-medium text-error-color mb-2">
        Error Loading Health Dashboard
      </h3>
      <p className="text-text-color-light mb-4">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="px-4 py-2 bg-primary-color text-white rounded-md"
      >
        Retry
      </button>
    </div>
  );

  return (
    <DashboardLayout>
      <div 
        className={`health-dashboard p-4 ${className || ''}`}
        role="main"
        aria-label="System Health Dashboard"
      >
        <ErrorBoundary FallbackComponent={ErrorFallback}>
          {/* Overall System Health Status */}
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <HealthStatus
                refreshInterval={refreshInterval}
                showComponentStatus={true}
                showSecurityMetrics={true}
                onAlertClick={(alert) => {
                  console.log('Alert clicked:', alert);
                  // Implementation for alert handling would go here
                }}
              />
            </Grid>

            {/* Performance Metrics */}
            <Grid item xs={12} md={6}>
              <MetricsChart
                type="performance"
                timeRange={timeRange}
                showThresholds={true}
                alertConfig={alertThresholds.performance}
                refreshInterval={refreshInterval}
                aria-label="System performance metrics"
              />
            </Grid>

            {/* Resource Utilization */}
            <Grid item xs={12} md={6}>
              <MetricsChart
                type="resources"
                timeRange={timeRange}
                showThresholds={true}
                alertConfig={alertThresholds.resources}
                refreshInterval={refreshInterval}
                aria-label="Resource utilization metrics"
              />
            </Grid>

            {/* Scraper Performance */}
            <Grid item xs={12} md={6}>
              <MetricsChart
                type="scraper"
                timeRange={timeRange}
                showThresholds={false}
                refreshInterval={refreshInterval}
                aria-label="Scraper performance metrics"
              />
            </Grid>

            {/* Security Metrics */}
            <Grid item xs={12} md={6}>
              <MetricsChart
                type="security"
                timeRange={timeRange}
                showThresholds={true}
                refreshInterval={refreshInterval}
                aria-label="Security metrics"
              />
            </Grid>
          </Grid>
        </ErrorBoundary>
      </div>
    </DashboardLayout>
  );
});

// Set display name for debugging
HealthPage.displayName = 'HealthPage';

export default HealthPage;