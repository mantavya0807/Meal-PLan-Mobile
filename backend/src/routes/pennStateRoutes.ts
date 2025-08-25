/**
 * Penn State Authentication Routes
 * File Path: backend/src/routes/pennStateRoutes.ts
 * 
 * API routes for Penn State account linking, authentication, and 2FA verification.
 * All routes require user authentication.
 */

import { Router } from 'express';
import { PennStateController } from '../controllers/pennStateController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import { body } from 'express-validator';
import { rateLimitAuth } from '../middleware/rateLimiter';

/**
 * Penn State authentication router instance
 */
const pennStateRouter = Router();

/**
 * Validation rules for Penn State login
 */
const pennStateLoginValidation = [
  body('email')
    .notEmpty()
    .withMessage('Penn State email is required')
    .isLength({ max: 255 })
    .withMessage('Email is too long'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1, max: 128 })
    .withMessage('Password must be between 1 and 128 characters'),
];

/**
 * Validation rules for 2FA verification
 */
const twoFactorValidation = [
  body('code')
    .notEmpty()
    .withMessage('Authentication code is required')
    .isLength({ min: 6, max: 6 })
    .withMessage('Authentication code must be 6 digits')
    .matches(/^\d{6}$/)
    .withMessage('Authentication code must contain only numbers'),
];

/**
 * All Penn State routes require authentication
 */
pennStateRouter.use(authenticateToken);

/**
 * @route   POST /api/v1/penn-state/login
 * @desc    Initiate Penn State account linking process
 * @access  Private (requires user authentication)
 * @body    { email, password }
 */
pennStateRouter.post(
  '/login',
  rateLimitAuth,
  ...pennStateLoginValidation,
  PennStateController.initiateLogin
);

/**
 * @route   POST /api/v1/penn-state/verify-2fa
 * @desc    Complete 2FA verification for Penn State login
 * @access  Private (requires user authentication)
 * @body    { code }
 */
pennStateRouter.post(
  '/verify-2fa',
  rateLimitAuth,
  ...twoFactorValidation,
  PennStateController.verify2FA
);

/**
 * @route   GET /api/v1/penn-state/check-approval
 * @desc    Check if push notification has been approved
 * @access  Private (requires user authentication)
 */
pennStateRouter.get(
  '/check-approval',
  PennStateController.checkPushApproval
);

/**
 * @route   GET /api/v1/penn-state/status
 * @desc    Get Penn State account linking status
 * @access  Private (requires user authentication)
 */
pennStateRouter.get(
  '/status',
  PennStateController.getAccountStatus
);

/**
 * @route   DELETE /api/v1/penn-state/unlink
 * @desc    Unlink Penn State account from user
 * @access  Private (requires user authentication)
 */
pennStateRouter.delete(
  '/unlink',
  PennStateController.unlinkAccount
);

/**
 * Development and debugging routes (only available in non-production)
 */
if (process.env.NODE_ENV !== 'production') {
  /**
   * @route   GET /api/v1/penn-state/debug
   * @desc    Get debug information for Penn State authentication
   * @access  Private (development only)
   */
  pennStateRouter.get(
    '/debug',
    PennStateController.getDebugInfo
  );

  /**
   * @route   GET /api/v1/penn-state/test
   * @desc    Test endpoint for Penn State service
   * @access  Private (development only)
   */
  pennStateRouter.get(
    '/test',
    (req, res) => {
      res.json({
        success: true,
        message: 'Penn State service is available',
        user: (req as any).user,
        environment: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
      });
    }
  );
}

/**
 * Error handling for Penn State routes
 */
pennStateRouter.use((error: any, req: any, res: any, next: any) => {
  console.error('Penn State route error:', error);
  
  res.status(500).json({
    success: false,
    message: 'Penn State service error',
    ...(process.env.NODE_ENV === 'development' && { 
      error: error.message,
      stack: error.stack 
    }),
    timestamp: new Date().toISOString(),
  });
});

export default pennStateRouter;