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

    // Verify service role key format (should start with sb_secret_)
    if (!supabaseServiceRoleKey.startsWith('sb_secret_')) {
      console.warn('⚠️ WARNING: SUPABASE_SERVICE_ROLE_KEY does not start with "sb_secret_"');
      console.warn('   Make sure you are using the Service Role Key, not the Publishable Key');
      console.warn('   Get it from: Supabase Dashboard → Settings → API → Service Role Key');
    }

    // Use service role key to bypass RLS (we handle auth via Clerk)
    // Service role key automatically bypasses RLS when used correctly
    // Important: The service role key (sb_secret_...) bypasses RLS automatically
    // When using service role key, Supabase automatically bypasses all RLS policies
    dbClient = createClient(supabaseUrl, supabaseServiceRoleKey);
    
    // Verify the client configuration
    console.log('✅ Supabase client initialized with service role key');
    console.log(`   URL: ${supabaseUrl}`);
    console.log(`   Service Role Key format: ${supabaseServiceRoleKey.substring(0, 20)}...`);
    
    // Verify service role key format
    if (!supabaseServiceRoleKey.startsWith('sb_secret_')) {
      console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY does not start with "sb_secret_"');
      console.error('   You may be using the Publishable Key instead of the Service Role Key');
      console.error('   Get the Service Role Key from: Supabase Dashboard → Settings → API → Service Role Key');
      throw new Error('Invalid SUPABASE_SERVICE_ROLE_KEY format - must start with "sb_secret_"');
    }
  }
  return dbClient;
}

export interface QuotaRow {
  user_id: string;
  daily_tokens: number;
  tokens_used: number;
  requests_used: number;
  daily_request_limit: number;
  last_reset_date: string;
  created_at: string;
  updated_at: string;
}

export interface UsageLogRow {
  id: number;
  user_id: string;
  model_name: string;
  request_type: string;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  created_at: string;
}

// Export Supabase client for direct use
export { getDbClient };


