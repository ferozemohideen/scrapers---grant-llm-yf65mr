import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { format } from 'date-fns'; // ^2.30.0
import { Table, TableColumn } from '../common/Table';
import MonitoringService from '../../services/monitoring.service';
import { ErrorType, AlertSeverity } from '../../interfaces/monitoring.interface';

// Enhanced props interface with security monitoring capabilities
interface ErrorLogProps {
  limit?: number;
  onErrorSelect?: (error: ErrorLog) => void;
  securityMonitoring?: boolean;
  realTimeUpdates?: boolean;
  alertThresholds?: AlertThresholdConfig;
}

// Interface for error log entries with security attributes
interface ErrorLog {
  id: string;
  timestamp: Date;
  type: ErrorType;
  message: string;
  severity: AlertSeverity;
  component: string;
  metadata?: Record<string, unknown>;
  securityRelevant?: boolean;
  stackTrace?: string;
  correlationId?: string;
}

// Configuration for alert thresholds
interface AlertThresholdConfig {
  errorRateThreshold: number;
  securityViolationThreshold: number;
  responseTimeThreshold: number;
}

// Styled components for enhanced error display
const ErrorLogContainer = styled.div`
  padding: var(--spacing-lg);
  background: var(--background-color);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-md);
  transition: all 0.3s ease;
  position: relative;
  min-height: 400px;
`;

const ErrorTypeTag = styled.span<{ type: ErrorType; severity: AlertSeverity }>`
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  background: ${props => getErrorTypeColor(props.type, props.severity)};
  color: var(--text-color-inverse);
  display: inline-flex;
  align-items: center;
  gap: 4px;
`;

const SecurityBadge = styled.div<{ severity: AlertSeverity }>`
  position: absolute;
  top: var(--spacing-sm);
  right: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: ${props => 
    props.severity === AlertSeverity.CRITICAL ? 'var(--error-color)' :
    props.severity === AlertSeverity.HIGH ? 'var(--warning-color)' :
    'var(--secondary-color)'};
  color: var(--text-color-inverse);
  border-radius: var(--border-radius-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
`;

// Helper function to determine error type color based on severity
const getErrorTypeColor = (type: ErrorType, severity: AlertSeverity): string => {
  switch (severity) {
    case AlertSeverity.CRITICAL:
      return 'var(--error-color)';
    case AlertSeverity.HIGH:
      return 'var(--warning-color)';
    case AlertSeverity.MEDIUM:
      return 'var(--secondary-color)';
    default:
      return 'var(--primary-color)';
  }
};

// Main ErrorLog component
export const ErrorLog: React.FC<ErrorLogProps> = ({
  limit = 100,
  onErrorSelect,
  securityMonitoring = true,
  realTimeUpdates = true,
  alertThresholds = {
    errorRateThreshold: 5,
    securityViolationThreshold: 1,
    responseTimeThreshold: 2000
  }
}) => {
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [securityViolations, setSecurityViolations] = useState<number>(0);

  // Table columns configuration
  const columns: TableColumn<ErrorLog>[] = useMemo(() => [
    {
      key: 'timestamp',
      title: 'Timestamp',
      width: '180px',
      render: (value) => format(new Date(value), 'yyyy-MM-dd HH:mm:ss')
    },
    {
      key: 'type',
      title: 'Type',
      width: '150px',
      render: (value, record) => (
        <ErrorTypeTag type={value as ErrorType} severity={record.severity}>
          {value}
        </ErrorTypeTag>
      )
    },
    {
      key: 'message',
      title: 'Message',
      width: 'auto'
    },
    {
      key: 'component',
      title: 'Component',
      width: '150px'
    },
    {
      key: 'severity',
      title: 'Severity',
      width: '120px'
    }
  ], []);

  // Fetch initial error logs
  const fetchErrorLogs = useCallback(async () => {
    try {
      setLoading(true);
      const response = await MonitoringService.getErrorLogs(limit);
      setErrors(response.data);
    } catch (error) {
      console.error('Failed to fetch error logs:', error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Set up real-time error updates
  useEffect(() => {
    if (!realTimeUpdates) return;

    const subscription = MonitoringService.subscribeToErrors((newError) => {
      setErrors(prev => [newError, ...prev].slice(0, limit));
      
      // Check security violations
      if (newError.type === ErrorType.SECURITY_VIOLATION) {
        setSecurityViolations(prev => prev + 1);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [realTimeUpdates, limit]);

  // Monitor security violations if enabled
  useEffect(() => {
    if (!securityMonitoring) return;

    const fetchSecurityViolations = async () => {
      try {
        const response = await MonitoringService.getSecurityViolations();
        setSecurityViolations(response.data.length);
      } catch (error) {
        console.error('Failed to fetch security violations:', error);
      }
    };

    fetchSecurityViolations();
    const interval = setInterval(fetchSecurityViolations, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [securityMonitoring]);

  // Check alert thresholds
  useEffect(() => {
    const errorRate = (errors.filter(e => e.severity === AlertSeverity.CRITICAL).length / errors.length) * 100;
    
    if (errorRate > alertThresholds.errorRateThreshold) {
      console.warn(`Critical error rate (${errorRate.toFixed(2)}%) exceeds threshold`);
    }

    if (securityViolations > alertThresholds.securityViolationThreshold) {
      console.error(`Security violations (${securityViolations}) exceed threshold`);
    }
  }, [errors, securityViolations, alertThresholds]);

  return (
    <ErrorLogContainer>
      {securityMonitoring && securityViolations > 0 && (
        <SecurityBadge severity={AlertSeverity.CRITICAL}>
          {securityViolations} Security Violation{securityViolations > 1 ? 's' : ''}
        </SecurityBadge>
      )}

      <Table<ErrorLog>
        columns={columns}
        data={errors}
        loading={loading}
        sortable
        onSort={(key, order) => {
          const sorted = [...errors].sort((a, b) => {
            if (order === 'asc') {
              return a[key] > b[key] ? 1 : -1;
            }
            return a[key] < b[key] ? 1 : -1;
          });
          setErrors(sorted);
        }}
        virtualScroll
        pageSize={20}
        onPageChange={(page) => {
          // Handle pagination if needed
        }}
      />
    </ErrorLogContainer>
  );
};

export default ErrorLog;