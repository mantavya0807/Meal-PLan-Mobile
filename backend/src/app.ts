/**
 * Express App Configuration
 * File Path: backend/src/app.ts
 * 
 * Main Express application setup with middleware, routes, and error handling.
 * Configures security, CORS, rate limiting, and API endpoints.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import config, { getCorsOptions } from './config/environment';
import { initializeDatabase, getDatabaseHealth } from './config/database';
import authRoutes from './routes/authRoutes';
import { rateLimitGeneral } from './middleware/rateLimiter';
import { handleAuthError } from './middleware/auth';
import { sanitizeRequestBody } from './middleware/validation';
import { ApiResponse, HttpStatusCodes } from './types';

/**
 * Creates and configures the Express application
 * @returns Configured Express app instance
 */
export async function createApp(): Promise<Application> {
  const app: Application = express();

  // Initialize database connection
  await initializeDatabase();

  /**
   * Security Middleware
   */
  // Helmet for security headers
  app.use(helmet({
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
  }));

  // CORS configuration
  app.use(cors(getCorsOptions()));

  /**
   * Request Processing Middleware
   */
  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Input sanitization
  app.use(sanitizeRequestBody);

  // Request logging (development and staging)
  if (config.NODE_ENV !== 'production') {
    app.use(morgan('combined'));
  } else {
    app.use(morgan('combined', {
      skip: (req: Request, res: Response) => res.statusCode < 400
    }));
  }

  // General rate limiting
  app.use(rateLimitGeneral);

  /**
   * Request Context Middleware
   */
  // Add request ID and timestamp
  app.use((req: Request, res: Response, next: NextFunction) => {
    (req as any).requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    (req as any).startTime = Date.now();
    
    // Add request ID to response headers
    res.setHeader('X-Request-ID', (req as any).requestId);
    
    next();
  });

  // Add API version to response headers
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-API-Version', config.API_VERSION);
    res.setHeader('X-Service', 'pennstate-mealplan-api');
    next();
  });

  /**
   * Health Check Routes (before authentication)
   */
  // Basic health check
  app.get('/health', async (req: Request, res: Response) => {
    try {
      const dbHealth = await getDatabaseHealth();
      const uptime = process.uptime();
      
      const response: ApiResponse = {
        success: true,
        message: 'Service is healthy',
        data: {
          service: 'pennstate-mealplan-api',
          version: config.API_VERSION,
          environment: config.NODE_ENV,
          uptime: {
            seconds: Math.floor(uptime),
            formatted: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
          },
          database: dbHealth,
          timestamp: new Date().toISOString(),
          memoryUsage: process.memoryUsage(),
          nodeVersion: process.version,
        },
        timestamp: new Date().toISOString(),
      };

      const statusCode = dbHealth.status === 'healthy' 
        ? HttpStatusCodes.OK 
        : HttpStatusCodes.SERVICE_UNAVAILABLE;
      
      res.status(statusCode).json(response);
    } catch (error) {
      console.error('Health check error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Service health check failed',
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };
      
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  });

  // Detailed health check for monitoring
  app.get('/health/detailed', async (req: Request, res: Response) => {
    try {
      const dbHealth = await getDatabaseHealth();
      const uptime = process.uptime();
      const memoryUsage = process.memoryUsage();
      
      const response: ApiResponse = {
        success: dbHealth.status === 'healthy',
        message: `Service is ${dbHealth.status === 'healthy' ? 'healthy' : 'unhealthy'}`,
        data: {
          service: 'pennstate-mealplan-api',
          version: config.API_VERSION,
          environment: config.NODE_ENV,
          uptime: {
            seconds: Math.floor(uptime),
            minutes: Math.floor(uptime / 60),
            hours: Math.floor(uptime / 3600),
            days: Math.floor(uptime / 86400),
            formatted: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`,
          },
          database: dbHealth,
          memory: {
            rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
            heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
            heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
            external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
          },
          system: {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            cpuUsage: process.cpuUsage(),
          },
          timestamp: new Date().toISOString(),
        },
        timestamp: new Date().toISOString(),
      };

      const statusCode = dbHealth.status === 'healthy' 
        ? HttpStatusCodes.OK 
        : HttpStatusCodes.SERVICE_UNAVAILABLE;
      
      res.status(statusCode).json(response);
    } catch (error) {
      console.error('Detailed health check error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Detailed health check failed',
        timestamp: new Date().toISOString(),
      };
      
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  });

  /**
   * API Routes
   */
  // API root endpoint
  app.get(`/api/${config.API_VERSION}`, (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      message: 'Penn State Meal Plan API',
      data: {
        name: 'Penn State Meal Plan API',
        version: config.API_VERSION,
        description: 'Unofficial API for Penn State meal plan management',
        environment: config.NODE_ENV,
        documentation: `/api/${config.API_VERSION}/docs`,
        endpoints: {
          authentication: `/api/${config.API_VERSION}/auth`,
          health: '/health',
        },
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(HttpStatusCodes.OK).json(response);
  });

  // Authentication routes
  app.use(`/api/${config.API_VERSION}/auth`, authRoutes);

  /**
   * Development Routes (only in development/staging)
   */
  if (config.NODE_ENV !== 'production') {
    // API documentation placeholder
    app.get(`/api/${config.API_VERSION}/docs`, (req: Request, res: Response) => {
      const response = {
        success: true,
        message: 'API Documentation',
        data: {
          endpoints: {
            'POST /auth/register': 'Register a new user account',
            'POST /auth/login': 'Authenticate user and get tokens',
            'POST /auth/forgot-password': 'Request password reset',
            'POST /auth/reset-password': 'Reset password with token',
            'POST /auth/refresh-token': 'Refresh access token',
            'GET /auth/me': 'Get current user profile (protected)',
            'POST /auth/logout': 'Logout user (protected)',
            'GET /auth/health': 'Authentication service health check',
          },
          authentication: {
            type: 'Bearer Token (JWT)',
            header: 'Authorization: Bearer <access_token>',
            tokenExpiry: config.JWT_EXPIRES_IN,
            refreshTokenExpiry: config.JWT_REFRESH_EXPIRES_IN,
          },
          rateLimit: {
            general: `${config.RATE_LIMIT_MAX_REQUESTS} requests per ${config.RATE_LIMIT_WINDOW_MS / 1000 / 60} minutes`,
            auth: '10 requests per 15 minutes',
            passwordReset: '5 requests per hour',
          },
        },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);
    });

    // Environment info endpoint
    app.get(`/api/${config.API_VERSION}/env`, (req: Request, res: Response) => {
      const response: ApiResponse = {
        success: true,
        message: 'Environment Information',
        data: {
          environment: config.NODE_ENV,
          nodeVersion: process.version,
          platform: process.platform,
          apiVersion: config.API_VERSION,
          port: config.PORT,
          corsOrigin: config.CORS_ORIGIN,
          jwtExpiry: config.JWT_EXPIRES_IN,
          bcryptRounds: config.BCRYPT_SALT_ROUNDS,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);
    });
  }

  /**
   * Error Handling Middleware
   */
  // Handle 404 errors
  app.use('*', (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: false,
      message: `Route ${req.method} ${req.originalUrl} not found`,
      data: {
        method: req.method,
        path: req.originalUrl,
        availableRoutes: [
          '/health',
          '/health/detailed',
          `/api/${config.API_VERSION}`,
          `/api/${config.API_VERSION}/auth/*`,
        ],
      },
      timestamp: new Date().toISOString(),
    };

    res.status(HttpStatusCodes.NOT_FOUND).json(response);
  });

  // Authentication error handler
  app.use(handleAuthError);

  // Global error handler
  app.use((error: any, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', error);

    const statusCode = error.statusCode || HttpStatusCodes.INTERNAL_SERVER_ERROR;
    const message = error.message || 'Internal server error';

    const response: ApiResponse = {
      success: false,
      message,
      ...(config.NODE_ENV === 'development' && {
        data: {
          error: error.message,
          stack: error.stack,
          requestId: (req as any).requestId,
        },
      }),
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
  });

  /**
   * Request Duration Logging
   */
  app.use((req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(body?: any) {
      const duration = Date.now() - (req as any).startTime;
      
      if (config.NODE_ENV === 'development' && duration > 1000) {
        console.warn(`Slow request: ${req.method} ${req.path} took ${duration}ms`);
      }
      
      // Add duration to response headers
      res.setHeader('X-Response-Time', `${duration}ms`);
      
      return originalSend.call(this, body);
    };
    
    next();
  });

  console.log('Express app configured successfully');
  return app;
}

export default createApp;