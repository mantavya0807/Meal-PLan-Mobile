/**
 * Express Application Setup - Penn State Meal Plan API
 * File Path: backend/src/app.ts
 * 
 * Comprehensive Express application with security, middleware, routing,
 * error handling, logging, and production-ready configurations.
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import path from 'path';

// Import configuration
import config from './config/environment';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFoundHandler } from './middleware/notFoundHandler';
import { requestLogger } from './middleware/requestLogger';
import { validateApiKey } from './middleware/apiKey';
import { corsOptions } from './middleware/corsConfig';

// Import route modules
import authRoutes from './routes/authRoutes';
import menuRoutes from './routes/menuRoutes';
import { startMenuCron } from './services/menuCron';

// Debug route registration
console.log('🔍 Registering routes...');
console.log('✅ menuRoutes type:', typeof menuRoutes);
console.log('✅ menuRoutes is function:', typeof menuRoutes === 'function');
console.log('✅ authRoutes type:', typeof authRoutes);

/**
 * Create Express application instance
 */
const app: Express = express();

// Start menu cron service
startMenuCron().catch(err => console.error('[MenuCron] Failed to start:', err));

/**
 * Trust proxy for production deployment behind load balancers
 */
if (config.NODE_ENV === 'production') {
  app.set('trust proxy', true);
  console.log('✅ Production mode: Trusting proxy headers');
} else {
  console.log('🛠️  Development mode: Direct connection');
}

/**
 * Create logs directory if it doesn't exist
 */
const logsDir = path.join(__dirname, '..', 'logs');
if (!existsSync(logsDir)) {
  mkdirSync(logsDir, { recursive: true });
  console.log('📁 Created logs directory');
}

/**
 * Configure comprehensive logging
 */
const accessLogStream = createWriteStream(path.join(logsDir, 'access.log'), { flags: 'a' });

// Custom Morgan tokens for enhanced logging
morgan.token('request-id', (req: any) => req.requestId);
morgan.token('user-id', (req: any) => req.userId || 'anonymous');
morgan.token('real-ip', (req) => {
  const ip = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
  return Array.isArray(ip) ? ip[0] : ip;
});

const logFormat = ':real-ip - :user-id [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms :request-id';

/**
 * Security headers and protection middleware
 */
app.use(helmet({
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
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false, // Allow embedding for mobile apps
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: config.NODE_ENV === 'production'
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" }
}));

/**
 * CORS configuration with dynamic origins
 */
