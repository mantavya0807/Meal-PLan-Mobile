/**
 * Rate Limiting Middleware
 * File Path: backend/src/middleware/rateLimiter.ts
 * 
 * Implements rate limiting to protect against brute force attacks and API abuse.
 * Uses express-rate-limit with different limits for different endpoint types.
 */

import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';
import { ApiResponse, HttpStatusCodes } from '../types';
import config from '../config/environment';

/**
 * Custom rate limit message formatter
 * @param req - Express request object
 * @param res - Express response object
 * @returns Formatted rate limit response
 */
const rateLimitMessage = (req: Request, res: Response): ApiResponse => {
  const retryAfter = Math.round(res.getHeader('Retry-After') as number || 60);
  
  return {
    success: false,
    message: `Too many requests from this IP. Please try again in ${retryAfter} seconds.`,
    data: {
      retryAfter,
      limit: res.getHeader('X-RateLimit-Limit'),
      remaining: res.getHeader('X-RateLimit-Remaining'),
      resetTime: new Date(Date.now() + (retryAfter * 1000)).toISOString(),
    },
    timestamp: new Date().toISOString(),
  };
};

/**
 * Custom key generator for rate limiting
 * Uses IP address and optional user identifier
 * @param req - Express request object
 * @returns Rate limit key
 */
const generateKey = (req: Request): string => {
  // Get user ID from JWT if available
  const userId = (req as any).user?.id;
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  
  // Use user ID if authenticated, otherwise use IP
  return userId ? `user:${userId}` : `ip:${ip}`;
};

/**
 * Skip rate limiting for certain conditions
 * @param req - Express request object
 * @param res - Express response object
 * @returns Boolean indicating if rate limiting should be skipped
 */
const skipRateLimit = (req: Request, res: Response): boolean => {
  // Skip rate limiting in test environment
  if (process.env.NODE_ENV === 'test') {
    return true;
  }
  
  // Skip for health check endpoints
  if (req.path.includes('/health')) {
    return true;
  }
  
  // Skip for localhost in development
  if (process.env.NODE_ENV === 'development') {
    const ip = req.ip || req.connection.remoteAddress;
    if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
      return true;
    }
  }
  
  return false;
};

/**
 * General API rate limiter
 * 100 requests per 15 minutes per IP
 */
export const rateLimitGeneral = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS, // 15 minutes
  max: config.RATE_LIMIT_MAX_REQUESTS, // 100 requests per window
  keyGenerator: generateKey,
  skip: skipRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
  handler: (req: Request, res: Response) => {
    const response = rateLimitMessage(req, res);
    res.status(HttpStatusCodes.TOO_MANY_REQUESTS).json(response);
  },
});

/**
 * Authentication rate limiter (more restrictive)
 * 10 requests per 15 minutes per IP for login/register
 */
export const rateLimitAuth = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per window
  keyGenerator: generateKey,
  skip: skipRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
  handler: (req: Request, res: Response) => {
    console.warn(`Auth rate limit exceeded for ${req.ip} on ${req.path}`);
    const response = rateLimitMessage(req, res);
    res.status(HttpStatusCodes.TOO_MANY_REQUESTS).json(response);
  },
});

/**
 * Password reset rate limiter (very restrictive)
 * 5 requests per hour per IP for password reset requests
 */
export const rateLimitPasswordReset = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  keyGenerator: generateKey,
  skip: skipRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
  handler: (req: Request, res: Response) => {
    console.warn(`Password reset rate limit exceeded for ${req.ip}`);
    const response: ApiResponse = {
      success: false,
      message: 'Too many password reset requests. Please wait before trying again.',
      data: {
        retryAfter: 3600, // 1 hour
        resetTime: new Date(Date.now() + (60 * 60 * 1000)).toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
    res.status(HttpStatusCodes.TOO_MANY_REQUESTS).json(response);
  },
});

/**
 * Email-based rate limiter
 * Limits requests per email address (for forgot password)
 */
export const rateLimitByEmail = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per email per hour
  keyGenerator: (req: Request): string => {
    const email = req.body.email?.toLowerCase() || 'unknown';
    return `email:${email}`;
  },
  skip: skipRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
  handler: (req: Request, res: Response) => {
    const email = req.body.email;
    console.warn(`Email rate limit exceeded for ${email}`);
    const response: ApiResponse = {
      success: false,
      message: 'Too many requests for this email address. Please wait before trying again.',
      timestamp: new Date().toISOString(),
    };
    res.status(HttpStatusCodes.TOO_MANY_REQUESTS).json(response);
  },
});

