/**
 * Monitoring Service
 * Version: 1.0.0
 * 
 * Provides comprehensive system monitoring capabilities including:
 * - System health checks
 * - Performance metrics tracking
 * - Security monitoring
 * - Error tracking
 * - Alert threshold management
 */

import { ApiService } from './api.service';
import {
  SystemHealth,
  PerformanceMetrics,
  ScraperMetrics,
  ErrorType,
  HealthStatus,
  SecurityMetrics,
  Alert,
  AlertSeverity,
  MonitoringThresholds
} from '../interfaces/monitoring.interface';

/**
 * Default monitoring thresholds based on technical specifications
 */
const DEFAULT_THRESHOLDS: MonitoringThresholds = {
  maxResponseTime: 2000,        // 2 second response time requirement
  maxCpuUsage: 80,             // 80% CPU threshold
  maxMemoryUsage: 85,          // 85% memory threshold
  maxErrorRate: 1,             // 1% error rate threshold
  maxConcurrentUsers: 1000     // 1000+ concurrent users requirement
};

/**
 * Security monitoring configuration
 */
interface SecurityMonitoringConfig {
  scanInterval: number;         // Interval between security scans in ms
  failedLoginThreshold: number; // Number of failed logins before alert
  threatScanEnabled: boolean;   // Enable active threat scanning
}

/**
 * Enhanced monitoring service for comprehensive system tracking
 */
export class MonitoringService {
  private readonly apiService: ApiService;
  private readonly alertThresholds: MonitoringThresholds;
  private readonly securityConfig: SecurityMonitoringConfig;
  private healthCheckInterval: NodeJS.Timer | null = null;

  constructor(
    apiService: ApiService,
    alertThresholds: Partial<MonitoringThresholds> = {},
    securityConfig: Partial<SecurityMonitoringConfig> = {}
  ) {
    this.apiService = apiService;
    this.alertThresholds = { ...DEFAULT_THRESHOLDS, ...alertThresholds };
    this.securityConfig = {
      scanInterval: 300000,      // 5 minutes
      failedLoginThreshold: 5,   // 5 failed attempts
      threatScanEnabled: true,
      ...securityConfig
    };
    
    this.initializeHealthChecks();
  }

  /**
   * Initialize automated health checks
   */
  private initializeHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getSystemHealth();
        this.processHealthStatus(health);
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, 60000); // Check every minute
  }

  /**
   * Retrieve comprehensive system health status
   */
  public async getSystemHealth(componentId?: string): Promise<SystemHealth> {
    const endpoint = componentId ? 
      `/monitoring/health/${componentId}` : 
      '/monitoring/health';

    const response = await this.apiService.get<SystemHealth>(endpoint);
    return response.data;
  }

  /**
   * Retrieve detailed performance metrics
   */
  public async getPerformanceMetrics(
    timeRange: string,
    components: string[] = []
  ): Promise<PerformanceMetrics[]> {
    const response = await this.apiService.get<PerformanceMetrics[]>(
      '/monitoring/metrics/performance',
      { timeRange, components }
    );

    const metrics = response.data;
    this.checkPerformanceThresholds(metrics);
    return metrics;
  }

  /**
   * Retrieve security-specific monitoring metrics
   */
  public async getSecurityMetrics(
    timeRange: string,
    securityLevel: string
  ): Promise<SecurityMetrics> {
    const response = await this.apiService.get<SecurityMetrics>(
      '/monitoring/metrics/security',
      { timeRange, securityLevel }
    );

    const metrics = response.data;
    this.processSecurityMetrics(metrics);
    return metrics;
  }

  /**
   * Retrieve scraper-specific metrics
   */
  public async getScraperMetrics(timeRange: string): Promise<ScraperMetrics> {
    const response = await this.apiService.get<ScraperMetrics>(
      '/monitoring/metrics/scraper',
      { timeRange }
    );
    return response.data;
  }

  /**
   * Report system error with classification
   */
  public async reportError(
    error: Error,
    type: ErrorType,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    await this.apiService.post('/monitoring/errors', {
      message: error.message,
      stack: error.stack,
      type,
      metadata,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Process and validate health status
   */
  private processHealthStatus(health: SystemHealth): void {
    if (health.status !== HealthStatus.HEALTHY) {
      this.generateAlert({
        alertId: `health-${Date.now()}`,
        severity: health.status === HealthStatus.DEGRADED ? 
          AlertSeverity.HIGH : 
          AlertSeverity.CRITICAL,
        message: `System health degraded: ${health.message}`,
        timestamp: new Date(),
        component: 'system',
        threshold: 0
      });
    }
  }

  /**
   * Check performance metrics against thresholds
   */
  private checkPerformanceThresholds(metrics: PerformanceMetrics[]): void {
    metrics.forEach(metric => {
      if (metric.responseTime > this.alertThresholds.maxResponseTime) {
        this.generateAlert({
          alertId: `perf-${Date.now()}`,
          severity: AlertSeverity.HIGH,
          message: `Response time exceeded threshold: ${metric.responseTime}ms`,
          timestamp: new Date(),
          component: 'performance',
          threshold: this.alertThresholds.maxResponseTime
        });
      }

      if (metric.concurrentUsers > this.alertThresholds.maxConcurrentUsers) {
        this.generateAlert({
          alertId: `users-${Date.now()}`,
          severity: AlertSeverity.MEDIUM,
          message: `Concurrent users threshold exceeded: ${metric.concurrentUsers}`,
          timestamp: new Date(),
          component: 'capacity',
          threshold: this.alertThresholds.maxConcurrentUsers
        });
      }
    });
  }

  /**
   * Process security metrics and generate alerts
   */
  private processSecurityMetrics(metrics: SecurityMetrics): void {
    if (metrics.failedLogins > this.securityConfig.failedLoginThreshold) {
      this.generateAlert({
        alertId: `security-${Date.now()}`,
        severity: AlertSeverity.CRITICAL,
        message: `High number of failed login attempts: ${metrics.failedLogins}`,
        timestamp: new Date(),
        component: 'security',
        threshold: this.securityConfig.failedLoginThreshold
      });
    }

    if (metrics.activeThreats > 0) {
      this.generateAlert({
        alertId: `threat-${Date.now()}`,
        severity: AlertSeverity.CRITICAL,
        message: `Active security threats detected: ${metrics.activeThreats}`,
        timestamp: new Date(),
        component: 'security',
        threshold: 0
      });
    }
  }

  /**
   * Generate and process system alert
   */
  private async generateAlert(alert: Alert): Promise<void> {
    await this.apiService.post('/monitoring/alerts', alert);
    console.warn(`System Alert [${alert.severity}]:`, alert.message);
  }

  /**
   * Clean up monitoring service
   */
  public dispose(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }
}

// Export singleton instance
export default new MonitoringService(
  new ApiService(),
  DEFAULT_THRESHOLDS,
  {
    scanInterval: 300000,
    failedLoginThreshold: 5,
    threatScanEnabled: true
  }
);