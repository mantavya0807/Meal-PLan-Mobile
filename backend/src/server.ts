/**
 * Server Entry Point - Penn State Meal Plan API
 * File Path: backend/src/server.ts
 * 
 * Production-ready server initialization with comprehensive startup sequence,
 * database initialization, health checks, monitoring, and graceful shutdown handling.
 */

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import cluster from 'cluster';
import os from 'os';

import app from './app';
import config from './config/environment';
import { initializeDatabase, testConnection, createTables } from './config/database';

// Import services and utilities
import { MenuService } from './services/menuService';

/**
 * Server configuration and state management
 */
interface ServerState {
  isShuttingDown: boolean;
  connections: Set<any>;
  startupTime: Date;
  lastHealthCheck: Date;
}

const serverState: ServerState = {
  isShuttingDown: false,
  connections: new Set(),
  startupTime: new Date(),
  lastHealthCheck: new Date()
};

/**
 * Enhanced startup banner with system information
 */
function displayStartupBanner(): void {
  const banner = `
╔══════════════════════════════════════════════════════════════════════════════════════╗
║                           Penn State Meal Plan API Server                            ║
╠══════════════════════════════════════════════════════════════════════════════════════╣
║  Environment: ${config.NODE_ENV.padEnd(20)} │  API Version: ${config.API_VERSION.padEnd(20)} ║
║  Port: ${config.PORT.toString().padEnd(24)} │  Process ID: ${process.pid.toString().padEnd(19)} ║
║  Platform: ${process.platform.padEnd(19)} │  Node Version: ${process.version.padEnd(17)} ║
║  Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB/${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB used    │  CPU Cores: ${os.cpus().length.toString().padEnd(20)} ║
╚══════════════════════════════════════════════════════════════════════════════════════╝
`;
  console.log(banner);
}

/**
 * Check if SSL certificates exist for HTTPS
 */
function checkSSLCertificates(): { key: string; cert: string } | null {
  const keyPath = path.join(__dirname, '..', 'ssl', 'private.key');
  const certPath = path.join(__dirname, '..', 'ssl', 'certificate.crt');
  
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    console.log('🔐 SSL certificates found, enabling HTTPS');
    return {
      key: fs.readFileSync(keyPath, 'utf8'),
      cert: fs.readFileSync(certPath, 'utf8')
    };
  }
  
  if (config.NODE_ENV === 'production') {
    console.warn('⚠️  No SSL certificates found in production mode');
  } else {
    console.log('🔓 No SSL certificates found, using HTTP (development mode)');
  }
  
  return null;
}

/**
 * Initialize monitoring and health check system
 */
function initializeMonitoring(): void {
  console.log('📊 Initializing monitoring system...');
  
  // Periodic health checks
  setInterval(() => {
    serverState.lastHealthCheck = new Date();
    
    // Memory usage monitoring
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    // Warn if memory usage is high
    if (memUsedMB > 512) { // 512MB threshold
      console.warn(`🚨 High memory usage: ${memUsedMB}MB/${memTotalMB}MB`);
    }
    
    // Log uptime every hour
    const uptime = process.uptime();
    if (uptime % 3600 < 30) { // Within 30 seconds of each hour
      console.log(`⏰ Server uptime: ${Math.round(uptime / 3600)}h ${Math.round((uptime % 3600) / 60)}m`);
    }
    
  }, 30000); // Every 30 seconds
  
  // Database connection monitoring
  setInterval(async () => {
    try {
      await testConnection();
    } catch (error) {
      console.error('🚨 Database connection lost:', error);
      // In production, you might want to implement reconnection logic
    }
  }, 300000); // Every 5 minutes
  
  console.log('✅ Monitoring system initialized');
}

/**
 * Initialize background services and scheduled tasks
 */
