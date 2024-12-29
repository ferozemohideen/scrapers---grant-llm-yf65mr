import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea
} from 'recharts'; // ^2.5.0
import dayjs from 'dayjs'; // ^1.11.0
import Card from '../common/Card';
import MonitoringService from '../../services/monitoring.service';

/**
 * Interface for alert threshold configuration
 */
interface AlertThresholdConfig {
  warning: number;
  critical: number;
  enabled: boolean;
}

/**
 * Props interface for the MetricsChart component
 */
interface MetricsChartProps {
  type: 'performance' | 'scraper' | 'resources' | 'security';
  timeRange?: '1h' | '24h' | '7d' | '30d' | 'custom';
  showThresholds?: boolean;
  alertConfig?: AlertThresholdConfig;
  refreshInterval?: number;
  'aria-label'?: string;
}

/**
 * Formats metric data for chart display with threshold indicators
 */
const formatMetricsData = (
  data: Array<any>,
  alertConfig?: AlertThresholdConfig
) => {
  return data.map(metric => ({
    timestamp: dayjs(metric.timestamp).format('HH:mm:ss'),
    value: metric.value,
    status: alertConfig?.enabled
      ? metric.value >= alertConfig.critical
        ? 'critical'
        : metric.value >= alertConfig.warning
          ? 'warning'
          : 'normal'
      : 'normal',
    tooltipData: {
      ...metric,
      formattedTime: dayjs(metric.timestamp).format('YYYY-MM-DD HH:mm:ss')
    }
  }));
};

/**
 * Calculates threshold visualization data
 */
const calculateThresholds = (
  config: AlertThresholdConfig,
  data: Array<any>
) => {
  if (!config?.enabled) return null;

  const timeRange = data.map(d => d.timestamp);
  return {
    warningLine: {
      y: config.warning,
      label: `Warning (${config.warning})`
    },
    criticalLine: {
      y: config.critical,
      label: `Critical (${config.critical})`
    },
    zones: [
      {
        y1: config.warning,
        y2: config.critical,
        fill: '#fff3dc',
        opacity: 0.3
      },
      {
        y1: config.critical,
        y2: data.reduce((max, point) => Math.max(max, point.value), 0) + 10,
        fill: '#ffe6e6',
        opacity: 0.3
      }
    ]
  };
};

/**
 * MetricsChart component for visualizing system metrics
 */
const MetricsChart: React.FC<MetricsChartProps> = ({
  type,
  timeRange = '24h',
  showThresholds = true,
  alertConfig,
  refreshInterval = 30000,
  'aria-label': ariaLabel
}) => {
  const [data, setData] = useState<Array<any>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshTimer = useRef<NodeJS.Timer>();
  const monitoringService = useRef(new MonitoringService());

  /**
   * Fetches metrics data based on chart type
   */
  const fetchMetrics = useCallback(async () => {
    try {
      let metrics;
      switch (type) {
        case 'performance':
          metrics = await monitoringService.current.getPerformanceMetrics(timeRange);
          break;
        case 'scraper':
          metrics = await monitoringService.current.getScraperMetrics(timeRange);
          break;
        case 'security':
          metrics = await monitoringService.current.getSecurityMetrics(timeRange, 'high');
          break;
        default:
          throw new Error(`Unsupported metric type: ${type}`);
      }

      const formattedData = formatMetricsData(metrics, alertConfig);
      setData(formattedData);
      setError(null);
    } catch (err) {
      setError(`Failed to fetch ${type} metrics: ${err.message}`);
      console.error('Metrics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [type, timeRange, alertConfig]);

  // Initialize data fetching and refresh timer
  useEffect(() => {
    fetchMetrics();

    refreshTimer.current = setInterval(fetchMetrics, refreshInterval);

    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [fetchMetrics, refreshInterval]);

  // Calculate threshold visualization data
  const thresholds = showThresholds && alertConfig
    ? calculateThresholds(alertConfig, data)
    : null;

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.[0]) return null;

    const data = payload[0].payload.tooltipData;
    return (
      <div className="bg-white p-2 border border-gray-200 rounded shadow-md">
        <p className="font-medium">{data.formattedTime}</p>
        <p>Value: {data.value}</p>
        {data.status !== 'normal' && (
          <p className={`text-${data.status === 'critical' ? 'red' : 'yellow'}-600`}>
            Status: {data.status}
          </p>
        )}
      </div>
    );
  };

  return (
    <Card
      variant="default"
      className="w-full h-[400px]"
      aria-label={ariaLabel || `${type} metrics chart`}
      role="figure"
    >
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <span className="text-gray-500">Loading metrics...</span>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center h-full text-red-500">
          {error}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              label={{ value: 'Time', position: 'bottom' }}
            />
            <YAxis
              label={{
                value: type.charAt(0).toUpperCase() + type.slice(1),
                angle: -90,
                position: 'insideLeft'
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend />

            {/* Threshold visualization */}
            {thresholds && (
              <>
                {thresholds.zones.map((zone, index) => (
                  <ReferenceArea
                    key={index}
                    y1={zone.y1}
                    y2={zone.y2}
                    fill={zone.fill}
                    fillOpacity={zone.opacity}
                  />
                ))}
                <ReferenceLine
                  y={thresholds.warningLine.y}
                  stroke="#ffc107"
                  strokeDasharray="3 3"
                  label={thresholds.warningLine.label}
                />
                <ReferenceLine
                  y={thresholds.criticalLine.y}
                  stroke="#dc3545"
                  strokeDasharray="3 3"
                  label={thresholds.criticalLine.label}
                />
              </>
            )}

            <Line
              type="monotone"
              dataKey="value"
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
              name={type}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
};

export default React.memo(MetricsChart);
export type { MetricsChartProps, AlertThresholdConfig };