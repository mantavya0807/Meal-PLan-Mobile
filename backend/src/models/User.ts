/**
 * User Model for Supabase with Penn State Integration
 * File Path: backend/src/models/User.ts
 * 
 * Database model for user operations using Supabase client.
 * Handles CRUD operations, authentication helpers, and Penn State integration.
 */

import { getSupabaseClient, handleSupabaseError } from '../config/database';
import { User, UserPublic } from '../types';

/**
 * Penn State account status enum
 */
export enum PennStateStatus {
  NOT_LINKED = 'not_linked',
  LINKING = 'linking',
  LINKED = 'linked',
  ERROR = 'error',
  EXPIRED = 'expired'
}

/**
 * Extended User interface with Penn State fields
 */
export interface UserWithPennState extends User {
  pennStateEmail?: string | null;
  pennStateLinkedAt?: Date | null;
  pennStateStatus: PennStateStatus;
  pennStateLastSync?: Date | null;
}

/**
 * Extended UserPublic interface with Penn State fields
 */
export interface UserPublicWithPennState extends UserPublic {
  pennStateEmail?: string | null;
  pennStateLinkedAt?: Date | null;
  pennStateStatus: PennStateStatus;
  pennStateLastSync?: Date | null;
}

/**
 * Penn State account linking data
 */
export interface PennStateLinkingData {
  email: string;
  encryptedCredentials: {
    username: string;
    password: string;
  };
  sessionData?: {
    cookies: any[];
    userAgent: string;
  };
}

/**
 * User model class for Supabase database operations with Penn State integration
 */
export class UserModel {
  