const corsConfig = {
  origin: function (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = config.CORS_ORIGIN ? config.CORS_ORIGIN.split(',') : [];
    
    // In development, allow localhost with any port
    if (config.NODE_ENV === 'development') {
      if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return callback(null, true);
      }
    }
    
    // Check against configured origins
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }
    
    console.warn(`🚫 CORS blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With', 
    'X-Request-ID',
    'X-API-Key',
    'Cache-Control'
  ],
  exposedHeaders: [
    'X-Total-Count', 
    'X-Page-Count', 
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining'
  ],
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsConfig));

/**
 * Request preprocessing middleware
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  // Generate unique request ID for tracing
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  req.headers['x-request-id'] = requestId;
  (req as any).requestId = requestId;
  
  // Add request timestamp
  (req as any).startTime = Date.now();
  
  // Add request ID to response headers
  res.set('X-Request-ID', requestId);
  
  // Security headers
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'DENY');
  res.set('X-XSS-Protection', '1; mode=block');
  
  next();
});

/**
 * Rate limiting configuration
 */
const createRateLimiter = (windowMs: number, max: number, message: string) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: 'Too many requests',
      message,
      retryAfter: Math.ceil(windowMs / 1000),
      timestamp: new Date().toISOString(),
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      console.warn(`🚨 Rate limit exceeded - IP: ${req.ip}, Path: ${req.path}, User-Agent: ${req.headers['user-agent']}`);
      res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        message,
        retryAfter: Math.ceil(windowMs / 1000),
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString(),
      });
    },
  });
};

// General API rate limiting
const generalLimiter = createRateLimiter(
  config.RATE_LIMIT_WINDOW_MS || 900000, // 15 minutes
  config.RATE_LIMIT_MAX_REQUESTS || 100,
  'Too many requests from this IP, please try again later.'
);

// Strict rate limiting for sensitive operations
const strictLimiter = createRateLimiter(
  900000, // 15 minutes
  20,
  'Too many requests to sensitive endpoints, please try again later.'
);

// Auth-specific rate limiting
const authLimiter = createRateLimiter(
  900000, // 15 minutes
  10,
  'Too many authentication attempts, please try again later.'
);

// Speed limiting to slow down requests
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // Allow 50 requests per windowMs without delay
  delayMs: 500, // Add 500ms delay per request after delayAfter
  maxDelayMs: 20000, // Maximum delay of 20 seconds
});

app.use(generalLimiter);
app.use(speedLimiter);

/**
 * Request body parsing with size limits and validation
 */
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: ['application/json', 'text/plain']
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb',
  parameterLimit: 1000
}));

/**
 * Response compression for better performance
 */
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: config.NODE_ENV === 'production' ? 6 : 1,
  threshold: 1024,
  chunkSize: 1024,
}));

/**
 * Request logging with Morgan
 */
if (config.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan(logFormat, { stream: accessLogStream }));
  app.use(morgan('combined')); // Console logging in production
}

/**
 * Custom request logging middleware
 */
app.use(requestLogger);

/**
 * Performance monitoring middleware
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = (req as any).startTime;
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const contentLength = res.get('content-length') || '0';
    
    // Log slow requests (>1 second)
    if (duration > 1000) {
      console.warn(`🐌 Slow request: ${method} ${url} - ${statusCode} - ${duration}ms`);
    }
    
    // Log errors
    if (statusCode >= 400) {
      console.error(`❌ Error request: ${method} ${url} - ${statusCode} - ${duration}ms - ${userAgent}`);
    }
    
    // Performance metrics (in production, you'd send this to monitoring service)
    if (config.NODE_ENV === 'production') {
      // Example: send to monitoring service
      // metricsService.record('api_request_duration', duration, { method, status: statusCode });
    }
  });
  
  next();
});

/**
 * Health check endpoint with comprehensive status
 */
app.get('/health', (req: Request, res: Response) => {
  const healthcheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: config.NODE_ENV,
    memory: process.memoryUsage(),
    pid: process.pid,
    platform: process.platform,
    nodeVersion: process.version,
    requestId: (req as any).requestId,
    services: {
      database: 'connected', // This would be checked in real implementation
      redis: 'not_configured', // If you add Redis later
      external_apis: 'operational'
    }
  };
  
  res.status(200).json(healthcheck);
});

/**
 * Detailed health check for monitoring systems
 */
app.get('/health/detailed', (req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  
  const detailedHealth = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: {
      process: process.uptime(),
      system: require('os').uptime()
    },
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
      external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
    },
    cpu: {
      user: cpuUsage.user,
      system: cpuUsage.system
    },
    system: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      pid: process.pid,
      loadavg: require('os').loadavg(),
      freemem: `${Math.round(require('os').freemem() / 1024 / 1024)}MB`,
      totalmem: `${Math.round(require('os').totalmem() / 1024 / 1024)}MB`,
    },
    environment: {
      nodeEnv: config.NODE_ENV,
      port: config.PORT,
      apiVersion: config.API_VERSION
    }
  };
  
  res.status(200).json(detailedHealth);
});

/**
 * API information and documentation endpoint
 */
app.get(`/api/${config.API_VERSION}`, (req: Request, res: Response) => {
  const apiInfo = {
    name: 'Penn State Meal Plan API',
    description: 'Comprehensive API for Penn State meal plan management, dining menus, and nutrition tracking',
    version: config.API_VERSION,
    environment: config.NODE_ENV,
    status: 'operational',
    serverTime: new Date().toISOString(),
    requestId: (req as any).requestId,
    features: {
      authentication: {
        description: 'JWT-based authentication with refresh tokens',
        endpoints: ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout']
      },
      menuSystem: {
        description: 'Penn State dining menu scraping and management',
        endpoints: ['/menu/today', '/menu/items', '/menu/locations', '/menu/favorites']
      },
      userManagement: {
        description: 'User profile and preferences management',
        endpoints: ['/auth/me', '/auth/update-profile']
      }
    },
    endpoints: {
      authentication: `/api/${config.API_VERSION}/auth`,
      menu: `/api/${config.API_VERSION}/menu`,
      health: '/health',
      documentation: `/api/${config.API_VERSION}/docs`
    },
    rateLimit: {
      general: `${config.RATE_LIMIT_MAX_REQUESTS || 100} requests per ${Math.round((config.RATE_LIMIT_WINDOW_MS || 900000) / 60000)} minutes`,
      authentication: '10 requests per 15 minutes',
      sensitive: '20 requests per 15 minutes'
    },
    contact: {
      support: 'support@pennstatemealplan.com',
      documentation: `${req.protocol}://${req.get('host')}/api/${config.API_VERSION}/docs`
    }
  };
  
  res.json(apiInfo);
});

