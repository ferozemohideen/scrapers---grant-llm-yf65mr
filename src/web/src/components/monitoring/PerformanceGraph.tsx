/**
 * PerformanceGraph Component
 * Version: 1.0.0
 * 
 * A real-time performance metrics visualization component that displays critical system
 * metrics including response time, concurrent users, CPU usage, memory usage, and network
 * latency with configurable refresh intervals and responsive design.
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'; // ^2.5.0
import { PerformanceMetrics } from '../../interfaces/monitoring.interface';
import { MonitoringService } from '../../services/monitoring.service';
import Card from '../common/Card';

/**
 * Props interface for the PerformanceGraph component
 */
interface PerformanceGraphProps {
  timeRange: string;
  refreshInterval?: number;
  height?: number;
  thresholds?: {
    responseTime?: number;
    cpuUsage?: number;
    memoryUsage?: number;
    errorRate?: number;
  };
  onMetricAlert?: (metric: string, value: number, threshold: number) => void;
}

/**
 * Custom hook for managing performance metrics data
 */
const usePerformanceData = (
  timeRange: string,
  refreshInterval: number,
  thresholds?: PerformanceGraphProps['thresholds']
) => {
  const [data, setData] = useState<PerformanceMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const metrics = await MonitoringService.getPerformanceMetrics(timeRange);
      setData(metrics);
      
      // Check thresholds and trigger alerts
      if (thresholds) {
        metrics.forEach(metric => {
          if (thresholds.responseTime && metric.responseTime > thresholds.responseTime) {
            onMetricAlert?.('responseTime', metric.responseTime, thresholds.responseTime);
          }
          if (thresholds.cpuUsage && metric.cpuUsage > thresholds.cpuUsage) {
            onMetricAlert?.('cpuUsage', metric.cpuUsage, thresholds.cpuUsage);
          }
          // Add other threshold checks...
        });
      }
      
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch metrics'));
    } finally {
      setLoading(false);
    }
  }, [timeRange, thresholds]);

  useEffect(() => {
    fetchMetrics();
    const intervalId = setInterval(fetchMetrics, refreshInterval);

    return () => clearInterval(intervalId);
  }, [fetchMetrics, refreshInterval]);

  return { data, loading, error };
};

/**
 * Format metrics data for chart display
 */
const formatMetricsData = (metrics: PerformanceMetrics[]) => {
  return metrics.map(metric => ({
    ...metric,
    timestamp: new Date(metric.timestamp).toLocaleTimeString(),
    responseTime: Number(metric.responseTime.toFixed(2)),
    cpuUsage: Number(metric.cpuUsage.toFixed(1)),
    memoryUsage: Number(metric.memoryUsage.toFixed(1)),
    networkLatency: Number(metric.networkLatency.toFixed(2))
  }));
};

/**
 * PerformanceGraph Component
 */
const PerformanceGraph: React.FC<PerformanceGraphProps> = ({
  timeRange,
  refreshInterval = 30000,
  height = 300,
  thresholds,
  onMetricAlert
}) => {
  const { data, loading, error } = usePerformanceData(timeRange, refreshInterval, thresholds);
  
  const formattedData = useMemo(() => formatMetricsData(data), [data]);

  const chartLines = [
    { dataKey: 'responseTime', stroke: 'var(--primary-color)', name: 'Response Time (ms)' },
    { dataKey: 'cpuUsage', stroke: 'var(--success-color)', name: 'CPU Usage (%)' },
    { dataKey: 'memoryUsage', stroke: 'var(--warning-color)', name: 'Memory Usage (%)' },
    { dataKey: 'networkLatency', stroke: 'var(--error-color)', name: 'Network Latency (ms)' }
  ];

  const renderContent = () => {
    if (loading) {
      return <div className="flex justify-center items-center h-full">Loading metrics...</div>;
    }

    if (error) {
      return (
        <div className="flex justify-center items-center h-full text-error-color">
          Error loading metrics: {error.message}
        </div>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={formattedData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="timestamp"
            label={{ value: 'Time', position: 'insideBottom', offset: -10 }}
          />
          <YAxis
            yAxisId="left"
            label={{ value: 'Value', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--background-color)',
              border: '1px solid var(--border-color)'
            }}
          />
          <Legend />
          {chartLines.map(line => (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.stroke}
              name={line.name}
              dot={false}
              yAxisId="left"
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  return (
    <Card
      variant="outlined"
      className="performance-graph"
      header={
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-medium">System Performance Metrics</h3>
          <span className="text-sm text-text-color-light">
            Auto-refresh: {refreshInterval / 1000}s
          </span>
        </div>
      }
      data-testid="performance-graph"
      aria-label="Performance metrics visualization"
    >
      {renderContent()}
    </Card>
  );
};

export default React.memo(PerformanceGraph);
export type { PerformanceGraphProps };