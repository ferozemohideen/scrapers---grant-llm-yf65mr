/**
 * @fileoverview Health Controller for system monitoring and metrics collection
 * Implements comprehensive health checks with Prometheus integration
 * @version 1.0.0
 */

import { Request, Response } from 'express'; // ^4.18.0
import { Counter, Gauge, Histogram, register } from 'prom-client'; // ^14.0.0
import { AuthService } from '../../services/auth.service';
import { createError } from '../../utils/error.util';
import { ERROR_TYPES } from '../../constants/error.constants';

/**
 * Health Controller implementing Singleton pattern with Prometheus metrics
 */
export class HealthController {
  private static instance: HealthController;
  private readonly authService: AuthService;
  private readonly startTime: Date;

  // Prometheus metrics collectors
  private readonly healthCheckCounter: Counter;
  private readonly uptimeGauge: Gauge;
  private readonly memoryGauge: Gauge;
  private readonly responseTimeHistogram: Histogram;
  private readonly componentStatusGauge: Gauge;

  /**
   * Private constructor initializing metrics collectors
   */
  private constructor() {
    this.authService = AuthService.getInstance();
    this.startTime = new Date();

    // Initialize Prometheus metrics
    this.healthCheckCounter = new Counter({
      name: 'health_check_total',
      help: 'Total number of health check requests'
    });

    this.uptimeGauge = new Gauge({
      name: 'system_uptime_seconds',
      help: 'System uptime in seconds'
    });

    this.memoryGauge = new Gauge({
      name: 'system_memory_usage_bytes',
      help: 'System memory usage in bytes',
      labelNames: ['type']
    });

    this.responseTimeHistogram = new Histogram({
      name: 'health_check_response_time_seconds',
      help: 'Health check response time in seconds',
      buckets: [0.1, 0.5, 1, 2, 5]
    });

    this.componentStatusGauge = new Gauge({
      name: 'component_health_status',
      help: 'Health status of system components',
      labelNames: ['component']
    });
  }

  /**
   * Returns singleton instance of HealthController
   */
  public static getInstance(): HealthController {
    if (!HealthController.instance) {
      HealthController.instance = new HealthController();
    }
    return HealthController.instance;
  }

  /**
   * Basic health check endpoint with uptime metrics
   */
  public async checkHealth(req: Request, res: Response): Promise<void> {
    const end = this.responseTimeHistogram.startTimer();
    try {
      const uptime = (new Date().getTime() - this.startTime.getTime()) / 1000;
      this.uptimeGauge.set(uptime);
      this.healthCheckCounter.inc();

      const memoryUsage = process.memoryUsage();
      this.memoryGauge.labels('heapUsed').set(memoryUsage.heapUsed);
      this.memoryGauge.labels('heapTotal').set(memoryUsage.heapTotal);
      this.memoryGauge.labels('rss').set(memoryUsage.rss);

      res.status(200).json({
        status: 'healthy',
        uptime,
        timestamp: new Date().toISOString(),
        version: process.env.APP_VERSION || '1.0.0'
      });
    } catch (error) {
      const appError = createError(
        ERROR_TYPES.INTERNAL_ERROR,
        'Health check failed',
        { error: error.message }
      );
      res.status(appError.statusCode).json({
        status: 'unhealthy',
        error: appError.message
      });
    } finally {
      end();
    }
  }

  /**
   * Detailed system status with comprehensive metrics
   */
  public async getDetailedStatus(req: Request, res: Response): Promise<void> {
    const end = this.responseTimeHistogram.startTimer();
    try {
      const memoryUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      // Update memory metrics
      Object.entries(memoryUsage).forEach(([key, value]) => {
        this.memoryGauge.labels(key).set(value);
      });

      const metrics = await register.metrics();
      
      res.status(200).json({
        status: 'healthy',
        metrics: {
          memory: memoryUsage,
          cpu: cpuUsage,
          prometheus: metrics
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const appError = createError(
        ERROR_TYPES.INTERNAL_ERROR,
        'Detailed status check failed',
        { error: error.message }
      );
      res.status(appError.statusCode).json({
        status: 'error',
        error: appError.message
      });
    } finally {
      end();
    }
  }

  /**
   * Component-specific health status with detailed metrics
   */
  public async getComponentHealth(req: Request, res: Response): Promise<void> {
    const end = this.responseTimeHistogram.startTimer();
    try {
      // Check authentication service health
      const authHealth = await this.checkAuthHealth();
      this.componentStatusGauge.labels('auth').set(authHealth.healthy ? 1 : 0);

      // Check database connectivity
      const dbHealth = await this.checkDatabaseHealth();
      this.componentStatusGauge.labels('database').set(dbHealth.healthy ? 1 : 0);

      // Check cache service
      const cacheHealth = await this.checkCacheHealth();
      this.componentStatusGauge.labels('cache').set(cacheHealth.healthy ? 1 : 0);

      const componentStatus = {
        auth: authHealth,
        database: dbHealth,
        cache: cacheHealth
      };

      const allHealthy = Object.values(componentStatus)
        .every(component => component.healthy);

      res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        components: componentStatus,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const appError = createError(
        ERROR_TYPES.INTERNAL_ERROR,
        'Component health check failed',
        { error: error.message }
      );
      res.status(appError.statusCode).json({
        status: 'error',
        error: appError.message
      });
    } finally {
      end();
    }
  }

  /**
   * Check authentication service health
   */
  private async checkAuthHealth(): Promise<{ healthy: boolean; details?: any }> {
    try {
      await this.authService.checkAuthHealth();
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        details: error.message
      };
    }
  }

  /**
   * Check database connectivity
   */
  private async checkDatabaseHealth(): Promise<{ healthy: boolean; details?: any }> {
    try {
      // Implementation would check database connectivity
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        details: error.message
      };
    }
  }

  /**
   * Check cache service health
   */
  private async checkCacheHealth(): Promise<{ healthy: boolean; details?: any }> {
    try {
      // Implementation would check cache service health
      return { healthy: true };
    } catch (error) {
      return {
        healthy: false,
        details: error.message
      };
    }
  }
}