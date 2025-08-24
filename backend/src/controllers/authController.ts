/**
 * Authentication Controller
 * File Path: backend/src/controllers/authController.ts
 * 
 * Handles HTTP requests for authentication endpoints including registration,
 * login, password reset, and token refresh operations.
 */

import { Request, Response } from 'express';
import { AuthService } from '../services/authService';
import { 
  RegisterRequest, 
  LoginRequest, 
  ForgotPasswordRequest, 
  ResetPasswordRequest,
  ApiResponse,
  HttpStatusCodes 
} from '../types';

/**
 * Authentication controller class
 */
export class AuthController {

  /**
   * Handles user registration
   * POST /api/v1/auth/register
   * @param req - Express request object
   * @param res - Express response object
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const registrationData: RegisterRequest = req.body;

      // Call authentication service
      const result = await AuthService.register(registrationData);

      if (result.success) {
        const response: ApiResponse = {
          success: true,
          message: result.message,
          data: {
            user: result.user,
            tokens: result.tokens,
          },
          timestamp: new Date().toISOString(),
        };

        res.status(HttpStatusCodes.CREATED).json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          message: result.message,
          timestamp: new Date().toISOString(),
        };

        res.status(HttpStatusCodes.BAD_REQUEST).json(response);
      }
    } catch (error) {
      console.error('Register controller error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error during registration',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Handles user login
   * POST /api/v1/auth/login
   * @param req - Express request object
   * @param res - Express response object
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const loginData: LoginRequest = req.body;

      // Call authentication service
      const result = await AuthService.login(loginData);

      if (result.success) {
        const response: ApiResponse = {
          success: true,
          message: result.message,
          data: {
            user: result.user,
            tokens: result.tokens,
          },
          timestamp: new Date().toISOString(),
        };

        res.status(HttpStatusCodes.OK).json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          message: result.message,
          timestamp: new Date().toISOString(),
        };

        res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
      }
    } catch (error) {
      console.error('Login controller error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error during login',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Handles forgot password requests
   * POST /api/v1/auth/forgot-password
   * @param req - Express request object
   * @param res - Express response object
   */
  static async forgotPassword(req: Request, res: Response): Promise<void> {
    try {
      const forgotPasswordData: ForgotPasswordRequest = req.body;

      // Call authentication service
      const result = await AuthService.forgotPassword(forgotPasswordData);

      const response: ApiResponse = {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      };

      // Always return 200 to prevent email enumeration
      res.status(HttpStatusCodes.OK).json(response);
      
    } catch (error) {
      console.error('Forgot password controller error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error processing password reset request',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Handles password reset with token
   * POST /api/v1/auth/reset-password
   * @param req - Express request object
   * @param res - Express response object
   */
  static async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const resetData: ResetPasswordRequest = req.body;

      // Call authentication service
      const result = await AuthService.resetPassword(resetData);

      const response: ApiResponse = {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      };

      const statusCode = result.success ? HttpStatusCodes.OK : HttpStatusCodes.BAD_REQUEST;
      res.status(statusCode).json(response);
      
    } catch (error) {
      console.error('Reset password controller error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error during password reset',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Handles token refresh requests
   * POST /api/v1/auth/refresh-token
   * @param req - Express request object
   * @param res - Express response object
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        const response: ApiResponse = {
          success: false,
          message: 'Refresh token is required',
          timestamp: new Date().toISOString(),
        };

        res.status(HttpStatusCodes.BAD_REQUEST).json(response);
        return;
      }

      // Call authentication service
      const result = await AuthService.refreshToken(refreshToken);

      if (result.success) {
        const response: ApiResponse = {
          success: true,
          message: result.message,
          data: {
            accessToken: result.accessToken,
          },
          timestamp: new Date().toISOString(),
        };

        res.status(HttpStatusCodes.OK).json(response);
      } else {
        const response: ApiResponse = {
          success: false,
          message: result.message,
          timestamp: new Date().toISOString(),
        };

        res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
      }
      
    } catch (error) {
      console.error('Refresh token controller error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error during token refresh',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Handles user logout (client-side token invalidation)
   * POST /api/v1/auth/logout
   * @param req - Express request object
   * @param res - Express response object
   */
  static async logout(req: Request, res: Response): Promise<void> {
    try {
      // Since we're using stateless JWT tokens, logout is handled client-side
      // by removing the tokens from client storage
      
      const response: ApiResponse = {
        success: true,
        message: 'Logged out successfully',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);
      
    } catch (error) {
      console.error('Logout controller error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error during logout',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Gets current user profile (requires authentication)
   * GET /api/v1/auth/me
   * @param req - Express request object (with authenticated user)
   * @param res - Express response object
   */
  static async getCurrentUser(req: Request, res: Response): Promise<void> {
    try {
      // User is attached to request by auth middleware
      const user = (req as any).user;

      if (!user) {
        const response: ApiResponse = {
          success: false,
          message: 'User not found in request',
          timestamp: new Date().toISOString(),
        };

        res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'User profile retrieved successfully',
        data: { user },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);
      
    } catch (error) {
      console.error('Get current user controller error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Internal server error retrieving user profile',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Health check endpoint for authentication service
   * GET /api/v1/auth/health
   * @param req - Express request object
   * @param res - Express response object
   */
  static async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const response: ApiResponse = {
        success: true,
        message: 'Authentication service is healthy',
        data: {
          service: 'auth',
          status: 'operational',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          version: '1.0.0',
        },
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.OK).json(response);
      
    } catch (error) {
      console.error('Auth health check error:', error);
      
      const response: ApiResponse = {
        success: false,
        message: 'Authentication service health check failed',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
    }
  }

  /**
   * Validates request body for registration
   * @param body - Request body
   * @returns Validation errors array
   */
  private static validateRegistrationBody(body: any): string[] {
    const errors: string[] = [];

    if (!body.firstName || typeof body.firstName !== 'string' || body.firstName.trim().length < 2) {
      errors.push('First name must be at least 2 characters long');
    }

    if (!body.lastName || typeof body.lastName !== 'string' || body.lastName.trim().length < 2) {
      errors.push('Last name must be at least 2 characters long');
    }

    if (!body.email || typeof body.email !== 'string' || !AuthService.validateEmail(body.email)) {
      errors.push('Valid email address is required');
    }

    if (!body.password || typeof body.password !== 'string' || body.password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (!body.confirmPassword || body.password !== body.confirmPassword) {
      errors.push('Passwords do not match');
    }

    return errors;
  }

  /**
   * Validates request body for login
   * @param body - Request body
   * @returns Validation errors array
   */
  private static validateLoginBody(body: any): string[] {
    const errors: string[] = [];

    if (!body.email || typeof body.email !== 'string' || !AuthService.validateEmail(body.email)) {
      errors.push('Valid email address is required');
    }

    if (!body.password || typeof body.password !== 'string' || body.password.length === 0) {
      errors.push('Password is required');
    }

    return errors;
  }
}

export default AuthController;