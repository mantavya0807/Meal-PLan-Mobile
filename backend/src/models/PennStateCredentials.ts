/**
 * Penn State Credentials Model
 * File Path: backend/src/models/PennStateCredentials.ts
 * 
 * Database model for encrypted Penn State credentials using Supabase client.
 * Handles secure storage and retrieval of Penn State login information.
 */

import crypto from 'crypto';
import { getSupabaseClient, handleSupabaseError } from '../config/database';
import config from '../config/environment';

/**
 * Penn State credentials interface
 */
export interface PennStateCredentials {
  id: string;
  userId: string;
  encryptedUsername: string;
  encryptedPassword: string;
  encryptionKeyId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Decrypted credentials interface
 */
export interface DecryptedCredentials {
  username: string;
  password: string;
}

/**
 * Penn State credentials model class
 */
export class PennStateCredentialsModel {
  
  // Encryption algorithm
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16;
  private static readonly TAG_LENGTH = 16;
  private static readonly KEY_LENGTH = 32;

  /**
   * Generates encryption key from JWT secret and user ID
   * @param userId - User ID for key derivation
   * @returns Encryption key buffer
   */
  private static generateEncryptionKey(userId: string): Buffer {
    // Use PBKDF2 to derive encryption key from JWT secret and user ID
    return crypto.pbkdf2Sync(
      config.JWT_SECRET,
      userId,
      100000, // iterations
      this.KEY_LENGTH,
      'sha256'
    );
  }

  /**
   * Encrypts text using AES-256-GCM
   * @param text - Text to encrypt
   * @param key - Encryption key
   * @returns Encrypted data with IV and auth tag
   */
  private static encrypt(text: string, key: Buffer): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
    cipher.setAAD(Buffer.from('penn_state_credentials'));

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const authTag = cipher.getAuthTag();
    
    // Combine IV + authTag + encrypted data
    const combined = Buffer.concat([iv, authTag, Buffer.from(encrypted, 'base64')]);
    return combined.toString('base64');
  }

