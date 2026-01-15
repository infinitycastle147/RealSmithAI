/**
 * Database connection utility for Supabase PostgreSQL
 * 
 * Using Supabase PostgreSQL for Vercel serverless compatibility.
 * Supabase provides a free tier perfect for small applications.
 * 
 * Setup:
 * 1. Get Supabase project URL and service role key
 * 2. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 * 
 * Note: We use service role key in serverless functions to bypass RLS,
 * since we handle authentication via Clerk middleware.
 */

// @ts-ignore - @supabase/supabase-js will be available after npm install
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { QuotaRow, UsageLogRow } from '../types/database';

// Create database client (singleton pattern for serverless)
let dbClient: SupabaseClient | null = null;

function getDbClient() {
  if (!dbClient) {
    // @ts-ignore - process.env is available in Node.js/Vercel runtime
    const supabaseUrl = process.env.SUPABASE_URL;
    // @ts-ignore - process.env is available in Node.js/Vercel runtime
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL environment variable is not set');
    }

    if (!supabaseServiceRoleKey) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
    }
    
    dbClient = createClient(supabaseUrl, supabaseServiceRoleKey);
  }
  return dbClient;
}

// Export Supabase client for direct use
export { getDbClient };
export type { QuotaRow, UsageLogRow };


