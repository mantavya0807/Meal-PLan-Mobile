/**
 * Penn State Transaction Routes
 * File Path: backend/src/routes/pennStateTransactionRoutes.ts
 * 
 * API routes for Penn State transaction data fetching, syncing, and retrieval.
 * All routes require user authentication and linked Penn State account.
 */

import { Router, Request, Response } from 'express';
import { PennStateTransactionController } from '../controllers/pennStateTransactionController';
import { authenticateToken } from '../middleware/auth';
import { validateRequest, handleValidationErrors } from '../middleware/validation';
import { query, body } from 'express-validator';
import { rateLimitAuth } from '../middleware/rateLimiter';
import { AuthenticatedRequest } from '../types';

/**
 * Penn State transaction router instance
 */
const pennStateTransactionRouter = Router();

/**
 * Validation rules for date range queries
 */
const dateRangeValidation = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be non-negative'),
];

/**
 * Validation rules for transaction filtering
 */
const transactionFilterValidation = [
  ...dateRangeValidation,
  
  query('location')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Location filter is too long'),
  
  query('accountType')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Account type filter is too long'),
  
  query('minAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum amount must be non-negative'),
  
  query('maxAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Maximum amount must be non-negative'),
];

/**
 * Validation rules for sync options
 */
const syncOptionsValidation = [
  body('fullSync')
    .optional()
    .isBoolean()
    .withMessage('Full sync must be a boolean'),
  
  body('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  
  body('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
];

/**
 * All transaction routes require authentication
 */
pennStateTransactionRouter.use(authenticateToken);

/**
 * @route   POST /api/v1/penn-state/transactions/sync
 * @desc    Sync transaction data from Penn State
 * @access  Private (requires user authentication and linked Penn State account)
 * @body    { fullSync?, startDate?, endDate? }
 */
pennStateTransactionRouter.post(
  '/sync',
  rateLimitAuth,
  ...syncOptionsValidation,
  handleValidationErrors,
  PennStateTransactionController.syncTransactions
);

/**
 * @route   GET /api/v1/penn-state/transactions
 * @desc    Get user's transaction history with optional filtering
 * @access  Private (requires user authentication and linked Penn State account)
 * @query   startDate, endDate, location, accountType, minAmount, maxAmount, limit, offset
 */
pennStateTransactionRouter.get(
  '/',
  ...transactionFilterValidation,
  handleValidationErrors,
  PennStateTransactionController.getTransactions
);

/**
 * @route   GET /api/v1/penn-state/transactions/recent
 * @desc    Get recent transactions for user (last 20 by default)
 * @access  Private (requires user authentication and linked Penn State account)
 * @query   limit
 */
pennStateTransactionRouter.get(
  '/recent',
  query('limit')
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage('Limit must be between 1 and 50'),
  handleValidationErrors,
  PennStateTransactionController.getRecentTransactions
);

/**
 * @route   GET /api/v1/penn-state/transactions/stats
 * @desc    Get transaction statistics for user
 * @access  Private (requires user authentication and linked Penn State account)
 * @query   startDate, endDate
 */
pennStateTransactionRouter.get(
  '/stats',
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  handleValidationErrors,
  PennStateTransactionController.getTransactionStats
);

/**
 * @route   GET /api/v1/penn-state/transactions/monthly
 * @desc    Get monthly spending breakdown
 * @access  Private (requires user authentication and linked Penn State account)
 * @query   months (number of months back, default 6)
 */
pennStateTransactionRouter.get(
  '/monthly',
  query('months')
    .optional()
    .isInt({ min: 1, max: 24 })
    .withMessage('Months must be between 1 and 24'),
  handleValidationErrors,
  PennStateTransactionController.getMonthlySpending
);

/**
 * @route   GET /api/v1/penn-state/transactions/locations
 * @desc    Get top spending locations
 * @access  Private (requires user authentication and linked Penn State account)
 * @query   limit, startDate, endDate
 */
pennStateTransactionRouter.get(
  '/locations',
  query('limit')
    .optional()
    .isInt({ min: 1, max: 20 })
    .withMessage('Limit must be between 1 and 20'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  handleValidationErrors,
  PennStateTransactionController.getTopLocations
);

/**
 * @route   GET /api/v1/penn-state/transactions/sync-status
 * @desc    Get last sync status and information
 * @access  Private (requires user authentication and linked Penn State account)
 */
pennStateTransactionRouter.get(
  '/sync-status',
  PennStateTransactionController.getSyncStatus
);

/**
 * @route   DELETE /api/v1/penn-state/transactions
 * @desc    Delete all transactions for user (when unlinking account)
 * @access  Private (requires user authentication)
 */
pennStateTransactionRouter.delete(
  '/',
  PennStateTransactionController.deleteAllTransactions
);

/**
 * Development and debugging routes (only available in non-production)
 */
if (process.env.NODE_ENV !== 'production') {
  
  /**
   * @route   GET /api/v1/penn-state/transactions/debug
   * @desc    Get debug information for transaction system
   * @access  Private (development only)
   */
  pennStateTransactionRouter.get(
    '/debug',
    (req: Request, res: Response) => {
      const user = (req as AuthenticatedRequest).user;
      
      res.json({
        success: true,
        message: 'Penn State Transaction Service Debug Info',
        data: {
          userId: user.id,
          environment: process.env.NODE_ENV,
          services: {
            transactionService: 'Available',
            database: 'Connected',
            authService: 'Available'
          },
          endpoints: {
            'POST /sync': 'Sync transaction data from Penn State',
            'GET /': 'Get filtered transaction history',
            'GET /recent': 'Get recent transactions',
            'GET /stats': 'Get transaction statistics',
            'GET /monthly': 'Get monthly spending breakdown',
            'GET /locations': 'Get top spending locations',
            'GET /sync-status': 'Get last sync information',
            'DELETE /': 'Delete all user transactions'
          }
        },
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * @route   POST /api/v1/penn-state/transactions/test-sync
   * @desc    Test transaction sync without storing data
   * @access  Private (development only)
   */
  pennStateTransactionRouter.post(
    '/test-sync',
    PennStateTransactionController.testTransactionSync
  );
}

/**
 * Error handling for transaction routes
 */
pennStateTransactionRouter.use((error: any, req: any, res: any, next: any) => {
  console.error('Penn State transaction route error:', error);
  
  res.status(500).json({
    success: false,
    message: 'Transaction service error',
    ...(process.env.NODE_ENV === 'development' && { 
      error: error.message,
      stack: error.stack 
    }),
    timestamp: new Date().toISOString(),
  });
});

export default pennStateTransactionRouter;