import React, { useEffect, useState, useCallback } from 'react';
import classnames from 'classnames'; // ^2.3.0
import Card from '../common/Card';
import { 
  SystemHealth, 
  HealthStatus as HealthStatusEnum 
} from '../../interfaces/monitoring.interface';
import { MonitoringService } from '../../services/monitoring.service';

/**
 * Props interface for the HealthStatus component
 */
interface HealthStatusProps {
  /** Additional CSS classes */
  className?: string;
  /** Refresh interval in milliseconds */
  refreshInterval?: number;
  /** Toggle component-level status display */
  showComponentStatus?: boolean;
  /** Toggle security metrics display */
  showSecurityMetrics?: boolean;
  /** Handler for security alert interactions */
  onAlertClick?: (alert: SecurityAlert) => void;
}

/**
 * Custom hook for managing health status data and refresh logic
 */
const useHealthStatus = (refreshInterval: number = 30000) => {
  const [healthData, setHealthData] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const monitoringService = new MonitoringService();

  const fetchHealthData = useCallback(async () => {
    try {
      const data = await monitoringService.getSystemHealth();
      setHealthData(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch health status');
      console.error('Health status fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchHealthData, refreshInterval]);

  return { healthData, loading, error };
};

/**
 * Formats response time in milliseconds to readable string
 */
const formatResponseTime = (responseTime: number): string => {
  if (responseTime < 1000) {
    return `${responseTime}ms`;
  }
  return `${(responseTime / 1000).toFixed(2)}s`;
};

/**
 * Determines CSS class based on alert severity
 */
const getAlertSeverityClass = (severity: string): string => {
  const severityClasses = {
    CRITICAL: 'bg-error-color text-white',
    HIGH: 'bg-warning-color text-black',
    MEDIUM: 'bg-primary-color-light text-white',
    LOW: 'bg-secondary-color text-white'
  };
  return severityClasses[severity] || severityClasses.LOW;
};

/**
 * HealthStatus Component
 * Displays comprehensive system health information including uptime,
 * response time, component status, and security metrics
 */
const HealthStatus: React.FC<HealthStatusProps> = ({
  className,
  refreshInterval = 30000,
  showComponentStatus = true,
  showSecurityMetrics = true,
  onAlertClick
}) => {
  const { healthData, loading, error } = useHealthStatus(refreshInterval);

  const getStatusColor = (status: HealthStatusEnum): string => {
    const statusColors = {
      [HealthStatusEnum.HEALTHY]: 'text-success-color',
      [HealthStatusEnum.DEGRADED]: 'text-warning-color',
      [HealthStatusEnum.UNHEALTHY]: 'text-error-color'
    };
    return statusColors[status] || 'text-secondary-color';
  };

  const formatUptime = (uptime: number): string => {
    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <Card className={classnames('animate-pulse', className)}>
        <div className="h-32 flex items-center justify-center">
          <span className="text-text-color-light">Loading health status...</span>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={classnames('bg-error-color bg-opacity-10', className)}>
        <div className="p-4 text-error-color">{error}</div>
      </Card>
    );
  }

  if (!healthData) return null;

  return (
    <Card
      className={classnames('health-status', className)}
      variant="outlined"
      data-testid="health-status"
    >
      {/* Overall Status Header */}
      <div className="flex items-center justify-between p-4 border-b border-border-color">
        <div className="flex items-center">
          <div className={classnames('text-xl font-medium', getStatusColor(healthData.status))}>
            System Status: {healthData.status}
          </div>
          <div className="ml-4 text-text-color-light">
            Last updated: {new Date(healthData.lastCheck).toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-4 p-4 border-b border-border-color">
        <div className="text-center">
          <div className="text-sm text-text-color-light">Uptime</div>
          <div className="text-xl font-medium">{formatUptime(healthData.uptime)}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-text-color-light">Response Time</div>
          <div className="text-xl font-medium">{formatResponseTime(healthData.responseTime)}</div>
        </div>
        <div className="text-center">
          <div className="text-sm text-text-color-light">Active Alerts</div>
          <div className="text-xl font-medium">{healthData.securityAlerts.length}</div>
        </div>
      </div>

      {/* Component Status */}
      {showComponentStatus && healthData.componentStatus && (
        <div className="p-4 border-b border-border-color">
          <h3 className="text-sm font-medium mb-3">Component Status</h3>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(healthData.componentStatus).map(([component, status]) => (
              <div 
                key={component}
                className="flex items-center justify-between p-2 bg-background-color-dark rounded"
              >
                <span className="text-sm">{component}</span>
                <span className={classnames('text-sm font-medium', getStatusColor(status))}>
                  {status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Alerts */}
      {showSecurityMetrics && healthData.securityAlerts.length > 0 && (
        <div className="p-4">
          <h3 className="text-sm font-medium mb-3">Security Alerts</h3>
          <div className="space-y-2">
            {healthData.securityAlerts.map((alert) => (
              <div
                key={alert.alertId}
                className={classnames(
                  'p-2 rounded cursor-pointer transition-colors',
                  getAlertSeverityClass(alert.severity)
                )}
                onClick={() => onAlertClick?.(alert)}
                role="button"
                tabIndex={0}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{alert.message}</span>
                  <span className="text-sm">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};

export default React.memo(HealthStatus);
export type { HealthStatusProps };