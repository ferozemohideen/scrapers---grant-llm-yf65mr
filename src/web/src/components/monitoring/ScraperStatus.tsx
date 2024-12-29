import React, { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns'; // ^2.30.0
import { debounce } from 'lodash'; // ^4.17.21

import Card from '../common/Card';
import ProgressBar from '../common/ProgressBar';
import { MonitoringService } from '../../services/monitoring.service';

import {
  ScraperMetrics,
  SecurityMetrics,
  Alert,
  AlertSeverity,
  HealthStatus
} from '../../interfaces/monitoring.interface';

/**
 * Alert threshold configuration interface
 */
interface AlertThresholdConfig {
  minSuccessRate: number;
  maxFailedScrapes: number;
  maxRateLimitHits: number;
  maxSecurityIncidents: number;
}

/**
 * Props interface for the ScraperStatus component
 */
interface ScraperStatusProps {
  className?: string;
  refreshInterval?: number;
  securityMonitoring?: boolean;
  alertThresholds?: AlertThresholdConfig;
}

/**
 * Default alert thresholds based on technical specifications
 */
const DEFAULT_ALERT_THRESHOLDS: AlertThresholdConfig = {
  minSuccessRate: 95, // 95%+ successful scraping rate requirement
  maxFailedScrapes: 10,
  maxRateLimitHits: 5,
  maxSecurityIncidents: 0
};

/**
 * Custom hook for managing scraper metrics and alerts
 */
const useScraperMetrics = (
  refreshInterval: number,
  securityMonitoring: boolean,
  alertThresholds: AlertThresholdConfig
) => {
  const [metrics, setMetrics] = useState<ScraperMetrics | null>(null);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const monitoringService = new MonitoringService();

  const fetchMetrics = useCallback(async () => {
    try {
      const [scraperData, securityData] = await Promise.all([
        monitoringService.getScraperMetrics('1h'),
        securityMonitoring ? monitoringService.getSecurityMetrics('1h', 'high') : null
      ]);

      setMetrics(scraperData);
      if (securityData) {
        setSecurityMetrics(securityData);
      }

      // Process alerts based on thresholds
      const newAlerts: Alert[] = [];
      const successRate = (scraperData.successfulScrapes / 
        (scraperData.successfulScrapes + scraperData.failedScrapes)) * 100;

      if (successRate < alertThresholds.minSuccessRate) {
        newAlerts.push({
          alertId: `success-rate-${Date.now()}`,
          severity: AlertSeverity.HIGH,
          message: `Scraping success rate (${successRate.toFixed(1)}%) below threshold`,
          timestamp: new Date(),
          component: 'scraper',
          threshold: alertThresholds.minSuccessRate
        });
      }

      if (securityData?.securityIncidents > alertThresholds.maxSecurityIncidents) {
        newAlerts.push({
          alertId: `security-${Date.now()}`,
          severity: AlertSeverity.CRITICAL,
          message: `Security incidents detected: ${securityData.securityIncidents}`,
          timestamp: new Date(),
          component: 'security',
          threshold: alertThresholds.maxSecurityIncidents
        });
      }

      setAlerts(newAlerts);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [monitoringService, securityMonitoring, alertThresholds]);

  // Debounce fetch function to prevent excessive calls
  const debouncedFetch = debounce(fetchMetrics, 1000);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(debouncedFetch, refreshInterval);

    return () => {
      clearInterval(interval);
      debouncedFetch.cancel();
    };
  }, [debouncedFetch, refreshInterval]);

  return { metrics, securityMetrics, loading, error, alerts };
};

/**
 * ScraperStatus Component
 * Displays real-time scraping metrics, security status, and system health information
 */
const ScraperStatus: React.FC<ScraperStatusProps> = ({
  className,
  refreshInterval = 30000,
  securityMonitoring = true,
  alertThresholds = DEFAULT_ALERT_THRESHOLDS
}) => {
  const { 
    metrics, 
    securityMetrics, 
    loading, 
    error, 
    alerts 
  } = useScraperMetrics(refreshInterval, securityMonitoring, alertThresholds);

  const renderMetrics = (metrics: ScraperMetrics, securityMetrics: SecurityMetrics | null) => {
    const successRate = metrics.successfulScrapes / 
      (metrics.successfulScrapes + metrics.failedScrapes) * 100;

    return (
      <div className="space-y-4">
        {/* Active Scrapers Status */}
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Active Scrapers:</span>
          <span className="text-sm">{metrics.activeScrapers}</span>
        </div>

        {/* Success Rate */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Success Rate:</span>
            <span className="text-sm">{successRate.toFixed(1)}%</span>
          </div>
          <ProgressBar
            progress={successRate}
            variant={successRate >= alertThresholds.minSuccessRate ? 'success' : 'error'}
            size="md"
            animated={true}
          />
        </div>

        {/* Security Status */}
        {securityMetrics && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Security Status:</span>
              <span className={`text-sm ${
                securityMetrics.activeThreats > 0 ? 'text-error-color' : 'text-success-color'
              }`}>
                {securityMetrics.activeThreats > 0 ? 'Threats Detected' : 'Secure'}
              </span>
            </div>
            {securityMetrics.activeThreats > 0 && (
              <ProgressBar
                progress={100}
                variant="error"
                size="sm"
                animated={true}
              />
            )}
          </div>
        )}

        {/* Performance Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-sm font-medium">Average Duration:</span>
            <span className="text-sm ml-2">
              {metrics.averageScrapeDuration.toFixed(1)}s
            </span>
          </div>
          <div>
            <span className="text-sm font-medium">Rate Limits:</span>
            <span className="text-sm ml-2">{metrics.rateLimitHits}</span>
          </div>
        </div>

        {/* Active Alerts */}
        {alerts.length > 0 && (
          <div className="mt-4 p-3 bg-warning-color bg-opacity-10 rounded-md">
            <h4 className="text-sm font-medium mb-2">Active Alerts:</h4>
            {alerts.map(alert => (
              <div 
                key={alert.alertId}
                className="text-sm text-error-color"
              >
                {alert.message}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card
      className={className}
      variant="default"
      header={
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">Scraper Status</h3>
          <span className="text-sm text-text-color-light">
            {loading ? 'Updating...' : `Last updated: ${
              metrics ? format(new Date(), 'HH:mm:ss') : 'N/A'
            }`}
          </span>
        </div>
      }
    >
      {loading && (
        <div className="py-8 text-center text-text-color-light">
          Loading metrics...
        </div>
      )}

      {error && (
        <div className="py-4 px-3 bg-error-color bg-opacity-10 rounded-md text-error-color text-sm">
          Error loading metrics: {error.message}
        </div>
      )}

      {metrics && renderMetrics(metrics, securityMetrics)}
    </Card>
  );
};

export default ScraperStatus;