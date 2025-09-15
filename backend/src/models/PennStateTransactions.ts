/**
 * Penn State Transactions Model
 * File Path: backend/src/models/PennStateTransactions.ts
 * 
 * Database model for Penn State meal plan transactions using Supabase client.
 * Handles storage, retrieval, and management of transaction data from Penn State.
 */

import { getSupabaseClient, handleSupabaseError } from '../config/database';

/**
 * Penn State transaction interface matching database schema
 */
export interface PennStateTransaction {
  id: string;
  userId: string;
  transactionId?: string | null;
  transactionDate: Date;
  location: string;
  description?: string | null;
  amount: number;
  balanceAfter?: number | null;
  accountType?: string | null;
  cardNumber?: string | null;
  rawData?: any | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Raw transaction data from Penn State extraction
 */
export interface RawPennStateTransaction {
  date: string; // ISO date string or date text
  account: string; // Account type
  cardNumber: string; // Card number (last 4 digits)
  location: string; // Dining location
  type: string; // Transaction type
  amount: number; // Transaction amount
  currency?: string; // Currency symbol
}

/**
 * Transaction creation data
 */
export interface CreateTransactionData {
  userId: string;
  transactionId?: string | null;
  transactionDate: Date;
  location: string;
  description?: string | null;
  amount: number;
  balanceAfter?: number | null;
  accountType?: string | null;
  cardNumber?: string | null;
  rawData?: any;
}

/**
 * Transaction query filters
 */
export interface TransactionFilters {
  userId: string;
  startDate?: Date;
  endDate?: Date;
  location?: string;
  accountType?: string;
  minAmount?: number;
  maxAmount?: number;
  limit?: number;
  offset?: number;
}

/**
 * Transaction statistics interface
 */
export interface TransactionStats {
  totalTransactions: number;
  totalSpent: number;
  averageTransaction: number;
  topLocations: Array<{
    location: string;
    count: number;
    totalSpent: number;
  }>;
  monthlySpending: Array<{
    month: string;
    totalSpent: number;
    transactionCount: number;
  }>;
}

/**
 * Penn State Transactions model class
 */
export class PennStateTransactionsModel {