/**
 * Authentication routes with rate limiting
 */
console.log('🔗 Registering auth routes at /api/v1/auth...');
app.use(`/api/${config.API_VERSION}/auth`, authLimiter, authRoutes);

/**
 * Menu routes (mixed public and authenticated endpoints)
 */
console.log('🔗 Registering menu routes at /api/v1/menu...');
console.log('🔍 menuRoutes before registration:', menuRoutes);
app.use(`/api/${config.API_VERSION}/menu`, menuRoutes);
console.log('✅ Menu routes registered successfully');

/**
 * Development-only endpoints and debugging
 */
if (config.NODE_ENV === 'development') {
  
  // Development configuration endpoint
  app.get('/api/dev/config', (req: Request, res: Response) => {
    res.json({
      environment: config.NODE_ENV,
      port: config.PORT,
      apiVersion: config.API_VERSION,
      corsOrigin: config.CORS_ORIGIN,
      rateLimit: {
        windowMs: config.RATE_LIMIT_WINDOW_MS,
        maxRequests: config.RATE_LIMIT_MAX_REQUESTS
      },
      database: {
        connected: true, // This would check actual status
        url: config.SUPABASE_URL ? 'configured' : 'not_configured'
      },
      features: {
        jwtSecret: config.JWT_SECRET ? 'configured' : 'missing',
        bcryptRounds: config.BCRYPT_SALT_ROUNDS || 12
      },
      timestamp: new Date().toISOString()
    });
  });
  
  // Route debugging endpoint
  app.get('/api/dev/routes', (req: Request, res: Response) => {
    const routes: any[] = [];
    
    function extractRoutes(stack: any[], prefix = '') {
      stack.forEach((middleware) => {
        if (middleware.route) {
          // Direct route
          routes.push({
            method: Object.keys(middleware.route.methods).join(',').toUpperCase(),
            path: prefix + middleware.route.path,
            handler: middleware.route.stack[0]?.name || 'anonymous'
          });
        } else if (middleware.name === 'router' && middleware.handle.stack) {
          // Router middleware
          const routerPrefix = middleware.regexp.source
            .replace('\\/?', '')
            .replace('(?=\\/|$)', '')
            .replace('^', '');
          extractRoutes(middleware.handle.stack, prefix + routerPrefix);
        }
      });
    }
    
    extractRoutes(app._router.stack);
    
    res.json({
      totalRoutes: routes.length,
      routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
      timestamp: new Date().toISOString()
    });
  });
  
  // Request debugging endpoint
  app.get('/api/dev/request-info', (req: Request, res: Response) => {
    res.json({
      headers: req.headers,
      query: req.query,
      params: req.params,
      ip: req.ip,
      ips: req.ips,
      protocol: req.protocol,
      secure: req.secure,
      originalUrl: req.originalUrl,
      baseUrl: req.baseUrl,
      path: req.path,
      method: req.method,
      requestId: (req as any).requestId,
      timestamp: new Date().toISOString()
    });
  });
  
  console.log('🛠️  Development endpoints enabled:');
  console.log('   - /api/dev/config - Server configuration');
  console.log('   - /api/dev/routes - Registered routes');
  console.log('   - /api/dev/request-info - Request debugging');
}

