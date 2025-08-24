/**
 * Authentication Middleware
 * File Path: backend/src/middleware/auth.ts
 * 
 * Middleware for protecting routes and validating JWT tokens.
 * Handles authentication verification and user context injection.
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { UserModel } from '../models/User';
import { AuthenticatedRequest, ApiResponse, HttpStatusCodes, UserPublic } from '../types';

/**
 * Authentication middleware to protect routes
 * Verifies JWT token and attaches user to request object
 */
export const authenticateToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      const response: ApiResponse = {
        success: false,
        message: 'Access token is required',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
      return;
    }

    // Verify the token
    const decoded = AuthService.verifyAccessToken(token);

    // Get user from database
    const user = await UserModel.findById(decoded.userId);
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
      return;
    }

    // Attach user to request object
    (req as AuthenticatedRequest).user = user;
    
    next();

  } catch (error: any) {
    console.error('Authentication middleware error:', error);

    let message = 'Authentication failed';
    let statusCode = HttpStatusCodes.UNAUTHORIZED;

    if (error.message === 'Invalid token') {
      message = 'Invalid access token';
    } else if (error.message === 'Token expired') {
      message = 'Access token has expired';
    } else if (error.message.includes('token')) {
      message = error.message;
    } else {
      statusCode = HttpStatusCodes.INTERNAL_SERVER_ERROR;
      message = 'Internal server error during authentication';
    }

    const response: ApiResponse = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(response);
  }
};

/**
 * Optional authentication middleware
 * Attaches user to request if token is provided and valid, but doesn't fail if token is missing
 */
export const optionalAuth = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (!token) {
      // No token provided, continue without authentication
      next();
      return;
    }

    // Verify the token
    const decoded = AuthService.verifyAccessToken(token);

    // Get user from database
    const user = await UserModel.findById(decoded.userId);
    
    if (user) {
      // Attach user to request object if found
      (req as AuthenticatedRequest).user = user;
    }

    next();

  } catch (error) {
    // Don't fail the request for optional auth, just continue without user
    console.warn('Optional auth middleware warning:', error);
    next();
  }
};

/**
 * Middleware to check if user is verified
 * Must be used after authenticateToken middleware
 */
export const requireVerifiedUser = (
  req: Request, 
  res: Response, 
  next: NextFunction
): void => {
  try {
    const user = (req as AuthenticatedRequest).user;

    if (!user) {
      const response: ApiResponse = {
        success: false,
        message: 'Authentication required',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
      return;
    }

    if (!user.isVerified) {
      const response: ApiResponse = {
        success: false,
        message: 'Email verification required. Please check your email and verify your account.',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.FORBIDDEN).json(response);
      return;
    }

    next();

  } catch (error) {
    console.error('Verify user middleware error:', error);

    const response: ApiResponse = {
      success: false,
      message: 'Internal server error during user verification check',
      timestamp: new Date().toISOString(),
    };

    res.status(HttpStatusCodes.INTERNAL_SERVER_ERROR).json(response);
  }
};

/**
 * Middleware to validate refresh token
 * Used specifically for token refresh endpoint
 */
export const validateRefreshToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
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

    // Verify the refresh token
    const decoded = AuthService.verifyRefreshToken(refreshToken);

    // Check if user exists
    const user = await UserModel.findById(decoded.userId);
    
    if (!user) {
      const response: ApiResponse = {
        success: false,
        message: 'User not found',
        timestamp: new Date().toISOString(),
      };

      res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
      return;
    }

    // Attach user to request for token refresh
    (req as AuthenticatedRequest).user = user;
    
    next();

  } catch (error: any) {
    console.error('Refresh token validation error:', error);

    let message = 'Invalid refresh token';
    
    if (error.message === 'Refresh token expired') {
      message = 'Refresh token has expired. Please log in again.';
    } else if (error.message.includes('token')) {
      message = error.message;
    }

    const response: ApiResponse = {
      success: false,
      message,
      timestamp: new Date().toISOString(),
    };

    res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
  }
};

/**
 * Middleware to extract user ID from token without full authentication
 * Useful for public endpoints that benefit from user context
 */
export const extractUserFromToken = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    if (token) {
      try {
        const decoded = AuthService.verifyAccessToken(token);
        // Only attach userId, not full user object
        (req as any).userId = decoded.userId;
      } catch (error) {
        // Ignore token errors for this middleware
        console.debug('Token extraction failed (non-critical):', error);
      }
    }

    next();

  } catch (error) {
    // This middleware should never fail the request
    console.warn('Extract user middleware warning:', error);
    next();
  }
};

/**
 * Middleware to check authentication status and provide user info
 * Returns authentication status without failing the request
 */
export const checkAuthStatus = async (
  req: Request, 
  res: Response, 
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;

    let authStatus: {
      isAuthenticated: boolean;
      user: UserPublic | null;
      tokenValid: boolean;
    } = {
      isAuthenticated: false,
      user: null,
      tokenValid: false,
    };

    if (token) {
      try {
        const decoded = AuthService.verifyAccessToken(token);
        const user = await UserModel.findById(decoded.userId);
        
        if (user) {
          authStatus = {
            isAuthenticated: true,
            user,
            tokenValid: true,
          };
        }
      } catch (error) {
        authStatus.tokenValid = false;
      }
    }

    // Attach auth status to request
    (req as any).authStatus = authStatus;
    
    next();

  } catch (error) {
    console.error('Auth status check error:', error);
    
    // Still continue with default status
    (req as any).authStatus = {
      isAuthenticated: false,
      user: null,
      tokenValid: false,
    };
    
    next();
  }
};

/**
 * Error handler specifically for authentication errors
 */
export const handleAuthError = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error.name === 'UnauthorizedError') {
    const response: ApiResponse = {
      success: false,
      message: 'Invalid or expired token',
      timestamp: new Date().toISOString(),
    };

    res.status(HttpStatusCodes.UNAUTHORIZED).json(response);
    return;
  }

  // Pass other errors to general error handler
  next(error);
};

export default {
  authenticateToken,
  optionalAuth,
  requireVerifiedUser,
  validateRefreshToken,
  extractUserFromToken,
  checkAuthStatus,
  handleAuthError,
};