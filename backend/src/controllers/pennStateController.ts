/**
 * Penn State Authentication Controller - Fixed Static Method Calls
 * File Path: backend/src/controllers/pennStateController.ts
 * 
 * Handles HTTP requests for Penn State account linking and authentication.
 * Fixed static method call issues for credential storage.
 */

import { Request, Response } from 'express';
import { PennStateAuthService } from '../services/pennStateAuthService';
import { UserModel, PennStateStatus } from '../models/User';
import PennStateCredentialsModel from '../models/PennStateCredentials';
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
   * Temporary storage for credentials during 2FA flow
   * This is needed because we need to store credentials after 2FA approval
   * In production, consider using Redis or encrypted temporary storage
   */
  private static tempCredentialStorage = new Map<string, { userId: string; email: string; password: string; timestamp: number }>();

  /**
   * Stores temporary credentials during 2FA flow
   * @param sessionId - Session ID
   * @param userId - User ID
   * @param email - Penn State email
   * @param password - Penn State password
   */
  static storeTempCredentials(sessionId: string, userId: string, email: string, password: string): void {
    this.tempCredentialStorage.set(sessionId, {
      userId,
      email,
      password,
      timestamp: Date.now(),
    });

    // Clean up after 10 minutes
    setTimeout(() => {
      this.tempCredentialStorage.delete(sessionId);
    }, 10 * 60 * 1000);
  }

  /**
   * Retrieves temporary credentials during 2FA flow
   * @param sessionId - Session ID
   * @returns Temporary credentials or null
   */
  static getTempCredentials(sessionId: string): { userId: string; email: string; password: string } | null {
    const stored = this.tempCredentialStorage.get(sessionId);
    if (!stored) return null;

    // Check if expired (10 minutes)
    if (Date.now() - stored.timestamp > 10 * 60 * 1000) {
      this.tempCredentialStorage.delete(sessionId);
      return null;
    }

    return stored;
  }

  /**
   * Clears temporary credentials
   * @param sessionId - Session ID
   */
  static clearTempCredentials(sessionId: string): void {
    this.tempCredentialStorage.delete(sessionId);
  }

  /**
   * Initiates Penn State login process and stores session for 2FA polling
   * POST /api/v1/penn-state/login
   * @param req - Express request object with Penn State credentials
   * @param res - Express response object
   */
  static async initiateLogin(req: Request, res: Response): Promise<void> {
    let authService: PennStateAuthService | null = null;
    
    try {
      const { email, password } = req.body;
      const user = (req as AuthenticatedRequest).user;

      console.log(`Penn State login attempt for user: ${user.id}, PSU account: ${email}`);

      // Check if user already has a linked account
      const userWithPennState = await UserModel.findById(user.id, false);
      if ((userWithPennState as any)?.pennStateStatus === PennStateStatus.LINKED) {
        const response: ApiResponse = {
          success: false,
          message: 'A Penn State account is already linked. Please unlink it first.',
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.CONFLICT).json(response);
        return;
      }

      // Update user status to 'linking'
      await UserModel.updatePennStateStatus(user.id, {
        status: PennStateStatus.LINKING,
      });

      // Initialize Penn State authentication service
      authService = new PennStateAuthService();
      await authService.initialize();

      // Attempt login
      const loginResult = await authService.login({ email, password });

      if (loginResult.success && loginResult.sessionData) {
        // Login successful without 2FA
        console.log('Penn State login successful without 2FA');
        
        // Store encrypted credentials
        await PennStateCredentialsModel.store(user.id, email, password);
        
        // Update user status to 'linked'
        await UserModel.updatePennStateStatus(user.id, {
          email: email,
          status: PennStateStatus.LINKED,
          linkedAt: new Date(),
          lastSync: new Date(),
        });
        
        await authService.cleanup();
        
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
        
      } else if (loginResult.requiresMFA && loginResult.numberMatchCode) {
        // 2FA required - store session and credentials for later
        console.log('Penn State login requires 2FA, storing session for polling');
        
        // Generate a unique session ID
        const sessionId = loginResult.sessionId || `psu_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store the auth service instance for polling
        PennStateAuthService.storeSession(sessionId, authService);
        
        // Store temporary credentials for when approval completes
        PennStateController.storeTempCredentials(sessionId, user.id, email, password);
        
        // Send response with sessionId for polling
        const response: ApiResponse = {
          success: false,
          message: loginResult.message || 'Please approve the sign-in request in your Microsoft Authenticator app',
          data: {
            requiresMFA: true,
            numberMatchCode: loginResult.numberMatchCode,
            sessionId: sessionId, // CRITICAL: Include sessionId for polling
            instructions: loginResult.message || 'Please approve the sign-in request in your Microsoft Authenticator app'
          },
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.OK).json(response);
        
        // Don't cleanup yet - keep browser open for polling
        console.log(`Session ${sessionId} stored for push approval polling`);
        
      } else {
        // Login failed - update status back to not_linked
        console.log('Penn State login failed:', loginResult.message);
        
        await UserModel.updatePennStateStatus(user.id, {
          status: PennStateStatus.NOT_LINKED,
        });
        
        if (authService) {
          await authService.cleanup();
        }
        
        const response: ApiResponse = {
          success: false,
          message: loginResult.message || 'Penn State login failed',
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
      }

    } catch (error: any) {
      console.error('Penn State login error:', error);
      
      // Update user status to error
      try {
        const user = (req as AuthenticatedRequest).user;
        await UserModel.updatePennStateStatus(user.id, {
          status: PennStateStatus.ERROR,
        });
      } catch (statusError) {
        console.error('Failed to update user status after error:', statusError);
      }
      
      // Cleanup auth service if it was initialized
      if (authService) {
        try {
          await authService.cleanup();
        } catch (cleanupError) {
          console.error('Failed to cleanup auth service:', cleanupError);
        }
      }
      
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
   * Checks if push notification has been approved and completes authentication
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

      // Wait a bit for the navigation to happen (up to 5 seconds per check)
      const approvalResult = await authService.waitForPushApprovalAndComplete(5000);

      if (approvalResult.success && approvalResult.sessionData) {
        // Push notification approved - Penn State account is now linked
        console.log('Penn State push notification approved and authenticated');
        
        try {
          // Retrieve temporary credentials stored during initial login
          const tempCredentials = PennStateController.getTempCredentials(sessionId);
          if (!tempCredentials || tempCredentials.userId !== user.id) {
            throw new Error('Temporary credentials not found or expired');
          }
          
          // Store encrypted credentials permanently
          await PennStateCredentialsModel.store(user.id, tempCredentials.email, tempCredentials.password);
          
          // Clear temporary credentials
          PennStateController.clearTempCredentials(sessionId);
          
          // Update user status to 'linked'
          await UserModel.updatePennStateStatus(user.id, {
            email: tempCredentials.email,
            status: PennStateStatus.LINKED,
            linkedAt: new Date(),
            lastSync: new Date(),
          });
          
          // Clean up the browser session
          await authService.cleanup();
          
          // Remove from session storage after a delay to allow final polling requests
          setTimeout(() => {
            PennStateAuthService.removeSession(sessionId);
          }, 5000); // 5 second delay
          
          const response: ApiResponse = {
            success: true,
            message: 'Penn State account linked successfully',
            data: {
              linkedAccount: {
                email: tempCredentials.email,
                status: 'connected',
                verifiedWithPush: true,
                linkedAt: new Date().toISOString()
              }
            },
            timestamp: new Date().toISOString(),
          };
          res.status(HttpStatusCodes.OK).json(response);
          
        } catch (storageError) {
          console.error('Failed to complete Penn State linking after approval:', storageError);
          
          await UserModel.updatePennStateStatus(user.id, {
            status: PennStateStatus.ERROR,
          });
          
          await authService.cleanup();
          PennStateAuthService.removeSession(sessionId);
          
          const response: ApiResponse = {
            success: false,
            message: 'Account verified but failed to complete linking. Please try again.',
            timestamp: new Date().toISOString(),
          };
          res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
        }
        
      } else if (approvalResult.message && approvalResult.message.includes('timed out')) {
        // Check timed out - but session is still active, keep waiting
        console.log('Still waiting for push approval...');
        
        const response: ApiResponse = {
          success: true,
          message: 'Still waiting for push notification approval',
          data: {
            status: 'waiting_for_approval',
            approved: false
          },
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.OK).json(response);
        
      } else if (!approvalResult.success) {
        // Push notification was denied or error occurred
        console.log('Penn State push notification denied or failed:', approvalResult.message);
        
        await UserModel.updatePennStateStatus(user.id, {
          status: PennStateStatus.NOT_LINKED,
        });
        
        await authService.cleanup();
        PennStateAuthService.removeSession(sessionId);
        
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
      
      // Get user with Penn State information
      const userWithPennState = await UserModel.findById(user.id, false);
      if (!userWithPennState) {
        const response: ApiResponse = {
          success: false,
          message: 'User not found',
          timestamp: new Date().toISOString(),
        };
        res.status(HttpStatusCodes.NOT_FOUND).json(response);
        return;
      }
      
      // Check if user has stored credentials
      const hasCredentials = await PennStateCredentialsModel.hasCredentials(user.id);
      
      const response: ApiResponse = {
        success: true,
        message: 'Penn State account status retrieved',
        data: {
          isLinked: (userWithPennState as any).pennStateStatus === PennStateStatus.LINKED,
          linkedAccount: (userWithPennState as any).pennStateStatus === PennStateStatus.LINKED ? {
            email: (userWithPennState as any).pennStateEmail,
            status: 'connected',
            linkedAt: (userWithPennState as any).pennStateLinkedAt,
          } : null,
          lastSync: (userWithPennState as any).pennStateLastSync,
          hasStoredCredentials: hasCredentials,
          pennStateStatus: (userWithPennState as any).pennStateStatus || PennStateStatus.NOT_LINKED,
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
      
      // Delete stored credentials
      await PennStateCredentialsModel.delete(user.id);
      
      // Update user status to not_linked
      await UserModel.updatePennStateStatus(user.id, {
        status: PennStateStatus.NOT_LINKED,
      });
      
      // TODO: Delete session data and transactions when those models are implemented
      
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
      
      // Debug information retrieved (screenshot removed)
      console.log('Debug info retrieved');
      
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