  /**
   * Creates a new transaction record
   * @param transactionData - Transaction data to store
   * @returns Created transaction record
   */
  static async create(transactionData: CreateTransactionData): Promise<PennStateTransaction> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await (supabase
        .from('penn_state_transactions') as any)
        .insert([
          {
            user_id: transactionData.userId,
            transaction_id: transactionData.transactionId || null,
            transaction_date: transactionData.transactionDate.toISOString(),
            location: transactionData.location,
            description: transactionData.description || null,
            amount: transactionData.amount,
            balance_after: transactionData.balanceAfter || null,
            account_type: transactionData.accountType || null,
            card_number: transactionData.cardNumber || null,
            raw_data: transactionData.rawData || null,
          }
        ])
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new Error('Duplicate transaction detected');
        }
        throw new Error(handleSupabaseError(error));
      }

      if (!data) {
        throw new Error('Failed to create transaction record');
      }

      return this.mapDbRowToTransaction(data);

    } catch (error) {
      console.error('Error creating Penn State transaction:', error);
      throw error;
    }
  }

  /**
   * Creates multiple transaction records in a batch
   * @param transactions - Array of transaction data to store
   * @returns Array of created transaction records
   */
  static async createBatch(transactions: CreateTransactionData[]): Promise<PennStateTransaction[]> {
    const supabase = getSupabaseClient();
    
    try {
      const insertData = transactions.map(tx => ({
        user_id: tx.userId,
        transaction_id: tx.transactionId || null,
        transaction_date: tx.transactionDate.toISOString(),
        location: tx.location,
        description: tx.description || null,
        amount: tx.amount,
        balance_after: tx.balanceAfter || null,
        account_type: tx.accountType || null,
        card_number: tx.cardNumber || null,
        raw_data: tx.rawData || null,
      }));

      const { data, error } = await (supabase
        .from('penn_state_transactions') as any)
        .insert(insertData)
        .select();

      if (error) {
        throw new Error(handleSupabaseError(error));
      }

      if (!data || data.length === 0) {
        throw new Error('Failed to create transaction records');
      }

      return data.map((row: any) => this.mapDbRowToTransaction(row));

    } catch (error) {
      console.error('Error creating Penn State transactions batch:', error);
      throw error;
    }
  }

  /**
   * Converts raw Penn State transaction data to our format
   * @param rawTransaction - Raw transaction from Penn State extraction
   * @param userId - User ID to associate with transaction
   * @returns Transaction data ready for database insertion
   */
  static convertRawTransaction(
    rawTransaction: RawPennStateTransaction, 
    userId: string
  ): CreateTransactionData {
    // Parse the date - handle both ISO strings and date text
    let transactionDate: Date;
    try {
      transactionDate = new Date(rawTransaction.date);
      if (isNaN(transactionDate.getTime())) {
        throw new Error('Invalid date');
      }
    } catch (error) {
      console.warn(`Failed to parse transaction date: ${rawTransaction.date}`);
      transactionDate = new Date(); // Fallback to current date
    }

    // Clean up card number (extract last 4 digits if needed)
    const cardNumber = rawTransaction.cardNumber?.replace(/\D/g, '').slice(-4) || null;

    return {
      userId,
      transactionDate,
      location: rawTransaction.location.trim(),
      description: rawTransaction.type?.trim() || null,
      amount: rawTransaction.amount,
      accountType: rawTransaction.account?.trim() || null,
      cardNumber: cardNumber ? `****${cardNumber}` : null,
      rawData: rawTransaction,
    };
  }

  /**
   * Retrieves transactions for a user with optional filtering
   * @param filters - Query filters
   * @returns Array of transactions matching filters
   */
  static async getByFilters(filters: TransactionFilters): Promise<PennStateTransaction[]> {
    const supabase = getSupabaseClient();
    
    try {
      let query = supabase
        .from('penn_state_transactions')
        .select('*')
        .eq('user_id', filters.userId)
        .order('transaction_date', { ascending: false });

      // Apply date filters
      if (filters.startDate) {
        query = query.gte('transaction_date', filters.startDate.toISOString());
      }
      if (filters.endDate) {
        query = query.lte('transaction_date', filters.endDate.toISOString());
      }

      // Apply other filters
      if (filters.location) {
        query = query.ilike('location', `%${filters.location}%`);
      }
      if (filters.accountType) {
        query = query.eq('account_type', filters.accountType);
      }
      if (filters.minAmount !== undefined) {
        query = query.gte('amount', filters.minAmount);
      }
      if (filters.maxAmount !== undefined) {
        query = query.lte('amount', filters.maxAmount);
      }

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }
      if (filters.offset) {
        query = query.range(filters.offset, (filters.offset + (filters.limit || 10)) - 1);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(handleSupabaseError(error));
      }

      return (data || []).map(row => this.mapDbRowToTransaction(row));

    } catch (error) {
      console.error('Error fetching Penn State transactions:', error);
      throw error;
    }
  }

  /**
   * Gets recent transactions for a user
   * @param userId - User ID
   * @param limit - Number of transactions to retrieve (default: 20)
   * @returns Array of recent transactions
   */
  static async getRecent(userId: string, limit: number = 20): Promise<PennStateTransaction[]> {
    return this.getByFilters({
      userId,
      limit,
    });
  }

  /**
   * Gets transactions for a specific date range
   * @param userId - User ID
   * @param startDate - Start date for range
   * @param endDate - End date for range
   * @returns Array of transactions in date range
   */
  static async getByDateRange(
    userId: string, 
    startDate: Date, 
    endDate: Date
  ): Promise<PennStateTransaction[]> {
    return this.getByFilters({
      userId,
      startDate,
      endDate,
    });
  }

  /**
   * Gets the latest transaction date for a user
   * @param userId - User ID
   * @returns Latest transaction date or null if no transactions
   */
  static async getLatestTransactionDate(userId: string): Promise<Date | null> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await (supabase
        .from('penn_state_transactions') as any)
        .select('transaction_date')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw new Error(handleSupabaseError(error));
      }

      return data ? new Date(data.transaction_date) : null;

    } catch (error) {
      console.error('Error getting latest transaction date:', error);
      return null;
    }
  }

  /**
   * Gets transaction statistics for a user
   * @param userId - User ID
   * @param startDate - Optional start date for statistics
   * @param endDate - Optional end date for statistics
   * @returns Transaction statistics
   */
  static async getStats(
    userId: string, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<TransactionStats> {
    const supabase = getSupabaseClient();
    
    try {
      // Build base query
      let query = (supabase
        .from('penn_state_transactions') as any)
        .select('transaction_date, location, amount')
        .eq('user_id', userId);

      if (startDate) {
        query = query.gte('transaction_date', startDate.toISOString());
      }
      if (endDate) {
        query = query.lte('transaction_date', endDate.toISOString());
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(handleSupabaseError(error));
      }

      const transactions = data || [];
      
      // Calculate basic stats
      const totalTransactions = transactions.length;
      const totalSpent = transactions.reduce((sum: number, tx: any) => sum + Math.abs(tx.amount), 0);
      const averageTransaction = totalTransactions > 0 ? totalSpent / totalTransactions : 0;

      // Calculate top locations
      const locationStats = transactions.reduce((acc: any, tx: any) => {
        const location = tx.location;
        if (!acc[location]) {
          acc[location] = { count: 0, totalSpent: 0 };
        }
        acc[location].count++;
        acc[location].totalSpent += Math.abs(tx.amount);
        return acc;
      }, {} as Record<string, { count: number; totalSpent: number }>);

      const topLocations = Object.entries(locationStats)
        .map(([location, stats]: [string, any]) => ({
          location,
          count: stats.count,
          totalSpent: stats.totalSpent,
        }))
        .sort((a, b) => b.totalSpent - a.totalSpent)
        .slice(0, 5);

      // Calculate monthly spending
      const monthlyStats = transactions.reduce((acc: any, tx: any) => {
        const month = new Date(tx.transaction_date).toISOString().substring(0, 7); // YYYY-MM
        if (!acc[month]) {
          acc[month] = { totalSpent: 0, transactionCount: 0 };
        }
        acc[month].totalSpent += Math.abs(tx.amount);
        acc[month].transactionCount++;
        return acc;
      }, {} as Record<string, { totalSpent: number; transactionCount: number }>);

      const monthlySpending = Object.entries(monthlyStats)
        .map(([month, stats]: [string, any]) => ({
          month,
          totalSpent: stats.totalSpent,
          transactionCount: stats.transactionCount,
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        totalTransactions,
        totalSpent,
        averageTransaction,
        topLocations,
        monthlySpending,
      };

    } catch (error) {
      console.error('Error calculating transaction stats:', error);
      throw error;
    }
  }

  /**
   * Deletes transactions for a user (e.g., when unlinking account)
   * @param userId - User ID
   * @returns Number of transactions deleted
   */
  static async deleteForUser(userId: string): Promise<number> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await supabase
        .from('penn_state_transactions')
        .delete()
        .eq('user_id', userId)
        .select('id');

      if (error) {
        throw new Error(handleSupabaseError(error));
      }

      const deletedCount = data ? data.length : 0;
      console.log(`Deleted ${deletedCount} Penn State transactions for user: ${userId}`);
      
      return deletedCount;

    } catch (error) {
      console.error('Error deleting Penn State transactions:', error);
      throw error;
    }
  }

  /**
   * Checks if a transaction already exists (duplicate prevention)
   * @param userId - User ID
   * @param transactionDate - Transaction date
   * @param location - Transaction location
   * @param amount - Transaction amount
   * @returns True if transaction exists
   */
  static async exists(
    userId: string,
    transactionDate: Date,
    location: string,
    amount: number
  ): Promise<boolean> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await supabase
        .from('penn_state_transactions')
        .select('id')
        .eq('user_id', userId)
        .eq('transaction_date', transactionDate.toISOString())
        .eq('location', location)
        .eq('amount', amount)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw new Error(handleSupabaseError(error));
      }

      return !!data;

    } catch (error) {
      console.error('Error checking transaction existence:', error);
      return false;
    }
  }

  /**
   * Cleanup old transactions (e.g., older than a certain date)
   * @param olderThanDate - Delete transactions older than this date
   * @returns Number of transactions cleaned up
   */
  static async cleanup(olderThanDate: Date): Promise<number> {
    const supabase = getSupabaseClient();
    
    try {
      const { data, error } = await supabase
        .from('penn_state_transactions')
        .delete()
        .lt('transaction_date', olderThanDate.toISOString())
        .select('id');

      if (error) {
        throw new Error(handleSupabaseError(error));
      }

      const cleanedCount = data ? data.length : 0;
      console.log(`Cleaned up ${cleanedCount} old Penn State transactions`);
      
      return cleanedCount;

    } catch (error) {
      console.error('Error cleaning up Penn State transactions:', error);
      throw error;
    }
  }

  /**
   * Maps database row to PennStateTransaction interface
   * @param row - Database row object
   * @returns Mapped PennStateTransaction object
   */
  private static mapDbRowToTransaction(row: any): PennStateTransaction {
    return {
      id: row.id,
      userId: row.user_id,
      transactionId: row.transaction_id,
      transactionDate: new Date(row.transaction_date),
      location: row.location,
      description: row.description,
      amount: parseFloat(row.amount),
      balanceAfter: row.balance_after ? parseFloat(row.balance_after) : null,
      accountType: row.account_type,
      cardNumber: row.card_number,
      rawData: row.raw_data,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

export default PennStateTransactionsModel;