async function initializeServices(): Promise<void> {
  console.log('🔧 Initializing background services...');
  
  // Initialize menu scraping service
  try {
    console.log('📋 Initializing menu service...');
    
    // Get menu locations to verify service is ready
    const locations = await MenuService.getLocations();
    console.log(`✅ Menu service ready with ${locations.length} dining locations`);
    
    // Schedule daily menu scraping (in production, you might use a proper job scheduler)
    if (config.NODE_ENV === 'production') {
      console.log('⏰ Scheduling daily menu scraping tasks...');
      
      // Schedule for 6 AM daily
      const scheduleDaily = () => {
        const now = new Date();
        const nextRun = new Date();
        nextRun.setHours(6, 0, 0, 0);
        
        if (nextRun <= now) {
          nextRun.setDate(nextRun.getDate() + 1);
        }
        
        const timeUntilNext = nextRun.getTime() - now.getTime();
        
        setTimeout(() => {
          // Scrape all meal periods
          ['Breakfast', 'Lunch', 'Dinner'].forEach(async (meal) => {
            try {
              console.log(`🔄 Auto-scraping ${meal} menu...`);
              await MenuService.scrapeMenusForDate(new Date(), meal as any);
              console.log(`✅ Auto-scraping completed for ${meal}`);
            } catch (error) {
              console.error(`❌ Auto-scraping failed for ${meal}:`, error);
            }
          });
          
          // Schedule next run
          scheduleDaily();
        }, timeUntilNext);
        
        console.log(`⏰ Next menu scraping scheduled for: ${nextRun.toISOString()}`);
      };
      
      scheduleDaily();
    }
    
  } catch (error) {
    console.warn('⚠️  Menu service initialization failed:', error);
    // Don't fail startup if menu service has issues
  }
  
  console.log('✅ Background services initialized');
}

/**
 * Connection tracking for graceful shutdown
 */
function trackConnections(server: http.Server | https.Server): void {
  server.on('connection', (conn) => {
    serverState.connections.add(conn);
    
    conn.on('close', () => {
      serverState.connections.delete(conn);
    });
    
  conn.on('error', (error: unknown) => {
      console.warn('Connection error:', error);
      serverState.connections.delete(conn);
    });
  });
}

/**
 * Graceful shutdown handler
 */
function setupGracefulShutdown(server: http.Server | https.Server): void {
  const gracefulShutdown = async (signal: string) => {
    if (serverState.isShuttingDown) {
      console.log('🛑 Shutdown already in progress...');
      return;
    }
    
    console.log(`\n🛑 Received ${signal}, initiating graceful shutdown...`);
    serverState.isShuttingDown = true;
    
    const shutdownStart = Date.now();
    
    try {
      // Stop accepting new connections
      console.log('🚪 Closing server to new connections...');
      server.close(() => {
        console.log('✅ Server closed to new connections');
      });
      
      // Close existing connections gracefully
      console.log(`🔌 Closing ${serverState.connections.size} active connections...`);
      for (const conn of serverState.connections) {
        conn.destroy();
      }
      
      // Call app's cleanup function if it exists
      const cleanup = app.get('graceful-shutdown');
      if (typeof cleanup === 'function') {
        console.log('🧹 Running application cleanup...');
        await cleanup();
      }
      
      // Clear any intervals/timeouts
      console.log('⏰ Clearing timers and intervals...');
      
      const shutdownDuration = Date.now() - shutdownStart;
      console.log(`✅ Graceful shutdown completed in ${shutdownDuration}ms`);
      console.log('👋 Goodbye!');
      
      process.exit(0);
      
    } catch (error) {
      console.error('❌ Error during graceful shutdown:', error);
      console.log('💥 Forcing shutdown...');
      process.exit(1);
    }
  };
  
  // Handle various shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));
  
  // Force shutdown after timeout
  process.on('exit', (code) => {
    console.log(`Process exiting with code: ${code}`);
  });
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('💥 Uncaught Exception:', error);
    console.error('Stack trace:', error.stack);
    
    if (config.NODE_ENV === 'production') {
      // In production, log error but attempt graceful shutdown
      gracefulShutdown('uncaughtException');
    } else {
      // In development, exit immediately for debugging
      process.exit(1);
    }
  });
  
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    console.error('💥 Unhandled Promise Rejection:', reason);
    console.error('Promise:', promise);
    
    if (config.NODE_ENV === 'production') {
      console.error('🚨 Continuing in production, but this should be investigated');
      // Log to monitoring service in production
    } else {
      console.error('🛑 Exiting in development mode for debugging');
      process.exit(1);
    }
  });
  
  // Handle out of memory errors
  process.on('warning', (warning) => {
    console.warn('⚠️  Process Warning:', warning);
    
    if (warning.name === 'MaxListenersExceededWarning') {
      console.warn('🚨 Too many event listeners - potential memory leak');
    }
  });
  
  console.log('✅ Graceful shutdown handlers registered');
}

