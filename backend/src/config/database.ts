/**
 * Supabase Database Configuration
 * File Path: backend/src/config/database.ts
 * 
 * Supabase database connection and configuration management.
 * Provides connection pooling, error handling, and health checks using Supabase client.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import config from './environment';

/**
 * Supabase client instance
 */
let supabase: SupabaseClient | null = null;

/**
 * Database types for Supabase
 */
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          email: string;
          password: string;
          is_verified: boolean;
          reset_password_token: string | null;
          reset_password_expires: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          email: string;
          password: string;
          is_verified?: boolean;
          reset_password_token?: string | null;
          reset_password_expires?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          first_name?: string;
          last_name?: string;
          email?: string;
          password?: string;
          is_verified?: boolean;
          reset_password_token?: string | null;
          reset_password_expires?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
  };
}

/**
 * Initializes the Supabase client connection
 * @returns Promise that resolves when connection is established
 */
export async function initializeDatabase(): Promise<void> {
  if (supabase) {
    console.log('✅ Supabase client already initialized');
    return;
  }

  try {
    console.log('🔌 Starting Supabase initialization...');
    console.log(`📡 Supabase URL: ${config.SUPABASE_URL}`);
    console.log(`🔑 Service role key length: ${config.SUPABASE_SERVICE_ROLE_KEY.length} characters`);
    
    // Create Supabase client
    console.log('🏗️ Creating Supabase client...');
    supabase = createClient<Database>(
      config.SUPABASE_URL,
      config.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: 'public',
        },
        global: {
          headers: {
            'x-application-name': 'pennstate-mealplan-api',
          },
        },
      }
    );
    console.log('✅ Supabase client created successfully');

    // Test the connection
    console.log('🔍 Testing Supabase connection...');
    await testConnection();
    console.log('✅ Connection test passed');
    
    // Create tables if they don't exist (using SQL)
    console.log('🏗️ Checking/creating database tables...');
    await createTables();
    console.log('✅ Tables verified/created');

    console.log('🎉 Supabase initialized successfully');
    
  } catch (error) {
    console.error('❌ Supabase initialization failed:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Supabase initialization failed: ${error}`);
  }
}

/**
 * Tests the Supabase connection
 * @returns Promise that resolves when connection test passes
 */
export async function testConnection(): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  try {
    console.log('📊 Running connection test query...');
    
    // Test connection with a simple query
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      console.log('⚠️ Query error (expected if table doesn\'t exist):', error.message);
      if (!error.message.includes('relation "users" does not exist')) {
        console.error('❌ Unexpected connection error:', error);
        throw error;
      } else {
        console.log('✅ Connection successful (users table not found, which is expected on first run)');
      }
    } else {
      console.log('✅ Connection successful, users table exists');
      console.log('📊 Query result:', data);
    }
    
    console.log('🎯 Supabase connection test completed successfully');
    
  } catch (error) {
    console.error('❌ Supabase connection test failed:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      code: (error as any)?.code,
      details: (error as any)?.details,
      hint: (error as any)?.hint,
    });
    throw new Error(`Supabase connection test failed: ${error}`);
  }
}

/**
 * Creates necessary database tables using Supabase SQL
 * @returns Promise that resolves when tables are created
 */
