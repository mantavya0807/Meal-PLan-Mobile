/**
 * Environment Configuration
 * File Path: backend/src/config/environment.ts
 * 
 * Centralized environment variable management with validation and type safety.
 * Ensures all required environment variables are present and properly typed.
 */

import dotenv from 'dotenv';
import { EnvironmentConfig } from '../types';

// Load environment variables from .env file
dotenv.config();

/**
 * Validates that a required environment variable exists
 * @param key - Environment variable key
 * @param defaultValue - Optional default value
 * @returns The environment variable value
 * @throws Error if required variable is missing
 */
function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Converts string to number with validation
 * @param value - String value to convert
 * @param key - Environment variable key for error reporting
 * @returns Number value
 * @throws Error if conversion fails
 */
function toNumber(value: string, key: string): number {
  const num = parseInt(value, 10);
  if (isNaN(num)) {
    throw new Error(`Invalid number format for environment variable: ${key}`);
  }
  return num;
}

/**
 * Converts string to boolean with validation
 * @param value - String value to convert
 * @returns Boolean value
 */
function toBoolean(value: string): boolean {
  return value.toLowerCase() === 'true';
}

/**
 * Validates NODE_ENV value
 * @param env - Environment string
 * @returns Validated environment
 */
function validateNodeEnv(env: string): 'development' | 'production' | 'test' {
  const validEnvs = ['development', 'production', 'test'];
  if (!validEnvs.includes(env)) {
    throw new Error(`Invalid NODE_ENV: ${env}. Must be one of: ${validEnvs.join(', ')}`);
  }
  return env as 'development' | 'production' | 'test';
}

/**
 * Complete environment configuration with validation
 */
const config: EnvironmentConfig = {
  // Server Configuration
  NODE_ENV: validateNodeEnv(requireEnv('NODE_ENV', 'development')),
  PORT: toNumber(requireEnv('PORT', '3001'), 'PORT'),
  API_VERSION: requireEnv('API_VERSION', 'v1'),

  // Supabase Configuration
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_ANON_KEY: requireEnv('SUPABASE_ANON_KEY'),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv('SUPABASE_SERVICE_ROLE_KEY'),

  // JWT Configuration
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: requireEnv('JWT_EXPIRES_IN', '7d'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_REFRESH_EXPIRES_IN: requireEnv('JWT_REFRESH_EXPIRES_IN', '30d'),

  // Bcrypt Configuration
  BCRYPT_SALT_ROUNDS: toNumber(requireEnv('BCRYPT_SALT_ROUNDS', '12'), 'BCRYPT_SALT_ROUNDS'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: toNumber(requireEnv('RATE_LIMIT_WINDOW_MS', '900000'), 'RATE_LIMIT_WINDOW_MS'),
  RATE_LIMIT_MAX_REQUESTS: toNumber(requireEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 'RATE_LIMIT_MAX_REQUESTS'),

  // CORS Configuration
  CORS_ORIGIN: requireEnv('CORS_ORIGIN', 'http://localhost:8081'),

  // Logging
  LOG_LEVEL: requireEnv('LOG_LEVEL', 'info'),

  // Email Configuration
  SMTP_HOST: requireEnv('SMTP_HOST'),
  SMTP_PORT: toNumber(requireEnv('SMTP_PORT', '587'), 'SMTP_PORT'),
  SMTP_USER: requireEnv('SMTP_USER'),
  SMTP_PASSWORD: requireEnv('SMTP_PASSWORD'),
  FROM_EMAIL: requireEnv('FROM_EMAIL'),
  FROM_NAME: requireEnv('FROM_NAME', 'Penn State Meal Plan'),
};

/**
 * Validates the entire configuration
 * Performs additional cross-field validation
 */
function validateConfig(config: EnvironmentConfig): void {
  // Validate JWT secrets are different
  if (config.JWT_SECRET === config.JWT_REFRESH_SECRET) {
    throw new Error('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }

  // Validate JWT secret length in production
  if (config.NODE_ENV === 'production' && config.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long in production');
  }

  // Validate bcrypt rounds
  if (config.BCRYPT_SALT_ROUNDS < 10) {
    console.warn('Warning: BCRYPT_SALT_ROUNDS is less than 10, consider increasing for better security');
  }

  // Validate rate limiting
  if (config.RATE_LIMIT_MAX_REQUESTS < 1) {
    throw new Error('RATE_LIMIT_MAX_REQUESTS must be at least 1');
  }

  // Validate Supabase URL format
  if (!config.SUPABASE_URL.includes('.supabase.co')) {
    throw new Error('SUPABASE_URL must be a valid Supabase project URL');
  }

  // Validate Supabase keys are different
  if (config.SUPABASE_ANON_KEY === config.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY must be different');
  }

  // Production-specific validations
  if (config.NODE_ENV === 'production') {
    if (config.CORS_ORIGIN.includes('localhost')) {
      console.warn('Warning: CORS_ORIGIN includes localhost in production environment');
    }
    
    if (config.SUPABASE_URL.includes('localhost')) {
      console.warn('Warning: SUPABASE_URL includes localhost in production environment');
    }
  }
}

// Validate configuration on load
try {
  validateConfig(config);
  console.log(`Environment configuration loaded successfully (${config.NODE_ENV})`);
} catch (error) {
  console.error('Environment configuration validation failed:', error);
  process.exit(1);
}

/**
 * Helper functions for environment checks
 */
export const isProduction = (): boolean => config.NODE_ENV === 'production';
export const isDevelopment = (): boolean => config.NODE_ENV === 'development';
export const isTest = (): boolean => config.NODE_ENV === 'test';

/**
 * Get Supabase configuration object
 * @returns Supabase client configuration
 */
export const getSupabaseConfig = () => ({
  url: config.SUPABASE_URL,
  anonKey: config.SUPABASE_ANON_KEY,
  serviceRoleKey: config.SUPABASE_SERVICE_ROLE_KEY,
});

/**
 * Get CORS options
 * @returns CORS configuration object
 */
export const getCorsOptions = () => ({
  origin: config.CORS_ORIGIN.split(',').map(origin => origin.trim()),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
});

/**
 * Get rate limiting options
 * @returns Rate limiting configuration
 */
export const getRateLimitOptions = () => ({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
    timestamp: new Date().toISOString(),
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export default config;