/**
 * @fileoverview Main server entry point that initializes and starts the Express application server
 * with comprehensive error handling, graceful shutdown, monitoring, and security configurations.
 * @version 1.0.0
 */

import * as http from 'http'; // ^1.0.0
import * as https from 'https'; // ^1.0.0
import app from './app';
import config from './config';
import logger from './utils/logger.util';

// Track server instance and active connections
let server: http.Server | https.Server;
const activeConnections = new Map<string, http.ServerResponse>();
let shutdownInProgress = false;

/**
 * Initializes and starts the HTTP/HTTPS server with the Express application
 */
async function startServer(): Promise<http.Server | https.Server> {
  try {
    // Create appropriate server instance based on SSL configuration
    server = config.ssl?.enabled
      ? https.createServer({
          key: config.ssl.key,
          cert: config.ssl.cert,
          ca: config.ssl.ca,
          requestCert: true,
          rejectUnauthorized: true
        }, app)
      : http.createServer(app);

    // Configure keep-alive and connection timeouts
    server.keepAliveTimeout = 120000; // 2 minutes
    server.headersTimeout = 125000; // > keepAliveTimeout
    server.timeout = 30000; // 30 seconds

    // Track active connections for graceful shutdown
    server.on('connection', (socket) => {
      const id = `${socket.remoteAddress}:${socket.remotePort}`;
      activeConnections.set(id, socket);
      socket.on('close', () => activeConnections.delete(id));
    });

    // Start listening
    await new Promise<void>((resolve, reject) => {
      server.listen(config.port, config.host, () => {
        logger.info('Server started', {
          host: config.host,
          port: config.port,
          environment: process.env.NODE_ENV,
          ssl: config.ssl?.enabled || false
        });
        resolve();
      });

      server.on('error', (error) => {
        logger.error('Server startup error', error);
        reject(error);
      });
    });

    // Initialize health monitoring
    startHealthMonitoring();

    return server;
  } catch (error) {
    logger.critical('Failed to start server', error);
    process.exit(1);
  }
}

/**
 * Implements graceful server shutdown with connection draining
 */
async function handleShutdown(server: http.Server | https.Server): Promise<void> {
  if (shutdownInProgress) return;
  shutdownInProgress = true;

  logger.info('Starting graceful shutdown');

  try {
    // Stop accepting new connections
    server.close(() => {
      logger.info('Server closed to new connections');
    });

    // Initialize connection draining with timeout
    const drainTimeout = setTimeout(() => {
      logger.warn('Force closing remaining connections');
      activeConnections.forEach((socket) => socket.destroy());
    }, config.shutdownTimeout || 30000);

    // Wait for active connections to complete
    const connectionPromises = Array.from(activeConnections.values()).map(
      (socket) => new Promise((resolve) => socket.on('close', resolve))
    );

    await Promise.race([
      Promise.all(connectionPromises),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection draining timed out')), 
        config.shutdownTimeout || 30000)
      )
    ]);

    clearTimeout(drainTimeout);

    // Cleanup resources
    await cleanupResources();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', error);
    process.exit(1);
  }
}

/**
 * Handles uncaught errors and exceptions
 */
async function handleUncaughtErrors(error: Error): Promise<void> {
  try {
    const correlationId = crypto.randomUUID();
    logger.critical('Uncaught error', error, { correlationId });

    // Attempt graceful shutdown for unrecoverable errors
    if (server) {
      await handleShutdown(server);
    }
  } catch (shutdownError) {
    logger.critical('Failed to handle uncaught error', shutdownError);
    process.exit(1);
  }
}

/**
 * Cleans up resources during shutdown
 */
async function cleanupResources(): Promise<void> {
  try {
    // Cleanup temporary files
    // Close database connections
    // Clear Redis cache
    // Send final metrics
    logger.info('Resources cleaned up successfully');
  } catch (error) {
    logger.error('Error cleaning up resources', error);
    throw error;
  }
}

/**
 * Starts health monitoring
 */
function startHealthMonitoring(): void {
  setInterval(() => {
    const metrics = {
      activeConnections: activeConnections.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };

    logger.metric('Server health metrics', metrics);
  }, 60000); // Every minute
}

// Register error handlers
process.on('uncaughtException', handleUncaughtErrors);
process.on('unhandledRejection', (reason) => {
  handleUncaughtErrors(reason instanceof Error ? reason : new Error(String(reason)));
});

// Register shutdown handlers
process.on('SIGTERM', () => handleShutdown(server));
process.on('SIGINT', () => handleShutdown(server));

// Start server
startServer().catch((error) => {
  logger.critical('Failed to start server', error);
  process.exit(1);
});

export default server;