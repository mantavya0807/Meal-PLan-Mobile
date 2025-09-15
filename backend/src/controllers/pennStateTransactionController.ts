/**
 * Penn State Transaction Controller
 * File Path: backend/src/controllers/pennStateTransactionController.ts
 * 
 * Controller for Penn State transaction operations including syncing, retrieval, and analytics.
 * Handles all transaction-related API endpoints.
 */

import { Request, Response } from 'express';
import { AuthenticatedRequest, ApiResponse, HttpStatusCodes } from '../types';
import { PennStateTransactionsModel, TransactionFilters } from '../models/PennStateTransactions';
import { PennStateTransactionService, TransactionFetchOptions } from '../services/pennStateTransactionService';
import { PennStateAuthService } from '../services/pennStateAuthService';
import { UserModel, PennStateStatus } from '../models/User';

/**
 * Penn State Transaction Controller
 */
export class PennStateTransactionController {

  /**
   * Syncs transaction data from Penn State
   * POST /api/v1/penn-state/transactions/sync
   * @param req - Express request object
   * @param res - Express response object
   */
  static async syncTransactions(req: Request, res: Response): Promise<void> {
    let authService: PennStateAuthService | null = null;
    
    try {
      const { fullSync = false, startDate, endDate } = req.body;
      const user = (req as AuthenticatedRequest).user;

      console.log(`Transaction sync requested for user: ${user.id}, fullSync: ${fullSync}`);

      // Check if user has linked Penn State account
      const userWithPennState = await UserModel.findById(user.id, false);
      if ((userWithPennState as any)?.pennStateStatus !== PennStateStatus.LINKED) {
        const response: ApiResponse = {
          success: false,
          message: 'Penn State account not linked. Please link your account first.',
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.BAD_REQUEST).json(response);
        return;
      }

      // Initialize auth service and get authenticated session
      authService = new PennStateAuthService();
      
      // Check if we have stored session/credentials for this user
      // In a real implementation, we'd retrieve stored credentials and recreate session
      console.log('Initializing Penn State authentication for transaction sync...');
      await authService.initialize();
      
      // For now, we'll need to implement session restoration
      // This is a simplified version - in production, you'd restore from stored session data
      
      // Get authenticated browser page (this would use stored credentials)
      const page = authService.getPage();
      
      if (!page) {
        const response: ApiResponse = {
          success: false,
          message: 'Browser session not initialized',
          timestamp: new Date().toISOString()
        };
        res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
        return;
      }
      if (!page) {
        const response: ApiResponse = {
          success: false,
          message: 'Penn State session not available. Please re-authenticate.',
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
        return;
      }

      // Prepare sync options
      const syncOptions: TransactionFetchOptions = {};
      
      if (startDate) {
        syncOptions.startDate = new Date(startDate);
      }
      if (endDate) {
        syncOptions.endDate = new Date(endDate);
      }

      // Perform transaction sync
      let syncResult;
      if (fullSync) {
        console.log('Performing full transaction sync...');
        syncResult = await PennStateTransactionService.fetchTransactions(page, user.id, syncOptions);
      } else {
        console.log('Performing incremental transaction sync...');
        syncResult = await PennStateTransactionService.fetchNewTransactions(page, user.id);
      }

      // Update user's last sync time
      await UserModel.updatePennStateStatus(user.id, {
        status: PennStateStatus.LINKED,
        lastSync: new Date(),
      });

      await authService.cleanup();

      const response: ApiResponse = {
        success: syncResult.success,
        message: syncResult.success 
          ? `Transaction sync completed. ${syncResult.newTransactionCount} new transactions added.`
          : 'Transaction sync failed',
        data: {
          syncResult: {
            success: syncResult.success,
            totalTransactions: syncResult.transactionCount,
            newTransactions: syncResult.newTransactionCount,
            duplicatesSkipped: syncResult.duplicateCount,
            lastSyncDate: syncResult.lastSyncDate.toISOString(),
            error: syncResult.error || null
          }
        },
        timestamp: new Date().toISOString(),
      };

      const status = syncResult.success ? HttpStatusCodes.OK : HttpStatusCodes.INTERNAL_SERVER_ERROR;
      res.status(status).json(response);

    } catch (error: any) {
      console.error('Transaction sync error:', error);
      
      if (authService) {
        try {
          await authService.cleanup();
        } catch (cleanupError) {
          console.error('Failed to cleanup auth service:', cleanupError);
        }
      }
      
      const response: ApiResponse = {
        success: false,
        message: 'Transaction sync service temporarily unavailable',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Gets user's transaction history with filtering
   * GET /api/v1/penn-state/transactions
   * @param req - Express request object
   * @param res - Express response object
   */
  static async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const {
        startDate,
        endDate,
        location,
        accountType,
        minAmount,
        maxAmount,
        limit = 50,
        offset = 0
      } = req.query;

      const filters: TransactionFilters = {
        userId: user.id,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      };

      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }
      if (location) {
        filters.location = location as string;
      }
      if (accountType) {
        filters.accountType = accountType as string;
      }
      if (minAmount) {
        filters.minAmount = parseFloat(minAmount as string);
      }
      if (maxAmount) {
        filters.maxAmount = parseFloat(maxAmount as string);
      }

      const transactions = await PennStateTransactionsModel.getByFilters(filters);

      const response: ApiResponse = {
        success: true,
        message: `Retrieved ${transactions.length} transactions`,
        data: {
          transactions: transactions.map(tx => ({
            id: tx.id,
            date: tx.transactionDate.toISOString(),
            location: tx.location,
            description: tx.description,
            amount: tx.amount,
            balanceAfter: tx.balanceAfter,
            accountType: tx.accountType,
            cardNumber: tx.cardNumber,
          })),
          pagination: {
            limit: filters.limit,
            offset: filters.offset,
            hasMore: transactions.length === filters.limit
          },
          filters: {
            startDate: filters.startDate?.toISOString() || null,
            endDate: filters.endDate?.toISOString() || null,
            location: filters.location || null,
            accountType: filters.accountType || null,
            minAmount: filters.minAmount || null,
            maxAmount: filters.maxAmount || null,
          }
        },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);

    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve transactions',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Gets recent transactions for user
   * GET /api/v1/penn-state/transactions/recent
   * @param req - Express request object
   * @param res - Express response object
   */
  static async getRecentTransactions(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const limit = parseInt(req.query.limit as string) || 20;

      const transactions = await PennStateTransactionsModel.getRecent(user.id, limit);

      const response: ApiResponse = {
        success: true,
        message: `Retrieved ${transactions.length} recent transactions`,
        data: {
          transactions: transactions.map(tx => ({
            id: tx.id,
            date: tx.transactionDate.toISOString(),
            location: tx.location,
            description: tx.description,
            amount: tx.amount,
            balanceAfter: tx.balanceAfter,
            accountType: tx.accountType,
            cardNumber: tx.cardNumber,
          })),
          count: transactions.length,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);

    } catch (error: any) {
      console.error('Error fetching recent transactions:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve recent transactions',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Gets transaction statistics for user
   * GET /api/v1/penn-state/transactions/stats
   * @param req - Express request object
   * @param res - Express response object
   */
  static async getTransactionStats(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { startDate, endDate } = req.query;

      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate) {
        start = new Date(startDate as string);
      }
      if (endDate) {
        end = new Date(endDate as string);
      }

      const stats = await PennStateTransactionsModel.getStats(user.id, start, end);

      const response: ApiResponse = {
        success: true,
        message: 'Transaction statistics retrieved successfully',
        data: {
          statistics: {
            totalTransactions: stats.totalTransactions,
            totalSpent: Number(stats.totalSpent.toFixed(2)),
            averageTransaction: Number(stats.averageTransaction.toFixed(2)),
            topLocations: stats.topLocations.map(loc => ({
              location: loc.location,
              visitCount: loc.count,
              totalSpent: Number(loc.totalSpent.toFixed(2)),
              averagePerVisit: Number((loc.totalSpent / loc.count).toFixed(2))
            })),
            monthlySpending: stats.monthlySpending.map(month => ({
              month: month.month,
              totalSpent: Number(month.totalSpent.toFixed(2)),
              transactionCount: month.transactionCount,
              averagePerTransaction: Number((month.totalSpent / month.transactionCount).toFixed(2))
            }))
          },
          dateRange: {
            startDate: start?.toISOString() || null,
            endDate: end?.toISOString() || null,
          }
        },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);

    } catch (error: any) {
      console.error('Error fetching transaction stats:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve transaction statistics',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Gets monthly spending breakdown
   * GET /api/v1/penn-state/transactions/monthly
   * @param req - Express request object
   * @param res - Express response object
   */
  static async getMonthlySpending(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const months = parseInt(req.query.months as string) || 6;

      // Calculate date range for the requested months
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(endDate.getMonth() - months);

      const stats = await PennStateTransactionsModel.getStats(user.id, startDate, endDate);

      const response: ApiResponse = {
        success: true,
        message: `Monthly spending data for last ${months} months`,
        data: {
          monthlySpending: stats.monthlySpending.map(month => ({
            month: month.month,
            totalSpent: Number(month.totalSpent.toFixed(2)),
            transactionCount: month.transactionCount,
            averagePerTransaction: Number((month.totalSpent / month.transactionCount).toFixed(2))
          })),
          summary: {
            totalMonths: stats.monthlySpending.length,
            totalSpent: Number(stats.totalSpent.toFixed(2)),
            averageMonthlySpending: stats.monthlySpending.length > 0 
              ? Number((stats.totalSpent / stats.monthlySpending.length).toFixed(2))
              : 0
          },
          dateRange: {
            startDate: startDate.toISOString(),
            endDate: endDate.toISOString(),
            monthsRequested: months
          }
        },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);

    } catch (error: any) {
      console.error('Error fetching monthly spending:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve monthly spending data',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Gets top spending locations
   * GET /api/v1/penn-state/transactions/locations
   * @param req - Express request object
   * @param res - Express response object
   */
  static async getTopLocations(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      const { limit = 10, startDate, endDate } = req.query;

      let start: Date | undefined;
      let end: Date | undefined;

      if (startDate) {
        start = new Date(startDate as string);
      }
      if (endDate) {
        end = new Date(endDate as string);
      }

      const stats = await PennStateTransactionsModel.getStats(user.id, start, end);

      const topLocations = stats.topLocations
        .slice(0, parseInt(limit as string))
        .map(loc => ({
          location: loc.location,
          visitCount: loc.count,
          totalSpent: Number(loc.totalSpent.toFixed(2)),
          averagePerVisit: Number((loc.totalSpent / loc.count).toFixed(2)),
          percentageOfTotal: stats.totalSpent > 0 
            ? Number(((loc.totalSpent / stats.totalSpent) * 100).toFixed(1))
            : 0
        }));

      const response: ApiResponse = {
        success: true,
        message: `Top ${topLocations.length} dining locations`,
        data: {
          locations: topLocations,
          summary: {
            totalLocations: stats.topLocations.length,
            totalSpent: Number(stats.totalSpent.toFixed(2)),
            totalVisits: stats.totalTransactions
          },
          dateRange: {
            startDate: start?.toISOString() || null,
            endDate: end?.toISOString() || null,
          }
        },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);

    } catch (error: any) {
      console.error('Error fetching top locations:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve top locations',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Gets last sync status and information
   * GET /api/v1/penn-state/transactions/sync-status
   * @param req - Express request object
   * @param res - Express response object
   */
  static async getSyncStatus(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;

      // Get user with Penn State info
      const userWithPennState = await UserModel.findById(user.id, false) as any;
      
      // Get latest transaction date
      const latestTransactionDate = await PennStateTransactionsModel.getLatestTransactionDate(user.id);
      
      // Get basic transaction count
      const recentTransactions = await PennStateTransactionsModel.getRecent(user.id, 1);
      const hasTransactions = recentTransactions.length > 0;

      const response: ApiResponse = {
        success: true,
        message: 'Sync status retrieved successfully',
        data: {
          syncStatus: {
            pennStateLinked: userWithPennState?.pennStateStatus === PennStateStatus.LINKED,
            lastSyncDate: userWithPennState?.pennStateLastSync 
              ? new Date(userWithPennState.pennStateLastSync).toISOString()
              : null,
            hasTransactions,
            latestTransactionDate: latestTransactionDate?.toISOString() || null,
            pennStateEmail: userWithPennState?.pennStateEmail || null,
            accountStatus: userWithPennState?.pennStateStatus || PennStateStatus.NOT_LINKED,
          },
          nextSteps: userWithPennState?.pennStateStatus === PennStateStatus.LINKED
            ? hasTransactions
              ? ['You can sync recent transactions or view your transaction history']
              : ['Run your first transaction sync to import your meal plan data']
            : ['Link your Penn State account to start tracking your meal plan transactions']
        },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);

    } catch (error: any) {
      console.error('Error fetching sync status:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve sync status',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Deletes all transactions for user
   * DELETE /api/v1/penn-state/transactions
   * @param req - Express request object
   * @param res - Express response object
   */
  static async deleteAllTransactions(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;

      const deletedCount = await PennStateTransactionsModel.deleteForUser(user.id);

      const response: ApiResponse = {
        success: true,
        message: `Deleted ${deletedCount} transactions`,
        data: {
          deletedCount,
          userId: user.id,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);

    } catch (error: any) {
      console.error('Error deleting transactions:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to delete transactions',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Test transaction sync without storing data (development only)
   * POST /api/v1/penn-state/transactions/test-sync
   * @param req - Express request object
   * @param res - Express response object
   */
  static async testTransactionSync(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;

      // This would be a dry-run version of transaction sync for testing
      // Implementation would extract transactions but not store them

      const response: ApiResponse = {
        success: true,
        message: 'Test sync functionality not implemented yet',
        data: {
          note: 'This endpoint would perform transaction extraction without storing data',
          userId: user.id,
        },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);

    } catch (error: any) {
      console.error('Error in test sync:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Test sync failed',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }
}

export default PennStateTransactionController;