/**
 * Token refresh rate limiter
 * 20 requests per 15 minutes per user
 */
export const rateLimitTokenRefresh = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 refresh attempts per window
  keyGenerator: generateKey,
  skip: skipRateLimit,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitMessage,
  handler: (req: Request, res: Response) => {
    console.warn(`Token refresh rate limit exceeded for ${req.ip}`);
    const response = rateLimitMessage(req, res);
    res.status(HttpStatusCodes.TOO_MANY_REQUESTS).json(response);
  },
});

/**
 * Progressive rate limiter for failed login attempts
 * Increases delay after each failed attempt from the same IP
 */
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();

/**
 * Cleans up old failed attempt records
 */
const cleanupFailedAttempts = (): void => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  for (const [key, data] of failedAttempts.entries()) {
    if (now - data.lastAttempt > oneHour) {
      failedAttempts.delete(key);
    }
  }
};

/**
 * Progressive rate limiter middleware
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const progressiveRateLimit = (req: Request, res: Response, next: Function): void => {
  const key = generateKey(req);
  const now = Date.now();
  
  // Clean up old records periodically
  if (Math.random() < 0.1) { // 10% chance to clean up
    cleanupFailedAttempts();
  }
  
  const attempts = failedAttempts.get(key);
  
  if (attempts) {
    const timeSinceLastAttempt = now - attempts.lastAttempt;
    const requiredDelay = Math.min(attempts.count * 1000, 30000); // Max 30 seconds
    
    if (timeSinceLastAttempt < requiredDelay) {
      const waitTime = Math.ceil((requiredDelay - timeSinceLastAttempt) / 1000);
      
      const response: ApiResponse = {
        success: false,
        message: `Please wait ${waitTime} seconds before trying again.`,
        data: {
          retryAfter: waitTime,
          attemptsRemaining: Math.max(0, 5 - attempts.count),
        },
        timestamp: new Date().toISOString(),
      };
      
      res.status(HttpStatusCodes.TOO_MANY_REQUESTS).json(response);
      return;
    }
  }
  
  // Store original end method to intercept response
  const originalEnd = res.end;
  
  res.end = function(chunk?: any, encoding?: any): Response {
    // Check if this was a failed login attempt
    if (res.statusCode === 401 && req.path.includes('/login')) {
      const current = failedAttempts.get(key) || { count: 0, lastAttempt: 0 };
      failedAttempts.set(key, {
        count: current.count + 1,
        lastAttempt: now,
      });
    } else if (res.statusCode === 200 && req.path.includes('/login')) {
      // Successful login - clear failed attempts
      failedAttempts.delete(key);
    }
    
    // Call original end method
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

/**
 * Rate limit configuration for different environments
 */
export const getRateLimitConfig = (type: 'general' | 'auth' | 'password' | 'email' | 'refresh') => {
  const configs = {
    general: {
      windowMs: config.RATE_LIMIT_WINDOW_MS,
      max: config.RATE_LIMIT_MAX_REQUESTS,
    },
    auth: {
      windowMs: 15 * 60 * 1000,
      max: config.NODE_ENV === 'development' ? 50 : 10,
    },
    password: {
      windowMs: 60 * 60 * 1000,
      max: config.NODE_ENV === 'development' ? 20 : 5,
    },
    email: {
      windowMs: 60 * 60 * 1000,
      max: config.NODE_ENV === 'development' ? 10 : 3,
    },
    refresh: {
      windowMs: 15 * 60 * 1000,
      max: config.NODE_ENV === 'development' ? 100 : 20,
    },
  };
  
  return configs[type];
};

/**
 * Middleware to log rate limit headers
 */
export const logRateLimit = (req: Request, res: Response, next: Function): void => {
  // Add rate limit info to response headers
  const originalJson = res.json;
  
  res.json = function(body?: any) {
    // Add rate limit headers to response body in development
    if (config.NODE_ENV === 'development' && body && typeof body === 'object') {
      body.rateLimitInfo = {
        limit: res.getHeader('X-RateLimit-Limit'),
        remaining: res.getHeader('X-RateLimit-Remaining'),
        reset: res.getHeader('X-RateLimit-Reset'),
      };
    }
    
    return originalJson.call(this, body);
  };
  
  next();
};

export default {
  rateLimitGeneral,
  rateLimitAuth,
  rateLimitPasswordReset,
  rateLimitByEmail,
  rateLimitTokenRefresh,
  progressiveRateLimit,
  getRateLimitConfig,
  logRateLimit,
};