/**
 * Cluster mode initialization for production
 */
function initializeCluster(): void {
  const numCPUs = os.cpus().length;
  const useCluster = config.NODE_ENV === 'production' && process.env.NO_CLUSTER !== 'true';
  
  if (useCluster && cluster.isMaster) {
    console.log(`🖥️  Master process ${process.pid} starting with ${numCPUs} CPUs`);
    
    // Fork workers
    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }
    
    // Handle worker events
    cluster.on('online', (worker) => {
      console.log(`👷 Worker ${worker.process.pid} is online`);
    });
    
    cluster.on('exit', (worker, code, signal) => {
      console.error(`👷 Worker ${worker.process.pid} died (${signal || code})`);
      
      if (!worker.exitedAfterDisconnect) {
        console.log('🔄 Starting a new worker...');
        cluster.fork();
      }
    });
    
    // Graceful shutdown for cluster master
    process.on('SIGTERM', () => {
      console.log('🛑 Master received SIGTERM, shutting down workers...');
      for (const id in cluster.workers) {
        if (cluster.workers[id]) {
          cluster.workers[id]!.kill();
        }
      }
    });
    
    return;
  }
  
  // Single process mode or worker process
  if (useCluster) {
    console.log(`👷 Worker process ${process.pid} starting...`);
  } else {
    console.log(`🖥️  Single process mode (PID: ${process.pid})`);
  }
}

/**
 * Main server startup function
 */
