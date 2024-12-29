import React, { useState, useCallback, useEffect } from 'react';
import { Grid } from '@mui/material'; // ^5.0.0
import useWebSocket from 'react-use-websocket'; // ^4.0.0

import MetricsChart from '../../components/monitoring/MetricsChart';
import PerformanceGraph from '../../components/monitoring/PerformanceGraph';
import ScraperStatus from '../../components/monitoring/ScraperStatus';

import { AlertSeverity } from '../../interfaces/monitoring.interface';

/**
 * Props interface for Analytics component
 */
interface AnalyticsProps {
  refreshInterval?: number;
  securityMetricsEnabled?: boolean;
  accessibilityMode?: boolean;
}

/**
 * Custom hook for managing time range selection
 */
const useTimeRange = (defaultRange: string = '24h') => {
  const [timeRange, setTimeRange] = useState(defaultRange);

  const validateRange = useCallback((range: string): boolean => {
    return ['1h', '24h', '7d', '30d'].includes(range);
  }, []);

  const handleTimeRangeChange = useCallback((range: string) => {
    if (validateRange(range)) {
      setTimeRange(range);
    }
  }, [validateRange]);

  return { timeRange, handleTimeRangeChange };
};

/**
 * Custom hook for real-time metrics updates via WebSocket
 */
const useMetricsWebSocket = (url: string) => {
  const { lastMessage, readyState } = useWebSocket(url, {
    reconnectAttempts: 10,
    reconnectInterval: 3000,
    shouldReconnect: true
  });

  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    if (lastMessage) {
      try {
        const data = JSON.parse(lastMessage.data);
        setMetrics(data);
      } catch (error) {
        console.error('WebSocket message parse error:', error);
      }
    }
  }, [lastMessage]);

  return { metrics, connectionStatus: readyState };
};

/**
 * Analytics Dashboard Component
 * Provides comprehensive system monitoring and analytics visualization
 */
const Analytics: React.FC<AnalyticsProps> = ({
  refreshInterval = 30000,
  securityMetricsEnabled = true,
  accessibilityMode = false
}) => {
  const { timeRange, handleTimeRangeChange } = useTimeRange('24h');
  const { metrics: realtimeMetrics } = useMetricsWebSocket(
    `${process.env.VITE_WS_URL}/metrics`
  );

  // Alert thresholds based on technical specifications
  const performanceThresholds = {
    responseTime: 2000, // 2 second requirement
    cpuUsage: 80,
    memoryUsage: 85,
    errorRate: 0.1 // 0.1% error rate threshold
  };

  const scraperThresholds = {
    minSuccessRate: 95, // 95%+ successful scraping requirement
    maxFailedScrapes: 10,
    maxRateLimitHits: 5,
    maxSecurityIncidents: 0
  };

  // Handle metric alerts
  const handleMetricAlert = useCallback((
    metric: string,
    value: number,
    threshold: number
  ) => {
    console.warn(`Metric Alert: ${metric} exceeded threshold`, {
      value,
      threshold,
      timestamp: new Date().toISOString()
    });
  }, []);

  return (
    <div className="analytics-dashboard p-6" role="main" aria-label="Analytics Dashboard">
      {/* Time Range Controls */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-2xl font-medium">System Analytics</h1>
        <div className="flex gap-4">
          {['1h', '24h', '7d', '30d'].map((range) => (
            <button
              key={range}
              onClick={() => handleTimeRangeChange(range)}
              className={`px-4 py-2 rounded-md ${
                timeRange === range
                  ? 'bg-primary-color text-white'
                  : 'bg-background-color-dark'
              }`}
              aria-pressed={timeRange === range}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <Grid container spacing={3}>
        {/* Performance Metrics */}
        <Grid item xs={12} lg={8}>
          <PerformanceGraph
            timeRange={timeRange}
            refreshInterval={refreshInterval}
            height={400}
            thresholds={performanceThresholds}
            onMetricAlert={handleMetricAlert}
          />
        </Grid>

        {/* Scraper Status */}
        <Grid item xs={12} lg={4}>
          <ScraperStatus
            refreshInterval={refreshInterval}
            securityMonitoring={securityMetricsEnabled}
            alertThresholds={scraperThresholds}
          />
        </Grid>

        {/* Security Metrics */}
        {securityMetricsEnabled && (
          <Grid item xs={12}>
            <MetricsChart
              type="security"
              timeRange={timeRange}
              showThresholds={true}
              alertConfig={{
                warning: 3,
                critical: 5,
                enabled: true
              }}
              refreshInterval={refreshInterval}
              aria-label="Security metrics chart"
            />
          </Grid>
        )}

        {/* Data Coverage Metrics */}
        <Grid item xs={12} md={6}>
          <MetricsChart
            type="scraper"
            timeRange={timeRange}
            showThresholds={true}
            alertConfig={{
              warning: 90,
              critical: 85,
              enabled: true
            }}
            refreshInterval={refreshInterval}
            aria-label="Data coverage metrics"
          />
        </Grid>

        {/* System Resources */}
        <Grid item xs={12} md={6}>
          <MetricsChart
            type="resources"
            timeRange={timeRange}
            showThresholds={true}
            alertConfig={{
              warning: 80,
              critical: 90,
              enabled: true
            }}
            refreshInterval={refreshInterval}
            aria-label="System resource metrics"
          />
        </Grid>
      </Grid>
    </div>
  );
};

export default React.memo(Analytics);
export type { AnalyticsProps };