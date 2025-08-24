/**
 * Authentication Routes
 * File Path: backend/src/routes/authRoutes.ts
 * 
 * Defines all authentication-related API endpoints including registration,
 * login, password reset, token refresh, and user profile operations.
 */

import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { 
  authenticateToken, 
  validateRefreshToken, 
  requireVerifiedUser,
  optionalAuth,
} from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { rateLimitAuth, rateLimitPasswordReset } from '../middleware/rateLimiter';

/**
 * Authentication router instance
 */
const authRouter = Router();

/**
 * Public authentication routes (no authentication required)
 */

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user account
 * @access  Public
 * @body    { firstName, lastName, email, password, confirmPassword }
 */
authRouter.post(
  '/register',
  rateLimitAuth,
  validateRequest('register'),
  AuthController.register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and return tokens
 * @access  Public
 * @body    { email, password }
 */
authRouter.post(
  '/login',
  rateLimitAuth,
  validateRequest('login'),
  AuthController.login
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Initiate password reset process
 * @access  Public
 * @body    { email }
 */
authRouter.post(
  '/forgot-password',
  rateLimitPasswordReset,
  validateRequest('forgotPassword'),
  AuthController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using reset token
 * @access  Public
 * @body    { token, password, confirmPassword }
 */
authRouter.post(
  '/reset-password',
  rateLimitPasswordReset,
  validateRequest('resetPassword'),
  AuthController.resetPassword
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public (requires valid refresh token)
 * @body    { refreshToken }
 */
authRouter.post(
  '/refresh-token',
  rateLimitAuth,
  validateRefreshToken,
  AuthController.refreshToken
);

/**
 * Protected authentication routes (authentication required)
 */

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user profile
 * @access  Private
 */
authRouter.get(
  '/me',
  authenticateToken,
  AuthController.getCurrentUser
);

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user (client-side token invalidation)
 * @access  Private
 */
authRouter.post(
  '/logout',
  authenticateToken,
  AuthController.logout
);

/**
 * Health and status routes
 */

/**
 * @route   GET /api/v1/auth/health
 * @desc    Authentication service health check
 * @access  Public
 */
authRouter.get(
  '/health',
  AuthController.healthCheck
);

/**
 * Development and testing routes (conditionally enabled)
 */
if (process.env.NODE_ENV === 'development') {
  /**
   * @route   GET /api/v1/auth/test-protected
   * @desc    Test protected route (development only)
   * @access  Private
   */
  authRouter.get(
    '/test-protected',
    authenticateToken,
    (req, res) => {
      res.json({
        success: true,
        message: 'Protected route accessed successfully',
        user: (req as any).user,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * @route   GET /api/v1/auth/test-verified
   * @desc    Test verified user route (development only)
   * @access  Private (verified users only)
   */
  authRouter.get(
    '/test-verified',
    authenticateToken,
    requireVerifiedUser,
    (req, res) => {
      res.json({
        success: true,
        message: 'Verified user route accessed successfully',
        user: (req as any).user,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * @route   GET /api/v1/auth/test-optional
   * @desc    Test optional authentication route (development only)
   * @access  Public (optional authentication)
   */
  authRouter.get(
    '/test-optional',
    optionalAuth,
    (req, res) => {
      const user = (req as any).user;
      res.json({
        success: true,
        message: 'Optional auth route accessed successfully',
        authenticated: !!user,
        user: user || null,
        timestamp: new Date().toISOString(),
      });
    }
  );
}

/**
 * Route parameter validation and middleware
 */

/**
 * Middleware to log all auth route requests (development only)
 */
if (process.env.NODE_ENV === 'development') {
  authRouter.use('*', (req, res, next) => {
    console.log(`🔐 Auth route: ${req.method} ${req.originalUrl}`);
    console.log(`📍 IP: ${req.ip || req.connection.remoteAddress}`);
    console.log(`🎫 Auth header: ${req.headers.authorization ? 'Present' : 'None'}`);
    next();
  });
}

/**
 * Error handling for auth routes
 */
authRouter.use((error: any, req: any, res: any, next: any) => {
  console.error('Auth route error:', error);
  
  res.status(500).json({
    success: false,
    message: 'Authentication service error',
    ...(process.env.NODE_ENV === 'development' && { 
      error: error.message,
      stack: error.stack 
    }),
    timestamp: new Date().toISOString(),
  });
});

export default authRouter;