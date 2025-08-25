/**
 * Penn State Authentication Controller
 * File Path: backend/src/controllers/pennStateController.ts
 * 
 * Handles HTTP requests for Penn State account linking and authentication.
 * Manages the 2FA flow and credential verification process.
 */

import { Request, Response } from 'express';
import { PennStateAuthService } from '../services/pennStateAuthService';
import { UserModel } from '../models/User';
import { 
  ApiResponse,
  HttpStatusCodes,
  AuthenticatedRequest
} from '../types';

/**
 * Penn State authentication controller
 */
export class PennStateController {

  /**
   * Initiates Penn State login process
   * POST /api/v1/penn-state/login
   * @param req - Express request object with Penn State credentials
   * @param res - Express response object
   */
  static async initiateLogin(req: Request, res: Response): Promise<void> {
    const authService = new PennStateAuthService();

    try {
      const { email, password } = req.body;
      const user = (req as AuthenticatedRequest).user;

      // Input validation
      if (!email || !password) {
        const response: ApiResponse = {
          success: false,
          message: 'Penn State email and password are required',
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.BAD_REQUEST).json(response);
        return;
      }

      // Basic email validation for Penn State domain
      if (!email.toLowerCase().includes('psu.edu') && !email.match(/^[a-zA-Z0-9]+$/)) {
        const response: ApiResponse = {
          success: false,
          message: 'Please provide a valid Penn State email or username',
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.BAD_REQUEST).json(response);
        return;
      }

      console.log(`Penn State login attempt for user: ${user.id}, PSU account: ${email}`);

      // Initialize browser and attempt login
      await authService.initialize();
      const loginResult = await authService.login({ email, password });

      if (loginResult.success) {
        // Login successful without 2FA
        console.log('Penn State login successful without 2FA');
        
        // TODO: Store encrypted Penn State credentials and session data
        // This will be implemented in the user model to securely store credentials
        
        const response: ApiResponse = {
          success: true,
          message: 'Penn State account linked successfully',
          data: {
            linkedAccount: {
              email: email,
              status: 'connected',
              linkedAt: new Date().toISOString()
            }
          },
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.OK).json(response);
        
      } else if (loginResult.requiresMFA) {
        // 2FA required
        console.log('Penn State login requires 2FA');
        
        const response: ApiResponse = {
          success: false,
          message: loginResult.message,
          data: {
            requiresMFA: true,
            numberMatchCode: loginResult.numberMatchCode,
            sessionId: loginResult.sessionId,
            instructions: loginResult.numberMatchCode 
              ? `Please open your Microsoft Authenticator app and enter the number: ${loginResult.numberMatchCode}`
              : 'Please approve the sign-in request in your Microsoft Authenticator app'
          },
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.OK).json(response);
        
      } else {
        // Login failed
        console.log('Penn State login failed:', loginResult.message);
        await authService.cleanup();
        
        const response: ApiResponse = {
          success: false,
          message: loginResult.message || 'Penn State login failed',
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
      }

    } catch (error: any) {
      console.error('Penn State login error:', error);
      await authService.cleanup();
      
      const response: ApiResponse = {
        success: false,
        message: 'Penn State authentication service temporarily unavailable',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Completes 2FA verification for Penn State login (DEPRECATED - using push notifications now)
   * POST /api/v1/penn-state/verify-2fa
   * @param req - Express request object with 2FA code
   * @param res - Express response object
   */
  static async verify2FA(req: Request, res: Response): Promise<void> {
    try {
      // This endpoint is deprecated since we're now using push notifications
      // Instead of 6-digit codes, users should use the /check-approval endpoint
      const response: ApiResponse = {
        success: false,
        message: 'This authentication method is no longer supported. Please use the push notification approval instead.',
        data: {
          deprecated: true,
          useEndpoint: '/api/v1/penn-state/check-approval'
        },
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.BAD_REQUEST).json(response);
      
    } catch (error: any) {
      console.error('2FA verification error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Authentication method not available',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Checks if push notification has been approved
   * GET /api/v1/penn-state/check-approval?sessionId=xxx
   * @param req - Express request object with sessionId query parameter
   * @param res - Express response object
   */
  static async checkPushApproval(req: Request, res: Response): Promise<void> {
    try {
      const { sessionId } = req.query;
      const user = (req as AuthenticatedRequest).user;

      // Input validation
      if (!sessionId || typeof sessionId !== 'string') {
        const response: ApiResponse = {
          success: false,
          message: 'Session ID is required',
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.BAD_REQUEST).json(response);
        return;
      }

      console.log(`Checking push approval for user: ${user.id}, session: ${sessionId}`);

      // Retrieve the auth service instance from session storage
      const authService = PennStateAuthService.getSession(sessionId);
      if (!authService) {
        const response: ApiResponse = {
          success: false,
          message: 'Authentication session not found or expired. Please restart the login process.',
          data: {
            requiresRestart: true
          },
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.NOT_FOUND).json(response);
        return;
      }

      // Check if push notification has been approved
      const approvalResult = await authService.checkPushApproval();

      if (approvalResult.success && approvalResult.approved) {
        // Push notification approved - Penn State account is now linked
        console.log('Penn State push notification approved');
        
        // TODO: Store encrypted Penn State credentials and session data in database
        // This will include the session cookies and user agent for future requests
        
        await authService.cleanup();
        
        const response: ApiResponse = {
          success: true,
          message: 'Penn State account linked successfully with push notification approval',
          data: {
            linkedAccount: {
              status: 'connected',
              verifiedWithPush: true,
              linkedAt: new Date().toISOString()
            }
          },
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.OK).json(response);
        
      } else if (approvalResult.success && !approvalResult.approved) {
        // Still waiting for approval
        const response: ApiResponse = {
          success: true,
          message: approvalResult.message,
          data: {
            status: 'waiting_for_approval',
            approved: false
          },
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.OK).json(response);
        
      } else {
        // Push notification was denied or error occurred
        console.log('Penn State push notification check failed:', approvalResult.message);
        
        await authService.cleanup();
        
        const response: ApiResponse = {
          success: false,
          message: approvalResult.message || 'Push notification approval failed',
          data: {
            requiresRestart: true
          },
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
      }

    } catch (error: any) {
      console.error('Check push approval error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Push notification check service temporarily unavailable',
        timestamp: new Date().toISOString(),
      };
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Gets Penn State account linking status for current user
   * GET /api/v1/penn-state/status
   * @param req - Express request object
   * @param res - Express response object
   */
  static async getAccountStatus(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      
      // TODO: Check user's Penn State account linking status from database
      // For now, return not linked status
      
      const response: ApiResponse = {
        success: true,
        message: 'Penn State account status retrieved',
        data: {
          isLinked: false, // TODO: Get actual status from database
          linkedAccount: null,
          lastSync: null
        },
        timestamp: new Date().toISOString(),
      };
      
      res.status(HttpStatusCodes.OK).json(response);
      
    } catch (error) {
      console.error('Get Penn State status error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve Penn State account status',
        timestamp: new Date().toISOString(),
      };
      
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Unlinks Penn State account from user
   * DELETE /api/v1/penn-state/unlink
   * @param req - Express request object
   * @param res - Express response object
   */
  static async unlinkAccount(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user;
      
      console.log(`Unlinking Penn State account for user: ${user.id}`);
      
      // TODO: Remove Penn State credentials and session data from database
      
      const response: ApiResponse = {
        success: true,
        message: 'Penn State account unlinked successfully',
        data: {
          unlinkedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString(),
      };
      
      res.status(HttpStatusCodes.OK).json(response);
      
    } catch (error) {
      console.error('Unlink Penn State account error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to unlink Penn State account',
        timestamp: new Date().toISOString(),
      };
      
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Development endpoint to get page debug information
   * GET /api/v1/penn-state/debug (development only)
   * @param req - Express request object
   * @param res - Express response object
   */
  static async getDebugInfo(req: Request, res: Response): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      res.status(HttpStatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Endpoint not available',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const authService = new PennStateAuthService();
    
    try {
      await authService.initialize();
      
      // Navigate to Penn State login page for debugging
      await authService.initialize();
      const pageInfo = await authService.getPageInfo();
      
      // Take screenshot for debugging
      await authService.takeScreenshot(`debug-${Date.now()}.png`);
      
      const response: ApiResponse = {
        success: true,
        message: 'Debug information retrieved',
        data: pageInfo,
        timestamp: new Date().toISOString(),
      };
      
      res.status(HttpStatusCodes.OK).json(response);
      
    } catch (error) {
      console.error('Debug info error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Failed to retrieve debug information',
        timestamp: new Date().toISOString(),
      };
      
      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    } finally {
      await authService.cleanup();
    }
  }
}

export default PennStateController;