  /**
   * Creates a new user in the database
   * @param userData - User data excluding id, timestamps
   * @returns Created user (without password)
   */
  static async create(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  }): Promise<UserPublicWithPennState> {
    const { firstName, lastName, email, password } = userData;
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await (supabase
        .from('users') as any)
        .insert([
          {
            first_name: firstName,
            last_name: lastName,
            email: email.toLowerCase(),
            password,
            penn_state_status: PennStateStatus.NOT_LINKED,
          }
        ])
        .select('id, first_name, last_name, email, is_verified, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at')
        .single();
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Email already exists');
        }
        throw new Error(handleSupabaseError(error));
      }
      
      if (!data) {
        throw new Error('Failed to create user');
      }
      
      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        isVerified: data.is_verified,
        pennStateEmail: data.penn_state_email,
        pennStateStatus: data.penn_state_status,
        pennStateLinkedAt: data.penn_state_linked_at ? new Date(data.penn_state_linked_at) : null,
        pennStateLastSync: data.penn_state_last_sync ? new Date(data.penn_state_last_sync) : null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
      
    } catch (error: any) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Finds a user by email address
   * @param email - User email address
   * @param includePassword - Whether to include password in result
   * @returns User data or null if not found
   */
  static async findByEmail(email: string, includePassword: boolean = false): Promise<UserWithPennState | UserPublicWithPennState | null> {
    const supabase = getSupabaseClient();
    
    const selectFields = includePassword 
      ? 'id, first_name, last_name, email, password, is_verified, reset_password_token, reset_password_expires, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at'
      : 'id, first_name, last_name, email, is_verified, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at';
    
    try {
      const { data, error } = await (supabase
        .from('users') as any)
        .select(selectFields)
        .eq('email', email.toLowerCase())
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        throw new Error(handleSupabaseError(error));
      }
      
      if (!data) {
        return null;
      }
      
      if (includePassword) {
        return {
          id: data.id,
          firstName: data.first_name,
          lastName: data.last_name,
          email: data.email,
          password: data.password,
          isVerified: data.is_verified,
          resetPasswordToken: data.reset_password_token,
          resetPasswordExpires: data.reset_password_expires ? new Date(data.reset_password_expires) : null,
          pennStateEmail: data.penn_state_email,
          pennStateStatus: data.penn_state_status || PennStateStatus.NOT_LINKED,
          pennStateLinkedAt: data.penn_state_linked_at ? new Date(data.penn_state_linked_at) : null,
          pennStateLastSync: data.penn_state_last_sync ? new Date(data.penn_state_last_sync) : null,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        } as UserWithPennState;
      }
      
      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        isVerified: data.is_verified,
        pennStateEmail: data.penn_state_email,
        pennStateStatus: data.penn_state_status || PennStateStatus.NOT_LINKED,
        pennStateLinkedAt: data.penn_state_linked_at ? new Date(data.penn_state_linked_at) : null,
        pennStateLastSync: data.penn_state_last_sync ? new Date(data.penn_state_last_sync) : null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      } as UserPublicWithPennState;
      
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw new Error('Failed to find user');
    }
  }

  /**
   * Finds a user by ID
   * @param id - User ID
   * @param includePassword - Whether to include password in result
   * @returns User data or null if not found
   */
  static async findById(id: string, includePassword: boolean = false): Promise<UserWithPennState | UserPublicWithPennState | null> {
    const supabase = getSupabaseClient();
    
    const selectFields = includePassword 
      ? 'id, first_name, last_name, email, password, is_verified, reset_password_token, reset_password_expires, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at'
      : 'id, first_name, last_name, email, is_verified, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at';
    
    try {
      const { data, error } = await (supabase
        .from('users') as any)
        .select(selectFields)
        .eq('id', id)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // User not found
        }
        throw new Error(handleSupabaseError(error));
      }
      
      if (!data) {
        return null;
      }
      
      if (includePassword) {
        return {
          id: data.id,
          firstName: data.first_name,
          lastName: data.last_name,
          email: data.email,
          password: data.password,
          isVerified: data.is_verified,
          resetPasswordToken: data.reset_password_token,
          resetPasswordExpires: data.reset_password_expires ? new Date(data.reset_password_expires) : null,
          pennStateEmail: data.penn_state_email,
          pennStateStatus: data.penn_state_status || PennStateStatus.NOT_LINKED,
          pennStateLinkedAt: data.penn_state_linked_at ? new Date(data.penn_state_linked_at) : null,
          pennStateLastSync: data.penn_state_last_sync ? new Date(data.penn_state_last_sync) : null,
          createdAt: new Date(data.created_at),
          updatedAt: new Date(data.updated_at),
        } as UserWithPennState;
      }
      
      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        isVerified: data.is_verified,
        pennStateEmail: data.penn_state_email,
        pennStateStatus: data.penn_state_status || PennStateStatus.NOT_LINKED,
        pennStateLinkedAt: data.penn_state_linked_at ? new Date(data.penn_state_linked_at) : null,
        pennStateLastSync: data.penn_state_last_sync ? new Date(data.penn_state_last_sync) : null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      } as UserPublicWithPennState;
      
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw new Error('Failed to find user');
    }
  }

  /**
   * Updates Penn State linking status and information
   * @param userId - User ID
   * @param pennStateData - Penn State account data
   * @returns Updated user data (without password)
   */
  static async updatePennStateStatus(
    userId: string, 
    pennStateData: {
      email?: string;
      status: PennStateStatus;
      linkedAt?: Date;
      lastSync?: Date;
    }
  ): Promise<UserPublicWithPennState> {
    const supabase = getSupabaseClient();
    
    const updateData: any = {
      penn_state_status: pennStateData.status,
    };

    if (pennStateData.email) {
      updateData.penn_state_email = pennStateData.email.toLowerCase();
    }

    if (pennStateData.linkedAt) {
      updateData.penn_state_linked_at = pennStateData.linkedAt.toISOString();
    }

    if (pennStateData.lastSync) {
      updateData.penn_state_last_sync = pennStateData.lastSync.toISOString();
    }
    
    try {
      const { data, error } = await (supabase
        .from('users') as any)
        .update(updateData)
        .eq('id', userId)
        .select('id, first_name, last_name, email, is_verified, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at')
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      if (!data) {
        throw new Error('User not found');
      }
      
      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        isVerified: data.is_verified,
        pennStateEmail: data.penn_state_email,
        pennStateStatus: data.penn_state_status,
        pennStateLinkedAt: data.penn_state_linked_at ? new Date(data.penn_state_linked_at) : null,
        pennStateLastSync: data.penn_state_last_sync ? new Date(data.penn_state_last_sync) : null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
      
    } catch (error) {
      console.error('Error updating Penn State status:', error);
      throw new Error('Failed to update Penn State status');
    }
  }

  /**
   * Updates user's password
   * @param id - User ID
   * @param hashedPassword - New hashed password
   * @returns Updated user data (without password)
   */
  static async updatePassword(id: string, hashedPassword: string): Promise<UserPublicWithPennState> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await (supabase
        .from('users') as any)
        .update({
          password: hashedPassword,
          reset_password_token: null,
          reset_password_expires: null,
        })
        .eq('id', id)
        .select('id, first_name, last_name, email, is_verified, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at')
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      if (!data) {
        throw new Error('User not found');
      }
      
      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        isVerified: data.is_verified,
        pennStateEmail: data.penn_state_email,
        pennStateStatus: data.penn_state_status || PennStateStatus.NOT_LINKED,
        pennStateLinkedAt: data.penn_state_linked_at ? new Date(data.penn_state_linked_at) : null,
        pennStateLastSync: data.penn_state_last_sync ? new Date(data.penn_state_last_sync) : null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
      
    } catch (error) {
      console.error('Error updating password:', error);
      throw new Error('Failed to update password');
    }
  }

  /**
   * Sets password reset token and expiration
   * @param email - User email
   * @param token - Reset token
   * @param expiresAt - Token expiration timestamp
   * @returns Updated user data (without password)
   */
  static async setResetPasswordToken(email: string, token: string, expiresAt: Date): Promise<UserPublicWithPennState> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await (supabase
        .from('users') as any)
        .update({
          reset_password_token: token,
          reset_password_expires: expiresAt.toISOString(),
        })
        .eq('email', email.toLowerCase())
        .select('id, first_name, last_name, email, is_verified, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at')
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      if (!data) {
        throw new Error('User not found');
      }
      
      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        isVerified: data.is_verified,
        pennStateEmail: data.penn_state_email,
        pennStateStatus: data.penn_state_status || PennStateStatus.NOT_LINKED,
        pennStateLinkedAt: data.penn_state_linked_at ? new Date(data.penn_state_linked_at) : null,
        pennStateLastSync: data.penn_state_last_sync ? new Date(data.penn_state_last_sync) : null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
      
    } catch (error) {
      console.error('Error setting reset password token:', error);
      throw new Error('Failed to set reset password token');
    }
  }

  /**
   * Finds user by reset password token
   * @param token - Reset password token
   * @returns User data with password if token is valid and not expired
   */
  static async findByResetToken(token: string): Promise<UserWithPennState | null> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await (supabase
        .from('users') as any)
        .select('id, first_name, last_name, email, password, is_verified, reset_password_token, reset_password_expires, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at')
        .eq('reset_password_token', token)
        .gt('reset_password_expires', new Date().toISOString())
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Token not found or expired
        }
        throw new Error(handleSupabaseError(error));
      }
      
      if (!data) {
        return null;
      }
      
      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        password: data.password,
        isVerified: data.is_verified,
        resetPasswordToken: data.reset_password_token,
        resetPasswordExpires: data.reset_password_expires ? new Date(data.reset_password_expires) : null,
        pennStateEmail: data.penn_state_email,
        pennStateStatus: data.penn_state_status || PennStateStatus.NOT_LINKED,
        pennStateLinkedAt: data.penn_state_linked_at ? new Date(data.penn_state_linked_at) : null,
        pennStateLastSync: data.penn_state_last_sync ? new Date(data.penn_state_last_sync) : null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
      
    } catch (error) {
      console.error('Error finding user by reset token:', error);
      throw new Error('Failed to find user by reset token');
    }
  }

  /**
   * Verifies user's email address
   * @param id - User ID
   * @returns Updated user data (without password)
   */
  static async verifyEmail(id: string): Promise<UserPublicWithPennState> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await (supabase
        .from('users') as any)
        .update({ is_verified: true })
        .eq('id', id)
        .select('id, first_name, last_name, email, is_verified, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at')
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      if (!data) {
        throw new Error('User not found');
      }
      
      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        isVerified: data.is_verified,
        pennStateEmail: data.penn_state_email,
        pennStateStatus: data.penn_state_status || PennStateStatus.NOT_LINKED,
        pennStateLinkedAt: data.penn_state_linked_at ? new Date(data.penn_state_linked_at) : null,
        pennStateLastSync: data.penn_state_last_sync ? new Date(data.penn_state_last_sync) : null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
      
    } catch (error) {
      console.error('Error verifying email:', error);
      throw new Error('Failed to verify email');
    }
  }

  /**
   * Updates user profile information
   * @param id - User ID
   * @param updates - Fields to update
   * @returns Updated user data (without password)
   */
  static async updateProfile(id: string, updates: {
    firstName?: string;
    lastName?: string;
    email?: string;
  }): Promise<UserPublicWithPennState> {
    const supabase = getSupabaseClient();
    
    const updateData: any = {};
    if (updates.firstName) updateData.first_name = updates.firstName;
    if (updates.lastName) updateData.last_name = updates.lastName;
    if (updates.email) updateData.email = updates.email.toLowerCase();

    if (Object.keys(updateData).length === 0) {
      throw new Error('No fields to update');
    }
    
    try {
      const { data, error } = await (supabase
        .from('users') as any)
        .update(updateData)
        .eq('id', id)
        .select('id, first_name, last_name, email, is_verified, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at')
        .single();
      
      if (error) {
        if (error.code === '23505') {
          throw new Error('Email already exists');
        }
        throw new Error(handleSupabaseError(error));
      }
      
      if (!data) {
        throw new Error('User not found');
      }
      
      return {
        id: data.id,
        firstName: data.first_name,
        lastName: data.last_name,
        email: data.email,
        isVerified: data.is_verified,
        pennStateEmail: data.penn_state_email,
        pennStateStatus: data.penn_state_status || PennStateStatus.NOT_LINKED,
        pennStateLinkedAt: data.penn_state_linked_at ? new Date(data.penn_state_linked_at) : null,
        pennStateLastSync: data.penn_state_last_sync ? new Date(data.penn_state_last_sync) : null,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
      
    } catch (error: any) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }

  /**
   * Gets users with linked Penn State accounts
   * @returns Array of users with Penn State accounts
   */
  static async getUsersWithPennStateAccounts(): Promise<UserPublicWithPennState[]> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await (supabase
        .from('users') as any)
        .select('id, first_name, last_name, email, is_verified, penn_state_email, penn_state_status, penn_state_linked_at, penn_state_last_sync, created_at, updated_at')
        .eq('penn_state_status', PennStateStatus.LINKED);
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return (data || []).map((user: any) => ({
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        isVerified: user.is_verified,
        pennStateEmail: user.penn_state_email,
        pennStateStatus: user.penn_state_status,
        pennStateLinkedAt: user.penn_state_linked_at ? new Date(user.penn_state_linked_at) : null,
        pennStateLastSync: user.penn_state_last_sync ? new Date(user.penn_state_last_sync) : null,
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      }));
      
    } catch (error) {
      console.error('Error getting users with Penn State accounts:', error);
      throw new Error('Failed to get users with Penn State accounts');
    }
  }

  /**
   * Deletes a user account
   * @param id - User ID
   * @returns Boolean indicating success
   */
  static async deleteUser(id: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', id);
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw new Error('Failed to delete user');
    }
  }

  /**
   * Gets total user count
   * @returns Number of registered users
   */
  static async getUserCount(): Promise<number> {
    const supabase = getSupabaseClient();
    
    try {
      const { count, error } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return count || 0;
    } catch (error) {
      console.error('Error getting user count:', error);
      throw new Error('Failed to get user count');
    }
  }

  /**
   * Checks if email exists in database
   * @param email - Email to check
   * @returns Boolean indicating if email exists
   */
  static async emailExists(email: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return false; // User not found
        }
        throw new Error(handleSupabaseError(error));
      }
      
      return !!data;
    } catch (error) {
      console.error('Error checking email existence:', error);
      throw new Error('Failed to check email existence');
    }
  }

  /**
   * Cleans up expired reset password tokens
   * @returns Number of tokens cleaned up
   */
  static async cleanupExpiredTokens(): Promise<number> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await (supabase
        .from('users') as any)
        .update({
          reset_password_token: null,
          reset_password_expires: null,
        })
        .lt('reset_password_expires', new Date().toISOString())
        .not('reset_password_token', 'is', null)
        .select('id');
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return data ? data.length : 0;
    } catch (error) {
      console.error('Error cleaning up expired tokens:', error);
      throw new Error('Failed to cleanup expired tokens');
    }
  }
}

export default UserModel;