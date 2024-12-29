/**
 * Monitoring Interfaces
 * Version: 1.0.0
 * 
 * Comprehensive TypeScript interfaces for system monitoring, health checks,
 * performance metrics, and error tracking. Includes enhanced security monitoring
 * capabilities and extensible metric definitions.
 */

/**
 * Enum representing possible system health status values
 * Used for overall system and individual component health tracking
 */
export enum HealthStatus {
    HEALTHY = 'HEALTHY',        // System/component is fully operational
    DEGRADED = 'DEGRADED',      // System/component is operational but with reduced performance
    UNHEALTHY = 'UNHEALTHY',    // System/component is non-operational
    MAINTENANCE = 'MAINTENANCE'  // System/component is undergoing planned maintenance
}

/**
 * Enum representing different types of system errors
 * Used for error classification and appropriate response handling
 */
export enum ErrorType {
    API_ERROR = 'API_ERROR',                    // API-related errors
    SCRAPER_ERROR = 'SCRAPER_ERROR',            // Web scraping failures
    VALIDATION_ERROR = 'VALIDATION_ERROR',       // Data validation issues
    AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR', // Auth/permission failures
    SECURITY_VIOLATION = 'SECURITY_VIOLATION',   // Security-related incidents
    RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED'  // Rate limiting violations
}

/**
 * Enum for alert severity levels
 * Used to classify the urgency of system alerts
 */
export enum AlertSeverity {
    CRITICAL = 'CRITICAL',   // Immediate attention required
    HIGH = 'HIGH',          // Urgent attention needed
    MEDIUM = 'MEDIUM',      // Important but not urgent
    LOW = 'LOW',           // Informational alert
}

/**
 * Interface for comprehensive system health information
 * Tracks overall system status and component-level health
 */
export interface SystemHealth {
    status: HealthStatus;                        // Overall system health status
    uptime: number;                             // System uptime in seconds
    lastCheck: Date;                            // Timestamp of last health check
    message: string;                            // Optional status message
    componentStatus: Record<string, HealthStatus>; // Health status by component
    alerts: Alert[];                            // Active system alerts
}

/**
 * Interface for detailed system performance metrics
 * Tracks key performance indicators and resource utilization
 */
export interface PerformanceMetrics {
    responseTime: number;      // Average response time in milliseconds
    concurrentUsers: number;   // Current number of active users
    cpuUsage: number;         // CPU utilization percentage
    memoryUsage: number;      // Memory utilization percentage
    timestamp: Date;          // Metric collection timestamp
    requestRate: number;      // Requests per second
    errorRate: number;        // Error rate percentage
    networkLatency: number;   // Network latency in milliseconds
}

/**
 * Interface for system alerts and notifications
 * Used for tracking and managing system incidents
 */
export interface Alert {
    alertId: string;          // Unique alert identifier
    severity: AlertSeverity;  // Alert severity level
    message: string;          // Alert description
    timestamp: Date;          // Alert generation timestamp
    component: string;        // Affected system component
    threshold: number;        // Threshold that triggered the alert
}

/**
 * Interface for component-specific monitoring thresholds
 * Defines acceptable ranges for various metrics
 */
export interface MonitoringThresholds {
    maxResponseTime: number;      // Maximum acceptable response time (ms)
    maxCpuUsage: number;         // Maximum acceptable CPU usage (%)
    maxMemoryUsage: number;      // Maximum acceptable memory usage (%)
    maxErrorRate: number;        // Maximum acceptable error rate (%)
    maxConcurrentUsers: number;  // Maximum supported concurrent users
}

/**
 * Interface for security-specific monitoring metrics
 * Tracks security-related events and violations
 */
export interface SecurityMetrics {
    failedLogins: number;         // Number of failed login attempts
    securityIncidents: number;    // Number of security incidents
    activeThreats: number;        // Number of active security threats
    lastSecurityScan: Date;       // Timestamp of last security scan
    vulnerabilitiesFound: number; // Number of vulnerabilities detected
}

/**
 * Interface for scraper-specific monitoring
 * Tracks web scraping performance and status
 */
export interface ScraperMetrics {
    activeScrapers: number;       // Number of active scraper instances
    successfulScrapes: number;    // Number of successful scrapes
    failedScrapes: number;        // Number of failed scrapes
    averageScrapeDuration: number; // Average scrape duration in seconds
    rateLimitHits: number;        // Number of rate limit violations
}

/**
 * Type for historical metric data points
 * Used for tracking metric history and trend analysis
 */
export type MetricDataPoint = {
    timestamp: Date;
    value: number;
    metadata?: Record<string, unknown>;
};

/**
 * Interface for metric history tracking
 * Maintains historical performance data
 */
export interface MetricHistory {
    metricName: string;
    dataPoints: MetricDataPoint[];
    aggregationType: 'avg' | 'max' | 'min' | 'sum';
    retentionPeriod: number; // in days
}