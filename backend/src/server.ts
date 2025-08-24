/**
 * Server Entry Point
 * File Path: backend/src/server.ts
 * 
 * Main server file that starts the Express application.
 * Handles server startup, graceful shutdown, and error handling.
 */

import { Server } from 'http';
import { createApp } from './app';
import config from './config/environment';
import { closeDatabase } from './config/database';

/**
 * Server instance
 */
let server: Server | null = null;

/**
 * Starts the Express server
 * @returns Promise that resolves when server is started
 */
async function startServer(): Promise<void> {
  try {
    console.log('Starting Penn State Meal Plan API Server...');
    console.log(`Environment: ${config.NODE_ENV}`);
    console.log(`API Version: ${config.API_VERSION}`);
    
    // Create Express app
    const app = await createApp();
    
    // Start server
    server = app.listen(config.PORT, () => {
      console.log(`Server running on port ${config.PORT}`);
      console.log(`🌐 Server URL: http://localhost:${config.PORT}`);
      console.log(`📡 API Base URL: http://localhost:${config.PORT}/api/${config.API_VERSION}`);
      console.log(`🏥 Health Check: http://localhost:${config.PORT}/health`);
      
      if (config.NODE_ENV === 'development') {
        console.log(`📖 API Docs: http://localhost:${config.PORT}/api/${config.API_VERSION}/docs`);
        console.log(`Environment Info: http://localhost:${config.PORT}/api/${config.API_VERSION}/env`);
      }
      
      console.log('🎉 Server started successfully!');
    });

    // Server error handling
    server.on('error', (error: any) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      const bind = typeof config.PORT === 'string'
        ? 'Pipe ' + config.PORT
        : 'Port ' + config.PORT;

      switch (error.code) {
        case 'EACCES':
          console.error(`${bind} requires elevated privileges`);
          process.exit(1);
          break;
        case 'EADDRINUSE':
          console.error(`${bind} is already in use`);
          process.exit(1);
          break;
        default:
          throw error;
      }
    });

    // Server listening event
    server.on('listening', () => {
      const addr = server!.address();
      const bind = typeof addr === 'string'
        ? 'pipe ' + addr
        : 'port ' + addr?.port;
      console.log(`🎯 Server listening on ${bind}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Gracefully shuts down the server
 * @returns Promise that resolves when server is shut down
 */
async function shutdownServer(): Promise<void> {
  console.log('\n🛑 Initiating graceful shutdown...');
  
  try {
    // Close HTTP server
    if (server) {
      console.log('Closing HTTP server...');
      await new Promise<void>((resolve, reject) => {
        server!.close((error) => {
          if (error) {
            console.error('Error closing HTTP server:', error);
            reject(error);
          } else {
            console.log('HTTP server closed');
            resolve();
          }
        });
      });
    }

    // Close database connections
    console.log('Closing database connections...');
    await closeDatabase();

    console.log('Graceful shutdown completed');
    process.exit(0);
    
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

/**
 * Handles uncaught exceptions
 */
process.on('uncaughtException', (error: Error) => {
  console.error('💥 Uncaught Exception:', error);
  console.error('Stack:', error.stack);
  
  // Give the process a chance to log the error, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

/**
 * Handles unhandled promise rejections
 */
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('💥 Unhandled Rejection at:', promise);
  console.error('Reason:', reason);
  
  // Give the process a chance to log the error, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

/**
 * Handles process termination signals
 */
process.on('SIGTERM', () => {
  console.log('📨 SIGTERM signal received');
  shutdownServer();
});

process.on('SIGINT', () => {
  console.log('📨 SIGINT signal received (Ctrl+C)');
  shutdownServer();
});

/**
 * Handle process warnings
 */
process.on('warning', (warning) => {
  if (config.NODE_ENV === 'development') {
    console.warn('Process Warning:', warning.name);
    console.warn('Message:', warning.message);
    console.warn('Stack:', warning.stack);
  }
});

/**
 * Memory usage monitoring (development only)
 */
if (config.NODE_ENV === 'development') {
  setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const rss = Math.round(memoryUsage.rss / 1024 / 1024);
    const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const heapTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    
    // Only log if memory usage is high
    if (rss > 100 || heapUsed > 50) {
      console.log(`Memory Usage: RSS ${rss}MB, Heap Used ${heapUsed}MB, Heap Total ${heapTotal}MB`);
    }
  }, 30000); // Check every 30 seconds
}

/**
 * Log startup banner
 */
console.log('');
console.log('╔══════════════════════════════════════╗');
console.log('║      Penn State Meal Plan API       ║');
console.log('║         Backend Service              ║');
console.log('╚══════════════════════════════════════╝');
console.log('');

// Start the server
startServer().catch((error) => {
  console.error('Fatal error starting server:', error);
  process.exit(1);
});

export { server, startServer, shutdownServer };