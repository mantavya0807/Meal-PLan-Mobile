/**
 * Authentication Service
 * File Path: backend/src/services/authService.ts
 * 
 * Handles all authentication-related business logic including password hashing,
 * JWT token generation/validation, and authentication workflows.
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/environment';
import { UserModel } from '../models/User';
import EmailService from '../utils/emailService';
import { 
  User, 
  UserPublic, 
  RegisterRequest, 
  LoginRequest, 
  ForgotPasswordRequest, 
  ResetPasswordRequest, 
  JWTPayload, 
  AuthResponse 
} from '../types';

/**
 * Authentication service class
 */
export class AuthService {
  
  /**
   * Hashes a password using bcrypt
   * @param password - Plain text password
   * @returns Hashed password
   */
  static async hashPassword(password: string): Promise<string> {
    try {
      return await bcrypt.hash(password, config.BCRYPT_SALT_ROUNDS);
    } catch (error) {
      console.error('Error hashing password:', error);
      throw new Error('Failed to hash password');
    }
  }

  /**
   * Compares a plain text password with a hashed password
   * @param password - Plain text password
   * @param hashedPassword - Hashed password from database
   * @returns Boolean indicating if passwords match
   */
  static async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(password, hashedPassword);
    } catch (error) {
      console.error('Error comparing passwords:', error);
      throw new Error('Failed to compare passwords');
    }
  }

  /**
   * Generates JWT access token
   * @param user - User data
   * @returns JWT access token
   */
  static generateAccessToken(user: UserPublic): string {
    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseTimeToSeconds(config.JWT_EXPIRES_IN),
    };

    try {
      return jwt.sign(payload, config.JWT_SECRET);
    } catch (error) {
      console.error('Error generating access token:', error);
      throw new Error('Failed to generate access token');
    }
  }

  /**
   * Generates JWT refresh token
   * @param user - User data
   * @returns JWT refresh token
   */
  static generateRefreshToken(user: UserPublic): string {
    const payload = {
      userId: user.id,
      email: user.email,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + this.parseTimeToSeconds(config.JWT_REFRESH_EXPIRES_IN),
    };

    try {
      return jwt.sign(payload, config.JWT_REFRESH_SECRET);
    } catch (error) {
      console.error('Error generating refresh token:', error);
      throw new Error('Failed to generate refresh token');
    }
  }

  /**
   * Verifies JWT access token
   * @param token - JWT token to verify
   * @returns Decoded token payload
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      return jwt.verify(token, config.JWT_SECRET) as JWTPayload;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token expired');
      }
      console.error('Error verifying access token:', error);
      throw new Error('Token verification failed');
    }
  }

  /**
   * Verifies JWT refresh token
   * @param token - JWT refresh token to verify
   * @returns Decoded token payload
   */
  static verifyRefreshToken(token: string): any {
    try {
      return jwt.verify(token, config.JWT_REFRESH_SECRET);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      }
      console.error('Error verifying refresh token:', error);
      throw new Error('Refresh token verification failed');
    }
  }

  /**
   * Generates a secure random token for password reset
   * @returns Random token string
   */
  static generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Validates password strength
   * @param password - Password to validate
   * @returns Validation result with errors
   */
  static validatePassword(password: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 128) {
      errors.push('Password must be less than 128 characters');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    // Check for common patterns
    const commonPatterns = [
      /(.)\1{2,}/, // Repeated characters
      /123456|654321|qwerty|password|admin/, // Common sequences
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(password.toLowerCase())) {
        errors.push('Password contains common patterns that are easily guessed');
        break;
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates email format
   * @param email - Email to validate
   * @returns Boolean indicating if email is valid
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(email);
  }

  /**
   * Validates name format
   * @param name - Name to validate
   * @returns Boolean indicating if name is valid
   */
  static validateName(name: string): boolean {
    if (name.length < 2 || name.length > 50) {
      return false;
    }
    
    // Allow letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-Z\s'-]+$/;
    return nameRegex.test(name);
  }

  /**
   * Registers a new user
   * @param registrationData - User registration data
   * @returns Authentication response
   */
  static async register(registrationData: RegisterRequest): Promise<AuthResponse> {
    const { firstName, lastName, email, password, confirmPassword } = registrationData;

    try {
      // Validate input data
      if (!firstName || !lastName || !email || !password || !confirmPassword) {
        return {
          success: false,
          message: 'All fields are required',
        };
      }

      // Validate name formats
      if (!this.validateName(firstName)) {
        return {
          success: false,
          message: 'First name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes',
        };
      }

      if (!this.validateName(lastName)) {
        return {
          success: false,
          message: 'Last name must be 2-50 characters and contain only letters, spaces, hyphens, and apostrophes',
        };
      }

      // Validate email format
      if (!this.validateEmail(email)) {
        return {
          success: false,
          message: 'Please provide a valid email address',
        };
      }

      // Check if passwords match
      if (password !== confirmPassword) {
        return {
          success: false,
          message: 'Passwords do not match',
        };
      }

      // Validate password strength
      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: passwordValidation.errors[0] || 'Password does not meet requirements',
        };
      }

      // Check if email already exists
      const existingUser = await UserModel.findByEmail(email);
      if (existingUser) {
        return {
          success: false,
          message: 'An account with this email already exists',
        };
      }

      // Hash password
      const hashedPassword = await this.hashPassword(password);

      // Create user
      const newUser = await UserModel.create({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
      });

      // Generate tokens
      const accessToken = this.generateAccessToken(newUser);
      const refreshToken = this.generateRefreshToken(newUser);

      // Send welcome email (don't block registration if email fails)
      try {
        await EmailService.sendWelcomeEmail(
          newUser.email,
          newUser.firstName,
          newUser.lastName
        );
        console.log(`✅ Welcome email sent to ${newUser.email}`);
      } catch (emailError) {
        console.error('Welcome email error:', emailError);
        // Don't fail registration if email fails
      }

      return {
        success: true,
        message: 'Account created successfully',
        user: newUser,
        tokens: {
          accessToken,
          refreshToken,
        },
      };

    } catch (error: any) {
      console.error('Registration error:', error);
      
      if (error.message === 'Email already exists') {
        return {
          success: false,
          message: 'An account with this email already exists',
        };
      }

      return {
        success: false,
        message: 'Failed to create account. Please try again.',
      };
    }
  }

  /**
   * Authenticates user login
   * @param loginData - User login credentials
   * @returns Authentication response
   */
  static async login(loginData: LoginRequest): Promise<AuthResponse> {
    const { email, password } = loginData;

    try {
      // Validate input data
      if (!email || !password) {
        return {
          success: false,
          message: 'Email and password are required',
        };
      }

      // Validate email format
      if (!this.validateEmail(email)) {
        return {
          success: false,
          message: 'Please provide a valid email address',
        };
      }

      // Find user with password
      const user = await UserModel.findByEmail(email, true) as User | null;
      if (!user) {
        return {
          success: false,
          message: 'Invalid email or password',
        };
      }

      // Compare password
      const isPasswordValid = await this.comparePassword(password, user.password);
      if (!isPasswordValid) {
        return {
          success: false,
          message: 'Invalid email or password',
        };
      }

      // Create public user object (without password)
      const publicUser: UserPublic = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      // Generate tokens
      const accessToken = this.generateAccessToken(publicUser);
      const refreshToken = this.generateRefreshToken(publicUser);

      return {
        success: true,
        message: 'Login successful',
        user: publicUser,
        tokens: {
          accessToken,
          refreshToken,
        },
      };

    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed. Please try again.',
      };
    }
  }

  /**
   * Initiates password reset process
   * @param forgotPasswordData - Forgot password request data
   * @returns Success/failure response
   */
  static async forgotPassword(forgotPasswordData: ForgotPasswordRequest): Promise<{ success: boolean; message: string }> {
    const { email } = forgotPasswordData;

    try {
      // Validate input
      if (!email) {
        return {
          success: false,
          message: 'Email is required',
        };
      }

      // Validate email format
      if (!this.validateEmail(email)) {
        return {
          success: false,
          message: 'Please provide a valid email address',
        };
      }

      // Check if user exists
      const user = await UserModel.findByEmail(email);
      if (!user) {
        // Return success even if user doesn't exist to prevent email enumeration
        return {
          success: true,
          message: 'If an account with this email exists, a password reset link has been sent',
        };
      }

      // Generate reset token
      const resetToken = this.generateResetToken();
      const resetExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Save reset token to database
      await UserModel.setResetPasswordToken(email, resetToken, resetExpires);

      // Send email with reset token
      try {
        const emailSent = await EmailService.sendPasswordResetEmail(
          email, 
          resetToken, 
          user.firstName
        );
        
        if (emailSent) {
          console.log(`✅ Password reset email sent to ${email}`);
        } else {
          console.log(`⚠️ Password reset email failed to send to ${email}, but token logged for development`);
          // For development, still log the token if email fails
          console.log(`Password reset token for ${email}: ${resetToken}`);
        }
      } catch (emailError) {
        console.error('Email sending error:', emailError);
        // For development, log the token if email fails
        console.log(`Password reset token for ${email}: ${resetToken}`);
      }

      return {
        success: true,
        message: 'Password reset instructions have been sent to your email',
      };

    } catch (error) {
      console.error('Forgot password error:', error);
      return {
        success: false,
        message: 'Failed to process password reset request. Please try again.',
      };
    }
  }

  /**
   * Resets user password using reset token
   * @param resetData - Password reset data
   * @returns Success/failure response
   */
  static async resetPassword(resetData: ResetPasswordRequest): Promise<{ success: boolean; message: string }> {
    const { token, password, confirmPassword } = resetData;

    try {
      // Validate input
      if (!token || !password || !confirmPassword) {
        return {
          success: false,
          message: 'All fields are required',
        };
      }

      // Check if passwords match
      if (password !== confirmPassword) {
        return {
          success: false,
          message: 'Passwords do not match',
        };
      }

      // Validate password strength
      const passwordValidation = this.validatePassword(password);
      if (!passwordValidation.isValid) {
        return {
          success: false,
          message: passwordValidation.errors[0] || 'Password does not meet requirements',
        };
      }

      // Find user by reset token
      const user = await UserModel.findByResetToken(token);
      if (!user) {
        return {
          success: false,
          message: 'Invalid or expired reset token',
        };
      }

      // Hash new password
      const hashedPassword = await this.hashPassword(password);

      // Update user password and clear reset token
      await UserModel.updatePassword(user.id, hashedPassword);

      return {
        success: true,
        message: 'Password has been reset successfully',
      };

    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        message: 'Failed to reset password. Please try again.',
      };
    }
  }

  /**
   * Refreshes access token using refresh token
   * @param refreshToken - Refresh token
   * @returns New access token or error
   */
  static async refreshToken(refreshToken: string): Promise<{ success: boolean; message: string; accessToken?: string }> {
    try {
      if (!refreshToken) {
        return {
          success: false,
          message: 'Refresh token is required',
        };
      }

      // Verify refresh token
      const decoded = this.verifyRefreshToken(refreshToken);

      // Find user
      const user = await UserModel.findById(decoded.userId);
      if (!user) {
        return {
          success: false,
          message: 'User not found',
        };
      }

      // Generate new access token
      const newAccessToken = this.generateAccessToken(user);

      return {
        success: true,
        message: 'Access token refreshed successfully',
        accessToken: newAccessToken,
      };

    } catch (error: any) {
      console.error('Refresh token error:', error);
      
      if (error.message.includes('token')) {
        return {
          success: false,
          message: error.message,
        };
      }

      return {
        success: false,
        message: 'Failed to refresh token',
      };
    }
  }

  /**
   * Parses time string to seconds
   * @param timeString - Time string (e.g., '7d', '24h', '60m')
   * @returns Time in seconds
   */
  private static parseTimeToSeconds(timeString: string): number {
    const unit = timeString.slice(-1);
    const value = parseInt(timeString.slice(0, -1), 10);

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 60 * 60;
      case 'd': return value * 24 * 60 * 60;
      default: return value; // Assume seconds if no unit
    }
  }
}

export default AuthService;