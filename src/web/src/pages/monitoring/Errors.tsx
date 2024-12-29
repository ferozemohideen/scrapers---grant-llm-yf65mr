import React, { useState, useEffect, useCallback, useMemo } from 'react';
import styled from '@emotion/styled';
import { Chart, Line, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import DashboardLayout from '../../layouts/DashboardLayout';
import ErrorLog from '../../components/monitoring/ErrorLog';
import MonitoringService from '../../services/monitoring.service';
import { useAuth } from '../../hooks/useAuth';
import { ErrorType, AlertSeverity } from '../../interfaces/monitoring.interface';
import { TOAST } from '../../constants/ui.constants';

// Styled components for error monitoring dashboard
const ErrorsContainer = styled.div`
  display: grid;
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  background: var(--background-color);
  min-height: 100vh;
`;

const ErrorsHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
  gap: var(--spacing-md);
`;

const ErrorStats = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
`;

const StatCard = styled.div<{ severity?: AlertSeverity }>`
  padding: var(--spacing-md);
  background: var(--background-color-dark);
  border-radius: var(--border-radius-md);
  border-left: 4px solid ${props => 
    props.severity === AlertSeverity.CRITICAL ? 'var(--error-color)' :
    props.severity === AlertSeverity.HIGH ? 'var(--warning-color)' :
    'var(--primary-color)'};
`;

const ChartContainer = styled.div`
  height: 300px;
  margin-bottom: var(--spacing-lg);
  padding: var(--spacing-md);
  background: var(--background-color-dark);
  border-radius: var(--border-radius-md);
`;

// Interface for error statistics
interface ErrorStats {
  total: number;
  critical: number;
  high: number;
  resolved: number;
  errorRate: number;
}

// Interface for error trend data
interface ErrorTrendPoint {
  timestamp: string;
  count: number;
  errorRate: number;
}

const ErrorsPage: React.FC = () => {
  // Authentication and authorization
  const { user, hasPermission } = useAuth();
  const [errorStats, setErrorStats] = useState<ErrorStats>({
    total: 0,
    critical: 0,
    high: 0,
    resolved: 0,
    errorRate: 0
  });
  const [errorTrends, setErrorTrends] = useState<ErrorTrendPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Alert thresholds based on technical specifications
  const alertThresholds = useMemo(() => ({
    errorRateThreshold: 5, // 5% error rate threshold
    responseTimeThreshold: 2000, // 2 second response time
    securityViolationThreshold: 1 // 1 security violation
  }), []);

  // Fetch error statistics
  const fetchErrorStats = useCallback(async () => {
    try {
      const stats = await MonitoringService.getErrorStats();
      setErrorStats(stats.data);

      // Check error rate threshold
      if (stats.data.errorRate > alertThresholds.errorRateThreshold) {
        MonitoringService.reportError(
          new Error(`Error rate exceeded threshold: ${stats.data.errorRate}%`),
          ErrorType.VALIDATION_ERROR,
          { threshold: alertThresholds.errorRateThreshold }
        );
      }
    } catch (error) {
      console.error('Failed to fetch error statistics:', error);
    }
  }, [alertThresholds.errorRateThreshold]);

  // Fetch error trends
  const fetchErrorTrends = useCallback(async () => {
    try {
      const trends = await MonitoringService.getErrorTrends();
      setErrorTrends(trends.data);
    } catch (error) {
      console.error('Failed to fetch error trends:', error);
    }
  }, []);

  // Initialize data and set up real-time updates
  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      await Promise.all([fetchErrorStats(), fetchErrorTrends()]);
      setLoading(false);
    };

    initializeData();

    // Set up real-time error monitoring
    const subscription = MonitoringService.subscribeToErrors(() => {
      fetchErrorStats();
      fetchErrorTrends();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchErrorStats, fetchErrorTrends]);

  // Handle error selection for detailed view
  const handleErrorSelect = useCallback(async (error: any) => {
    try {
      await MonitoringService.updateAlertThresholds({
        ...alertThresholds,
        errorRateThreshold: error.type === ErrorType.SECURITY_VIOLATION ? 0 : 5
      });
    } catch (error) {
      console.error('Failed to update alert thresholds:', error);
    }
  }, [alertThresholds]);

  // Check user permissions
  if (!hasPermission('view:errors')) {
    return (
      <DashboardLayout>
        <div>You don't have permission to view this page.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ErrorsContainer>
        <ErrorsHeader>
          <h1>Error Monitoring</h1>
          {user?.role === 'admin' && (
            <button onClick={() => MonitoringService.clearErrorLogs()}>
              Clear Error Logs
            </button>
          )}
        </ErrorsHeader>

        <ErrorStats>
          <StatCard severity={AlertSeverity.CRITICAL}>
            <h3>Critical Errors</h3>
            <p>{errorStats.critical}</p>
          </StatCard>
          <StatCard severity={AlertSeverity.HIGH}>
            <h3>High Priority</h3>
            <p>{errorStats.high}</p>
          </StatCard>
          <StatCard>
            <h3>Total Errors</h3>
            <p>{errorStats.total}</p>
          </StatCard>
          <StatCard>
            <h3>Error Rate</h3>
            <p>{errorStats.errorRate.toFixed(2)}%</p>
          </StatCard>
        </ErrorStats>

        <ChartContainer>
          <Chart
            width="100%"
            height={250}
            data={errorTrends}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="errorRate"
              stroke="var(--primary-color)"
              name="Error Rate"
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="var(--error-color)"
              name="Error Count"
            />
          </Chart>
        </ChartContainer>

        <ErrorLog
          limit={100}
          onErrorSelect={handleErrorSelect}
          securityMonitoring={true}
          realTimeUpdates={true}
          alertThresholds={{
            errorRateThreshold: alertThresholds.errorRateThreshold,
            securityViolationThreshold: alertThresholds.securityViolationThreshold,
            responseTimeThreshold: alertThresholds.responseTimeThreshold
          }}
        />
      </ErrorsContainer>
    </DashboardLayout>
  );
};

export default ErrorsPage;