/**
 * Database Schema Types
 */

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
