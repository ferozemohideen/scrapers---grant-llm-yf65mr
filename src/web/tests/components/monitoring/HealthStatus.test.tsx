import React from 'react';
import { render, screen, waitFor, act, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import HealthStatus from '../../src/components/monitoring/HealthStatus';
import { MonitoringService } from '../../src/services/monitoring.service';
import { HealthStatus as HealthStatusEnum } from '../../src/interfaces/monitoring.interface';

// Mock the monitoring service
jest.mock('../../src/services/monitoring.service');

describe('HealthStatus Component', () => {
  // Test data setup
  const mockHealthData = {
    status: HealthStatusEnum.HEALTHY,
    uptime: 99.99,
    responseTime: 150,
    lastCheck: new Date('2024-02-20T12:00:00Z'),
    securityAlerts: [],
    message: 'All systems operational',
    componentStatus: {
      'API Gateway': HealthStatusEnum.HEALTHY,
      'Database': HealthStatusEnum.HEALTHY,
      'Search Service': HealthStatusEnum.HEALTHY
    }
  };

  const mockSecurityAlert = {
    alertId: 'alert-1',
    severity: 'HIGH',
    message: 'Unusual traffic pattern detected',
    timestamp: new Date('2024-02-20T12:05:00Z')
  };

  let mockMonitoringService: jest.Mocked<MonitoringService>;

  beforeEach(() => {
    jest.useFakeTimers();
    mockMonitoringService = new MonitoringService() as jest.Mocked<MonitoringService>;
    mockMonitoringService.getSystemHealth = jest.fn().mockResolvedValue(mockHealthData);
    (MonitoringService as jest.Mock).mockImplementation(() => mockMonitoringService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should render health metrics correctly', async () => {
    render(<HealthStatus />);

    // Wait for initial data load
    await waitFor(() => {
      expect(screen.getByTestId('health-status')).toBeInTheDocument();
    });

    // Verify system status
    expect(screen.getByText(/System Status:/)).toHaveTextContent('System Status: HEALTHY');
    expect(screen.getByText(/System Status:/)).toHaveClass('text-success-color');

    // Verify metrics display
    expect(screen.getByText('Uptime')).toBeInTheDocument();
    expect(screen.getByText('Response Time')).toBeInTheDocument();
    expect(screen.getByText('Active Alerts')).toBeInTheDocument();

    // Verify formatted values
    expect(screen.getByText('150ms')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // Active alerts count
  });

  it('should handle loading state correctly', () => {
    mockMonitoringService.getSystemHealth.mockImplementation(() => new Promise(() => {}));
    render(<HealthStatus />);

    expect(screen.getByText('Loading health status...')).toBeInTheDocument();
    expect(screen.getByText('Loading health status...').parentElement).toHaveClass('animate-pulse');
  });

  it('should handle error state correctly', async () => {
    mockMonitoringService.getSystemHealth.mockRejectedValue(new Error('Failed to fetch'));
    render(<HealthStatus />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch health status')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch health status').parentElement).toHaveClass('bg-error-color');
    });
  });

  it('should update data at specified refresh interval', async () => {
    const refreshInterval = 5000;
    render(<HealthStatus refreshInterval={refreshInterval} />);

    await waitFor(() => {
      expect(mockMonitoringService.getSystemHealth).toHaveBeenCalledTimes(1);
    });

    // Fast-forward time and verify refresh
    act(() => {
      jest.advanceTimersByTime(refreshInterval);
    });

    await waitFor(() => {
      expect(mockMonitoringService.getSystemHealth).toHaveBeenCalledTimes(2);
    });
  });

  it('should display component status when enabled', async () => {
    render(<HealthStatus showComponentStatus={true} />);

    await waitFor(() => {
      expect(screen.getByText('Component Status')).toBeInTheDocument();
    });

    // Verify individual component statuses
    expect(screen.getByText('API Gateway')).toBeInTheDocument();
    expect(screen.getByText('Database')).toBeInTheDocument();
    expect(screen.getByText('Search Service')).toBeInTheDocument();
  });

  it('should handle security alerts correctly', async () => {
    const healthDataWithAlerts = {
      ...mockHealthData,
      securityAlerts: [mockSecurityAlert]
    };
    mockMonitoringService.getSystemHealth.mockResolvedValue(healthDataWithAlerts);

    const onAlertClick = jest.fn();
    render(<HealthStatus showSecurityMetrics={true} onAlertClick={onAlertClick} />);

    await waitFor(() => {
      expect(screen.getByText('Security Alerts')).toBeInTheDocument();
      expect(screen.getByText('Unusual traffic pattern detected')).toBeInTheDocument();
    });

    // Test alert interaction
    const alert = screen.getByText('Unusual traffic pattern detected');
    await userEvent.click(alert);
    expect(onAlertClick).toHaveBeenCalledWith(mockSecurityAlert);
  });

  it('should be accessible', async () => {
    const { container } = render(<HealthStatus />);

    await waitFor(() => {
      expect(screen.getByTestId('health-status')).toBeInTheDocument();
    });

    // Verify ARIA attributes
    expect(screen.getByTestId('health-status')).toHaveAttribute('role', 'article');
    
    // Verify keyboard navigation
    const alerts = screen.queryAllByRole('button');
    alerts.forEach(alert => {
      expect(alert).toHaveAttribute('tabIndex', '0');
    });
  });

  it('should format response time correctly', async () => {
    const healthDataWithHighResponse = {
      ...mockHealthData,
      responseTime: 1500 // 1.5 seconds
    };
    mockMonitoringService.getSystemHealth.mockResolvedValue(healthDataWithHighResponse);

    render(<HealthStatus />);

    await waitFor(() => {
      expect(screen.getByText('1.50s')).toBeInTheDocument();
    });
  });

  it('should handle theme changes', async () => {
    render(<HealthStatus />);

    await waitFor(() => {
      expect(screen.getByTestId('health-status')).toBeInTheDocument();
    });

    // Verify dark mode classes
    const card = screen.getByTestId('health-status');
    expect(card).toHaveClass('dark:bg-gray-800');
    expect(card).toHaveClass('dark:border-gray-700');
  });

  it('should cleanup on unmount', async () => {
    const { unmount } = render(<HealthStatus refreshInterval={5000} />);

    await waitFor(() => {
      expect(screen.getByTestId('health-status')).toBeInTheDocument();
    });

    unmount();

    // Verify cleanup
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(mockMonitoringService.getSystemHealth).toHaveBeenCalledTimes(1);
  });
});