/**
 * Validation Middleware
 * File Path: backend/src/middleware/validation.ts
 * 
 * Request validation middleware using express-validator.
 * Provides comprehensive validation for all authentication endpoints.
 */

import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { ApiResponse, HttpStatusCodes, ValidationError } from '../types';

/**
 * Validation rule sets for different endpoints
 */

/**
 * Registration validation rules
 */
export const registerValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email address is too long'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),

  body('confirmPassword')
    .custom((value: any, { req }: { req: any }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

/**
 * Login validation rules
 */
export const loginValidation = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 1 })
    .withMessage('Password cannot be empty'),
];

/**
 * Forgot password validation rules
 */
export const forgotPasswordValidation = [
  body('email')
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
];

/**
 * Reset password validation rules
 */
export const resetPasswordValidation = [
  body('token')
    .notEmpty()
    .withMessage('Reset token is required')
    .isLength({ min: 1 })
    .withMessage('Reset token cannot be empty'),

  body('password')
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),

  body('confirmPassword')
    .custom((value: any, { req }: { req: any }) => {
      if (value !== req.body.password) {
        throw new Error('Passwords do not match');
      }
      return true;
    }),
];

/**
 * Refresh token validation rules
 */
export const refreshTokenValidation = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
    .isLength({ min: 1 })
    .withMessage('Refresh token cannot be empty'),
];

/**
 * Profile update validation rules
 */
export const updateProfileValidation = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('First name can only contain letters, spaces, hyphens, and apostrophes'),

  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/)
    .withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),

  body('email')
    .optional()
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
    .isLength({ max: 255 })
    .withMessage('Email address is too long'),
];

/**
 * Change password validation rules
 */
export const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 8, max: 128 })
    .withMessage('New password must be between 8 and 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).*$/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),

  body('confirmNewPassword')
    .custom((value: any, { req }: { req: any }) => {
      if (value !== req.body.newPassword) {
        throw new Error('New passwords do not match');
      }
      return true;
    }),
];

/**
 * Validation rule mapping
 */
const validationRules = {
  register: registerValidation,
  login: loginValidation,
  forgotPassword: forgotPasswordValidation,
  resetPassword: resetPasswordValidation,
  refreshToken: refreshTokenValidation,
  updateProfile: updateProfileValidation,
  changePassword: changePasswordValidation,
};

/**
 * Main validation middleware factory
 * @param validationType - Type of validation to apply
 * @returns Express middleware array
 */
export const validateRequest = (validationType: keyof typeof validationRules) => {
  return [
    ...validationRules[validationType],
    handleValidationErrors,
  ];
};

/**
 * Handles validation errors and returns formatted response
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const validationErrors: ValidationError[] = errors.array().map((error: any) => ({
      field: error.type === 'field' ? (error as any).path : 'unknown',
      message: error.msg,
      code: 'VALIDATION_ERROR',
    }));

    // Get the first error message for the main response
    const firstErrorMessage = validationErrors[0]?.message || 'Validation failed';

    const response: ApiResponse = {
      success: false,
      message: firstErrorMessage,
      errors: validationErrors,
      timestamp: new Date().toISOString(),
    };

    res.status(HttpStatusCodes.BAD_REQUEST).json(response);
    return;
  }

  next();
};

/**
 * Custom validation functions
 */

/**
 * Validates if the provided password meets strength requirements
 * @param password - Password to validate
 * @returns Object with validation result and errors
 */
export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Length check
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters long');
  }

  // Character type checks
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

  // Common pattern checks
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password cannot contain repeated characters (more than 2 in a row)');
  }

  if (/123456|654321|qwerty|password|admin|letmein/.test(password.toLowerCase())) {
    errors.push('Password contains common patterns that are easily guessed');
  }

  // Sequential character check
  const sequentialPatterns = [
    'abcd', 'bcde', 'cdef', 'defg', 'efgh', 'fghi', 'ghij', 'hijk',
    'ijkl', 'jklm', 'klmn', 'lmno', 'mnop', 'nopq', 'opqr', 'pqrs',
    'qrst', 'rstu', 'stuv', 'tuvw', 'uvwx', 'vwxy', 'wxyz',
    '1234', '2345', '3456', '4567', '5678', '6789'
  ];

  for (const pattern of sequentialPatterns) {
    if (password.toLowerCase().includes(pattern)) {
      errors.push('Password cannot contain sequential characters');
      break;
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validates email format using comprehensive regex
 * @param email - Email to validate
 * @returns Boolean indicating if email is valid
 */
export const validateEmailFormat = (email: string): boolean => {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  
  // Additional checks
  if (email.length > 255) return false;
  if (email.startsWith('.') || email.endsWith('.')) return false;
  if (email.includes('..')) return false;
  
  return emailRegex.test(email);
};

/**
 * Validates name format (first name, last name)
 * @param name - Name to validate
 * @returns Boolean indicating if name is valid
 */
export const validateNameFormat = (name: string): boolean => {
  if (!name || name.length < 2 || name.length > 50) {
    return false;
  }
  
  // Allow letters, spaces, hyphens, and apostrophes
  const nameRegex = /^[a-zA-Z\s'-]+$/;
  
  // Additional checks
  if (name.startsWith(' ') || name.endsWith(' ')) return false;
  if (name.includes('  ')) return false; // No double spaces
  
  return nameRegex.test(name);
};

/**
 * Sanitizes input data
 * @param data - Data to sanitize
 * @returns Sanitized data
 */
export const sanitizeInput = (data: any): any => {
  if (typeof data === 'string') {
    return data.trim().replace(/\s+/g, ' '); // Normalize whitespace
  }
  
  if (typeof data === 'object' && data !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(data)) {
      sanitized[key] = sanitizeInput(value);
    }
    return sanitized;
  }
  
  return data;
};

/**
 * Middleware to sanitize request body
 */
export const sanitizeRequestBody = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  next();
};

export default {
  validateRequest,
  handleValidationErrors,
  validatePasswordStrength,
  validateEmailFormat,
  validateNameFormat,
  sanitizeInput,
  sanitizeRequestBody,
};