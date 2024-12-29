/**
 * Performance Monitoring Page Component
 * Version: 1.0.0
 * 
 * Implements comprehensive system performance monitoring with enhanced security metrics,
 * real-time updates, and configurable alert thresholds as specified in the technical requirements.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import DashboardLayout from '../../layouts/DashboardLayout';
import PerformanceGraph from '../../components/monitoring/PerformanceGraph';
import MetricsChart from '../../components/monitoring/MetricsChart';
import { AlertSeverity } from '../../interfaces/monitoring.interface';
import { USER_ROLES } from '../../constants/auth.constants';
import styles from './Performance.module.css';

// Time range options for metrics display
const TIME_RANGES = ['1h', '24h', '7d', '30d'] as const;
type TimeRange = typeof TIME_RANGES[number];

// Default alert thresholds based on technical specifications
const DEFAULT_ALERT_THRESHOLDS = [
  {
    metric: 'responseTime',
    value: 2000, // 2 second response time requirement
    severity: AlertSeverity.HIGH
  },
  {
    metric: 'concurrentUsers',
    value: 1000, // 1000+ concurrent users support
    severity: AlertSeverity.MEDIUM
  },
  {
    metric: 'errorRate',
    value: 0.1, // 0.1% error rate threshold
    severity: AlertSeverity.HIGH
  }
];

/**
 * Custom hook for managing performance monitoring state
 */
const usePerformanceMonitoring = () => {
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [alertThresholds, setAlertThresholds] = useState(DEFAULT_ALERT_THRESHOLDS);
  const [securityMetrics, setSecurityMetrics] = useState({
    apiErrors: 0,
    authFailures: 0,
    rateLimitViolations: 0
  });

  // Calculate refresh interval based on time range
  const refreshInterval = useMemo(() => {
    switch (timeRange) {
      case '1h': return 10000;  // 10 seconds
      case '24h': return 30000; // 30 seconds
      case '7d': return 300000; // 5 minutes
      case '30d': return 900000; // 15 minutes
      default: return 30000;
    }
  }, [timeRange]);

  // Handle metric alerts
  const handleMetricAlert = useCallback((metric: string, value: number, threshold: number) => {
    console.warn(`Performance Alert: ${metric} exceeded threshold (${value} > ${threshold})`);
    // Additional alert handling logic could be added here
  }, []);

  return {
    timeRange,
    setTimeRange,
    refreshInterval,
    alertThresholds,
    securityMetrics,
    handleMetricAlert
  };
};

/**
 * Performance Monitoring Page Component
 */
const Performance: React.FC = () => {
  const {
    timeRange,
    setTimeRange,
    refreshInterval,
    alertThresholds,
    securityMetrics,
    handleMetricAlert
  } = usePerformanceMonitoring();

  return (
    <DashboardLayout
      requiredRole={USER_ROLES.ADMIN}
      className={styles.performance}
    >
      {/* Page Header */}
      <div className={styles.performance__header}>
        <h1>System Performance Monitoring</h1>
        <div className={styles.performance__timeRange}>
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`${styles.timeRangeButton} ${timeRange === range ? styles.active : ''}`}
              aria-pressed={timeRange === range}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Performance Metrics Grid */}
      <div className={styles.performance__grid}>
        {/* Response Time Performance */}
        <div className={styles.performance__chart}>
          <PerformanceGraph
            timeRange={timeRange}
            refreshInterval={refreshInterval}
            alertThresholds={alertThresholds}
            onMetricAlert={handleMetricAlert}
          />
        </div>

        {/* Resource Utilization */}
        <div className={styles.performance__chart}>
          <MetricsChart
            type="resources"
            timeRange={timeRange}
            showThresholds
            alertConfig={{
              warning: 70,
              critical: 85,
              enabled: true
            }}
            refreshInterval={refreshInterval}
            aria-label="Resource utilization metrics"
          />
        </div>

        {/* Security Monitoring */}
        <div className={styles.performance__security}>
          <MetricsChart
            type="security"
            timeRange={timeRange}
            showThresholds
            alertConfig={{
              warning: 5,
              critical: 10,
              enabled: true
            }}
            refreshInterval={refreshInterval}
            aria-label="Security metrics"
          />
        </div>

        {/* Concurrent Users */}
        <div className={styles.performance__chart}>
          <MetricsChart
            type="performance"
            timeRange={timeRange}
            showThresholds
            alertConfig={{
              warning: 800,
              critical: 1000,
              enabled: true
            }}
            refreshInterval={refreshInterval}
            aria-label="Concurrent users metrics"
          />
        </div>
      </div>

      {/* Active Alerts Section */}
      <div className={styles.performance__alerts}>
        <h2>Active Alerts</h2>
        {alertThresholds.map((threshold, index) => (
          <div
            key={index}
            className={styles.alertItem}
            role="alert"
            aria-live="polite"
          >
            <span className={styles[`severity_${threshold.severity.toLowerCase()}`]}>
              {threshold.severity}
            </span>
            <span>{threshold.metric}: {threshold.value}</span>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
};

export default React.memo(Performance);