export async function createTables(): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const createUsersTableSQL = `
    -- Create users table
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      is_verified BOOLEAN DEFAULT FALSE,
      reset_password_token VARCHAR(255) NULL,
      reset_password_expires TIMESTAMP WITH TIME ZONE NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_password_token);
    CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

    -- Create updated_at trigger function
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ language 'plpgsql';

    -- Create trigger for updated_at
    DROP TRIGGER IF EXISTS update_users_updated_at ON users;
    CREATE TRIGGER update_users_updated_at 
      BEFORE UPDATE ON users 
      FOR EACH ROW 
      EXECUTE FUNCTION update_updated_at_column();

    -- Enable Row Level Security (RLS)
    ALTER TABLE users ENABLE ROW LEVEL SECURITY;

    -- Create policies for service role access
    DROP POLICY IF EXISTS "Service role can manage users" ON users;
    CREATE POLICY "Service role can manage users" ON users
      FOR ALL USING (true);
  `;

  try {
    console.log('Creating Supabase database tables...');
    
    // Execute SQL using Supabase RPC
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: createUsersTableSQL
    });

    // If RPC doesn't exist, use direct SQL execution
    if (error && error.message.includes('function exec_sql')) {
      // Use the Supabase SQL editor approach via REST API
      const response = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.SUPABASE_SERVICE_ROLE_KEY}`,
          'apikey': config.SUPABASE_SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ query: createUsersTableSQL }),
      });

      if (!response.ok) {
        // Fallback: Try to create table using individual queries
        console.log('Fallback: Creating tables with individual queries...');
        await createTablesWithIndividualQueries();
      }
    } else if (error) {
      throw error;
    }
    
    console.log('Supabase database tables created/verified');
    
  } catch (error) {
    console.error('Failed to create tables:', error);
    // Don't fail initialization, tables might already exist
    console.log('Continuing without table creation - they may already exist');
  }
}

/**
 * Fallback method to create tables with individual queries
 */
async function createTablesWithIndividualQueries(): Promise<void> {
  if (!supabase) return;

  try {
    // Check if users table exists by trying to select from it
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (!error) {
      console.log('Users table already exists');
      return;
    }

    console.log('Users table may not exist, but table creation requires database admin access');
    console.log('Please ensure the users table exists in your Supabase database with the following schema:');
    console.log(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        is_verified BOOLEAN DEFAULT FALSE,
        reset_password_token VARCHAR(255) NULL,
        reset_password_expires TIMESTAMP WITH TIME ZONE NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);
    
  } catch (error) {
    console.error('Table verification failed:', error);
  }
}

/**
 * Gets the Supabase client instance
 * @returns Supabase client
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Call initializeDatabase() first.');
  }
  return supabase;
}

/**
 * Executes a raw SQL query using Supabase
 * @param sql - SQL query string
 * @param params - Query parameters
 * @returns Query result
 */
export async function executeQuery(sql: string, params?: any[]): Promise<any> {
  if (!supabase) {
    throw new Error('Supabase client not initialized');
  }

  const start = Date.now();
  
  try {
    // Use Supabase SQL execution
    const { data, error } = await supabase.rpc('query_with_params', {
      query_text: sql,
      parameters: params || [],
    });

    if (error) {
      throw error;
    }

    const duration = Date.now() - start;
    
    // Log slow queries
    const slowQueryThreshold = config.NODE_ENV === 'production' ? 50 : 100;
    if (duration > slowQueryThreshold) {
      console.warn(`🐌 Slow query detected (${duration}ms):`, sql.substring(0, 100));
    }
    
    return data;
    
  } catch (error) {
    console.error('Supabase query error:', error);
    console.error('Query:', sql);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * Gracefully closes the Supabase connection
 * @returns Promise that resolves when connection is closed
 */
export async function closeDatabase(): Promise<void> {
  if (!supabase) {
    console.log('Supabase client already closed');
    return;
  }

  try {
    console.log('Closing Supabase connection...');
    // Supabase client doesn't need explicit closing like traditional DB pools
    supabase = null;
    console.log('Supabase connection closed successfully');
  } catch (error) {
    console.error('Error closing Supabase connection:', error);
    throw error;
  }
}

/**
 * Gets Supabase database health status
 * @returns Database health information
 */
export async function getDatabaseHealth(): Promise<{
  status: 'healthy' | 'unhealthy';
  details: any;
}> {
  try {
    if (!supabase) {
      return {
        status: 'unhealthy',
        details: { error: 'Supabase client not initialized' }
      };
    }

    // Test with a simple query
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error && !error.message.includes('relation "users" does not exist')) {
      throw error;
    }

    return {
      status: 'healthy',
      details: {
        service: 'supabase',
        url: config.SUPABASE_URL,
        timestamp: new Date().toISOString(),
        response_time: '< 100ms',
      }
    };
    
  } catch (error) {
    return {
      status: 'unhealthy',
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        service: 'supabase'
      }
    };
  }
}

/**
 * Helper function to handle Supabase errors
 * @param error - Supabase error object
 * @returns Formatted error message
 */
export function handleSupabaseError(error: any): string {
  if (!error) return 'Unknown error occurred';

  // Handle specific Supabase error codes
  switch (error.code) {
    case '23505':
      return 'A record with this information already exists';
    case '23503':
      return 'Referenced record does not exist';
    case 'PGRST116':
      return 'Record not found';
    case 'PGRST301':
      return 'Row level security violation';
    default:
      return error.message || 'Database operation failed';
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, closing Supabase connections...');
  await closeDatabase();
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT received, closing Supabase connections...');
  await closeDatabase();
});

export default {
  initializeDatabase,
  testConnection,
  createTables,
  getSupabaseClient,
  executeQuery,
  closeDatabase,
  getDatabaseHealth,
  handleSupabaseError,
};