  /**
   * Decrypts text using AES-256-GCM
   * @param encryptedData - Encrypted data with IV and auth tag
   * @param key - Decryption key
   * @returns Decrypted text
   */
  private static decrypt(encryptedData: string, key: Buffer): string {
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract IV, auth tag, and encrypted data
    const iv = combined.slice(0, this.IV_LENGTH);
    const authTag = combined.slice(this.IV_LENGTH, this.IV_LENGTH + this.TAG_LENGTH);
    const encrypted = combined.slice(this.IV_LENGTH + this.TAG_LENGTH);
    
    const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    decipher.setAAD(Buffer.from('penn_state_credentials'));
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * Stores encrypted Penn State credentials for a user
   * @param userId - User ID
   * @param username - Penn State username/email
   * @param password - Penn State password
   * @returns Created credentials record (without sensitive data)
   */
  static async store(
    userId: string,
    username: string,
    password: string
  ): Promise<{ id: string; userId: string; encryptionKeyId: string }> {
    const supabase = getSupabaseClient();
    
    try {
      // Generate encryption key
      const encryptionKey = this.generateEncryptionKey(userId);
      const encryptionKeyId = crypto.createHash('sha256').update(encryptionKey).digest('hex').substring(0, 16);
      
      // Encrypt credentials
      const encryptedUsername = this.encrypt(username, encryptionKey);
      const encryptedPassword = this.encrypt(password, encryptionKey);
      
      // Store in database (upsert to handle updates)
      const { data, error } = await (supabase
        .from('penn_state_credentials') as any)
        .upsert([
          {
            user_id: userId,
            encrypted_username: encryptedUsername,
            encrypted_password: encryptedPassword,
            encryption_key_id: encryptionKeyId,
          }
        ], { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        })
        .select('id, user_id, encryption_key_id, created_at, updated_at')
        .single();
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      if (!data) {
        throw new Error('Failed to store Penn State credentials');
      }
      
      console.log(`Penn State credentials stored for user: ${userId}`);
      
      return {
        id: data.id,
        userId: data.user_id,
        encryptionKeyId: data.encryption_key_id,
      };
      
    } catch (error: any) {
      console.error('Error storing Penn State credentials:', error);
      throw new Error('Failed to store Penn State credentials');
    }
  }

  /**
   * Retrieves and decrypts Penn State credentials for a user
   * @param userId - User ID
   * @returns Decrypted credentials or null if not found
   */
  static async retrieve(userId: string): Promise<DecryptedCredentials | null> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await (supabase
        .from('penn_state_credentials') as any)
        .select('encrypted_username, encrypted_password, encryption_key_id')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No credentials found
        }
        throw new Error(handleSupabaseError(error));
      }
      
      if (!data) {
        return null;
      }
      
      // Generate decryption key
      const decryptionKey = this.generateEncryptionKey(userId);
      
      // Verify key ID matches (basic integrity check)
      const expectedKeyId = crypto.createHash('sha256').update(decryptionKey).digest('hex').substring(0, 16);
      if (data.encryption_key_id !== expectedKeyId) {
        console.error('Encryption key mismatch for user:', userId);
        throw new Error('Credential decryption failed - key mismatch');
      }
      
      // Decrypt credentials
      const username = this.decrypt(data.encrypted_username, decryptionKey);
      const password = this.decrypt(data.encrypted_password, decryptionKey);
      
      return { username, password };
      
    } catch (error: any) {
      console.error('Error retrieving Penn State credentials:', error);
      throw new Error('Failed to retrieve Penn State credentials');
    }
  }

  /**
   * Checks if user has stored Penn State credentials
   * @param userId - User ID
   * @returns Boolean indicating if credentials exist
   */
  static async hasCredentials(userId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await supabase
        .from('penn_state_credentials')
        .select('id')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          return false; // No credentials found
        }
        throw new Error(handleSupabaseError(error));
      }
      
      return !!data;
    } catch (error) {
      console.error('Error checking Penn State credentials:', error);
      return false;
    }
  }

  /**
   * Updates stored Penn State credentials
   * @param userId - User ID
   * @param username - New Penn State username/email
   * @param password - New Penn State password
   * @returns Updated credentials record info
   */
  static async update(
    userId: string,
    username: string,
    password: string
  ): Promise<{ success: boolean }> {
    try {
      await this.store(userId, username, password); // store() handles upsert
      return { success: true };
    } catch (error) {
      console.error('Error updating Penn State credentials:', error);
      throw new Error('Failed to update Penn State credentials');
    }
  }

  /**
   * Deletes Penn State credentials for a user
   * @param userId - User ID
   * @returns Boolean indicating success
   */
  static async delete(userId: string): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    try {
      const { error } = await supabase
        .from('penn_state_credentials')
        .delete()
        .eq('user_id', userId);
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      console.log(`Penn State credentials deleted for user: ${userId}`);
      return true;
      
    } catch (error) {
      console.error('Error deleting Penn State credentials:', error);
      throw new Error('Failed to delete Penn State credentials');
    }
  }

  /**
   * Lists all users with stored credentials (admin function)
   * @returns Array of user IDs with credentials
   */
  static async listUsersWithCredentials(): Promise<string[]> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await supabase
        .from('penn_state_credentials')
        .select('user_id');
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      return (data || []).map((row: any) => row.user_id);
      
    } catch (error) {
      console.error('Error listing users with credentials:', error);
      throw new Error('Failed to list users with credentials');
    }
  }

  /**
   * Cleanup old or invalid credential records
   * @param olderThanDays - Remove credentials older than this many days
   * @returns Number of records cleaned up
   */
  static async cleanup(olderThanDays: number = 30): Promise<number> {
    const supabase = getSupabaseClient();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
      
      const { data, error } = await supabase
        .from('penn_state_credentials')
        .delete()
        .lt('updated_at', cutoffDate.toISOString())
        .select('id');
      
      if (error) {
        throw new Error(handleSupabaseError(error));
      }
      
      const cleanedCount = data ? data.length : 0;
      console.log(`Cleaned up ${cleanedCount} old Penn State credential records`);
      
      return cleanedCount;
      
    } catch (error) {
      console.error('Error cleaning up Penn State credentials:', error);
      throw new Error('Failed to cleanup Penn State credentials');
    }
  }

  /**
   * Validates encrypted credentials integrity
   * @param userId - User ID to validate
   * @returns Boolean indicating if credentials are valid and decryptable
   */
  static async validateCredentials(userId: string): Promise<boolean> {
    try {
      const credentials = await this.retrieve(userId);
      return credentials !== null && 
             credentials.username.length > 0 && 
             credentials.password.length > 0;
    } catch (error) {
      console.error('Credential validation failed for user:', userId, error);
      return false;
    }
  }
}

export default PennStateCredentialsModel;