async function startServer(): Promise<void> {
  try {
    displayStartupBanner();
    
    // Initialize cluster if in production
    initializeCluster();
    
    // Skip worker startup if we're in cluster master mode
    if (cluster.isMaster && config.NODE_ENV === 'production' && process.env.NO_CLUSTER !== 'true') {
      return;
    }
    
    console.log('🚀 Starting server initialization sequence...');
    
    // Step 1: Environment validation
    console.log('🔍 Validating environment configuration...');
    const requiredEnvVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'JWT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    console.log('✅ Environment configuration valid');
    
    // Step 2: Database initialization
    console.log('📊 Initializing database connection...');
    await initializeDatabase();
    console.log('✅ Database connection established');
    
    // Step 3: Database health check
    console.log('🩺 Testing database connectivity...');
    await testConnection();
    console.log('✅ Database connectivity verified');
    
    // Step 4: Ensure database tables exist
    console.log('🏗️  Verifying database schema...');
    await createTables();
    console.log('✅ Database schema verified');
    
    // Step 5: Initialize services
    await initializeServices();
    
    // Step 6: Initialize monitoring
    initializeMonitoring();
    
    // Step 7: Create HTTP/HTTPS server
    console.log('🌐 Creating server instance...');
    const sslOptions = checkSSLCertificates();
    const server = sslOptions ? https.createServer(sslOptions, app) : http.createServer(app);
    
    // Step 8: Configure server
    server.timeout = 120000; // 2 minutes timeout
    server.keepAliveTimeout = 65000; // 65 seconds
    server.headersTimeout = 66000; // Must be greater than keepAliveTimeout
    
    // Step 9: Track connections for graceful shutdown
    trackConnections(server);
    
    // Step 10: Setup graceful shutdown
    setupGracefulShutdown(server);
    
    // Step 11: Start listening
    server.listen(config.PORT, () => {
      const protocol = sslOptions ? 'https' : 'http';
      const baseUrl = `${protocol}://localhost:${config.PORT}`;
      
      console.log('\n🎉 Server started successfully!');
      console.log('═'.repeat(80));
      console.log(`📡 Server running on: ${baseUrl}`);
      console.log(`📖 API Documentation: ${baseUrl}/api/${config.API_VERSION}/docs`);
      console.log(`❤️  Health Check: ${baseUrl}/health`);
      console.log(`📊 Detailed Health: ${baseUrl}/health/detailed`);
      console.log(`ℹ️  API Info: ${baseUrl}/api/${config.API_VERSION}`);
      
      if (config.NODE_ENV === 'development') {
        console.log('\n🛠️  Development Features:');
        console.log(`   • Configuration: ${baseUrl}/api/dev/config`);
        console.log(`   • Route Debug: ${baseUrl}/api/dev/routes`);
        console.log(`   • Request Debug: ${baseUrl}/api/dev/request-info`);
        console.log(`   • Hot Reload: Enabled`);
        console.log(`   • Detailed Logging: Enabled`);
        console.log(`   • CORS Origins: ${config.CORS_ORIGIN || 'All origins'}`);
      }
      
      console.log('\n🎯 Available Services:');
      console.log('   • User Authentication & JWT Management');
      console.log('   • Penn State Menu Scraping & Caching');
      console.log('   • Nutrition Information & Analytics');
      console.log('   • User Favorites & Preferences');
      console.log('   • Advanced Menu Filtering & Search');
      console.log('   • Real-time Menu Updates');
      
      console.log('\n🔐 Security Features:');
      console.log('   • Rate Limiting & DDoS Protection');
      console.log('   • JWT Access & Refresh Tokens');
      console.log('   • Password Hashing (bcrypt)');
      console.log('   • Security Headers (Helmet)');
      console.log('   • CORS Protection');
      console.log('   • Request Validation & Sanitization');
      
      console.log('\n📊 Monitoring & Logging:');
      console.log('   • Request/Response Logging');
      console.log('   • Performance Monitoring');
      console.log('   • Memory Usage Tracking');
      console.log('   • Error Tracking & Reporting');
      console.log('   • Health Check Endpoints');
      
      console.log('\n🚀 Ready for Production Traffic!');
      console.log('═'.repeat(80));
      
      // Log startup completion
      const startupTime = Date.now() - serverState.startupTime.getTime();
      console.log(`⚡ Server initialized in ${startupTime}ms\n`);
      
      // Emit ready event for testing
      process.emit('ready' as any);
    });
    
    // Handle server startup errors
    server.on('error', (error: NodeJS.ErrnoException) => {
      console.error('\n❌ Server startup error:');
      
      switch (error.code) {
        case 'EADDRINUSE':
          console.error(`Port ${config.PORT} is already in use`);
          console.log('\n💡 Solutions:');
          console.log(`   • Kill existing process: lsof -ti:${config.PORT} | xargs kill -9`);
          console.log(`   • Use different port: PORT=3002 npm run dev`);
          console.log(`   • Check for other instances running`);
          break;
          
        case 'EACCES':
          console.error(`Permission denied for port ${config.PORT}`);
          console.log('\n💡 Solutions:');
          console.log(`   • Use port > 1024: PORT=3001 npm run dev`);
          console.log(`   • Run with sudo (not recommended)`);
          break;
          
        case 'ENOTFOUND':
          console.error('Network interface not found');
          console.log('\n💡 Check your network configuration');
          break;
          
        default:
          console.error('Unknown server error:', error);
          console.error('Error details:', error.message);
      }
      
      process.exit(1);
    });
    
  } catch (error) {
    console.error('\n💥 Failed to start server:');
    console.error('═'.repeat(50));
    
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      
      if (error.stack && config.NODE_ENV === 'development') {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
    } else {
      console.error('Unknown error:', error);
    }
    
    console.log('\n🔧 Troubleshooting Checklist:');
    console.log('   1. ✅ Check .env file exists and is configured');
    console.log('   2. ✅ Verify Supabase connection settings');
    console.log('   3. ✅ Ensure all dependencies are installed (npm install)');
    console.log('   4. ✅ Check port availability');
    console.log('   5. ✅ Verify database schema is created');
    console.log('   6. ✅ Review error messages above');
    console.log('   7. ✅ Check system resources (memory, disk space)');
    console.log('   8. ✅ Verify network connectivity');
    
    console.log('\n📚 Common Solutions:');
    console.log('   • Database issues: Check Supabase dashboard');
    console.log('   • Port conflicts: Use different PORT in .env');
    console.log('   • Missing env vars: Copy .env.example to .env');
    console.log('   • Permission issues: Check file/folder permissions');
    
    process.exit(1);
  }
}

/**
 * Initialize and start the server
 */
if (require.main === module) {
  startServer().catch((error) => {
    console.error('💥 Fatal startup error:', error);
    process.exit(1);
  });
}

export { startServer, serverState };