/**
 * Comprehensive API documentation endpoint
 */
app.get(`/api/${config.API_VERSION}/docs`, (req: Request, res: Response) => {
  const documentation = {
    title: 'Penn State Meal Plan API Documentation',
    version: config.API_VERSION,
    baseUrl: `${req.protocol}://${req.get('host')}/api/${config.API_VERSION}`,
    lastUpdated: new Date().toISOString(),
    
    authentication: {
      type: 'Bearer Token',
      description: 'JWT-based authentication with access and refresh tokens',
      header: 'Authorization: Bearer <access_token>',
      tokenLifetime: {
        access: '7 days',
        refresh: '30 days'
      }
    },
    
    endpoints: {
      authentication: {
        'POST /auth/register': {
          description: 'Register a new user account',
          body: {
            firstName: 'string',
            lastName: 'string', 
            email: 'string',
            password: 'string',
            confirmPassword: 'string'
          },
          public: true
        },
        'POST /auth/login': {
          description: 'Login with email and password',
          body: {
            email: 'string',
            password: 'string'
          },
          public: true
        },
        'POST /auth/logout': {
          description: 'Logout current user and invalidate tokens',
          authenticated: true
        },
        'POST /auth/refresh': {
          description: 'Refresh access token using refresh token',
          body: {
            refreshToken: 'string'
          },
          public: true
        },
        'GET /auth/me': {
          description: 'Get current user profile information',
          authenticated: true
        }
      },
      
      menu: {
        'GET /menu/today': {
          description: 'Get today\'s menu for all or specific locations',
          query: {
            meal: 'Breakfast|Lunch|Dinner (optional)',
            locations: 'comma-separated location IDs (optional)',
            refresh: 'boolean to force refresh (optional)'
          },
          public: true
        },
        'GET /menu/items': {
          description: 'Get menu items with advanced filtering',
          query: {
            date: 'YYYY-MM-DD format (optional)',
            locationIds: 'comma-separated UUIDs (optional)',
            mealPeriods: 'comma-separated meal periods (optional)',
            isVegetarian: 'boolean (optional)',
            isVegan: 'boolean (optional)',
            isGlutenFree: 'boolean (optional)',
            minCalories: 'number (optional)',
            maxCalories: 'number (optional)',
            search: 'search term (optional)',
            limit: 'number (optional, max 200)',
            offset: 'number (optional)'
          },
          public: true
        },
        'GET /menu/locations': {
          description: 'Get all Penn State dining locations',
          public: true
        },
        'GET /menu/stats': {
          description: 'Get menu statistics and analytics',
          query: {
            date: 'YYYY-MM-DD format (optional)'
          },
          public: true
        },
        'POST /menu/scrape': {
          description: 'Manually trigger menu scraping',
          body: {
            date: 'YYYY-MM-DD (optional)',
            meal: 'Breakfast|Lunch|Dinner (optional)',
            locations: 'array of location IDs (optional)',
            force: 'boolean (optional)'
          },
          rateLimit: 'strict'
        },
        'GET /menu/favorites': {
          description: 'Get user\'s favorite menu items',
          query: {
            limit: 'number (optional, max 100)'
          },
          authenticated: true
        },
        'POST /menu/favorites/:itemId': {
          description: 'Add menu item to favorites',
          params: {
            itemId: 'UUID of menu item'
          },
          authenticated: true
        },
        'DELETE /menu/favorites/:itemId': {
          description: 'Remove menu item from favorites',
          params: {
            itemId: 'UUID of menu item'
          },
          authenticated: true
        }
      }
    },
    
    responses: {
      success: {
        structure: {
          success: true,
          message: 'string',
          data: 'object',
          timestamp: 'ISO date string'
        }
      },
      error: {
        structure: {
          success: false,
          message: 'string',
          error: 'string (optional)',
          timestamp: 'ISO date string'
        },
        codes: {
          400: 'Bad Request - Invalid input',
          401: 'Unauthorized - Authentication required',
          403: 'Forbidden - Insufficient permissions',
          404: 'Not Found - Resource not found',
          409: 'Conflict - Resource already exists',
          429: 'Too Many Requests - Rate limit exceeded',
          500: 'Internal Server Error - Server error'
        }
      }
    },
    
    rateLimits: {
      general: `${config.RATE_LIMIT_MAX_REQUESTS || 100} requests per ${Math.round((config.RATE_LIMIT_WINDOW_MS || 900000) / 60000)} minutes`,
      authentication: '10 requests per 15 minutes',
      scraping: '20 requests per 15 minutes'
    },
    
    examples: {
      login: {
        request: {
          method: 'POST',
          url: '/api/v1/auth/login',
          body: {
            email: 'student@psu.edu',
            password: 'securepassword123'
          }
        },
        response: {
          success: true,
          message: 'Login successful',
          data: {
            user: {
              id: 'uuid',
              firstName: 'John',
              lastName: 'Doe',
              email: 'student@psu.edu'
            },
            tokens: {
              accessToken: 'jwt_access_token',
              refreshToken: 'jwt_refresh_token',
              expiresIn: 604800
            }
          }
        }
      },
      todaysMenu: {
        request: {
          method: 'GET',
          url: '/api/v1/menu/today?meal=Dinner'
        },
        response: {
          success: true,
          message: 'Found 45 menu items for today',
          data: {
            items: ['array of menu items'],
            grouped: {'location_id': {'meal_period': ['items']}},
            date: '2025-09-15',
            mealPeriod: 'Dinner',
            locationCount: 5
          }
        }
      }
    }
  };
  
  res.json(documentation);
});

