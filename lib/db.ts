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
    dbClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'apikey': supabaseServiceRoleKey,
          'Authorization': `Bearer ${supabaseServiceRoleKey}`
        }
      }
    });
    
    console.log('✅ Supabase client initialized with service role key');
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