/**
 * API status endpoint for monitoring
 */
app.get(`/api/${config.API_VERSION}/status`, (req: Request, res: Response) => {
  res.json({
    status: 'operational',
    version: config.API_VERSION,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    endpoints: {
      '/health': 'operational',
      '/api/v1/auth': 'operational',
      '/api/v1/menu': 'operational'
    }
  });
});

/**
 * Request timeout middleware for long-running operations
 */
app.use((req: Request, res: Response, next: NextFunction) => {
  const timeout = req.path.includes('/scrape') ? 120000 : 30000; // 2 minutes for scraping, 30s for others
  
  req.setTimeout(timeout, () => {
    console.error(`⏰ Request timeout: ${req.method} ${req.path} - ${(req as any).requestId}`);
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        error: 'Request timeout',
        message: 'The request took too long to process',
        requestId: (req as any).requestId,
        timestamp: new Date().toISOString()
      });
    }
  });
  
  next();
});

/**
 * 404 handler for undefined routes
 */
app.use('*', notFoundHandler);

/**
 * Global error handling middleware (must be last)
 */
app.use(errorHandler);

/**
 * Graceful shutdown preparation
 */
app.set('graceful-shutdown', () => {
  console.log('🛑 Preparing for graceful shutdown...');
  // Close database connections, cancel timers, etc.
  // This function will be called by server.ts
});

export default app;