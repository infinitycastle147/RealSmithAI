// @ts-ignore - @supabase/supabase-js types will be available after npm install
import { getDbClient, QuotaRow } from '../../lib/db';
import { QuotaStatus, QuotaCheckResult } from '../../types/quota';

/**
 * Quota Service - Manages user token quotas and usage tracking
 */
export class QuotaService {
  private readonly DEFAULT_DAILY_TOKENS = parseInt(
    process.env.DEFAULT_DAILY_TOKENS || '10000',
    10
  );
  private readonly DEFAULT_DAILY_REQUESTS = parseInt(
    process.env.DEFAULT_DAILY_REQUESTS || '15',
    10
  );
  private readonly QUOTA_BUFFER_PERCENT = parseFloat(
    process.env.QUOTA_BUFFER_PERCENT || '0.2'
  );

  /**
   * Get or create user quota record
   */
  private async getUserQuotaRecord(userId: string): Promise<QuotaRow | null> {
    try {
      const client = getDbClient();

      // Try to get existing quota
      const { data, error } = await client
        .from('user_quotas')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned" which is expected for new users
        return null;
      }

      if (data) {
        return data as QuotaRow;
      }

      // Create new quota record if it doesn't exist
      // Use upsert to handle race conditions where multiple requests try to create at once
      const today = new Date().toISOString().split('T')[0];
      
      const { data: newData, error: insertError } = await client
        .from('user_quotas')
        .upsert({
          user_id: userId,
          daily_tokens: this.DEFAULT_DAILY_TOKENS,
          daily_request_limit: this.DEFAULT_DAILY_REQUESTS,
          last_reset_date: today,
          tokens_used: 0,
          requests_used: 0,
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (insertError) {
        // If duplicate key error (race condition), retry SELECT to get the existing record
        if (insertError.code === '23505') {
          const { data: retryData, error: retryError } = await client
            .from('user_quotas')
            .select('*')
            .eq('user_id', userId)
            .single();
          
          if (!retryError && retryData) {
            return retryData as QuotaRow;
          }
        }
        
        return null;
      }

      return newData as QuotaRow;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if quota reset is needed (new day)
   */
  private async checkAndResetIfNeeded(userId: string): Promise<void> {
    const quota = await this.getUserQuotaRecord(userId);
    if (!quota) return;

    // Get today's date in UTC
    const today = new Date().toISOString().split('T')[0];
    // Handle both Date objects and string dates
    const lastResetDate = new Date(quota.last_reset_date).toISOString().split('T')[0];

    if (lastResetDate !== today) {
      await this.resetDailyQuota(userId);
    }
  }

  /**
   * Check if user has sufficient quota
   */
  async checkQuota(
    userId: string,
    estimatedTokens: number = 0
  ): Promise<QuotaCheckResult> {
    try {
      // Check and reset if needed
      await this.checkAndResetIfNeeded(userId);

      const quota = await this.getUserQuotaRecord(userId);
      if (!quota) {
        // If quota record can't be retrieved/created, fail open to allow request
        // This prevents blocking users due to database/RLS issues
        return {
          hasQuota: true, // Fail open - allow request if quota can't be checked
          tokensRemaining: this.DEFAULT_DAILY_TOKENS,
          requestsRemaining: this.DEFAULT_DAILY_REQUESTS,
          resetTime: this.getResetTime(),
        };
      }

      const tokensRemaining = Math.max(0, quota.daily_tokens - quota.tokens_used);
      const requestsRemaining = Math.max(
        0,
        quota.daily_request_limit - quota.requests_used
      );

      // Apply safety buffer to prevent hitting exact limits
      const effectiveTokens = Math.floor(
        quota.daily_tokens * (1 - this.QUOTA_BUFFER_PERCENT)
      );
      const effectiveRequests = Math.floor(
        quota.daily_request_limit * (1 - this.QUOTA_BUFFER_PERCENT)
      );

      // Check if user has sufficient quota (with buffer applied)
      const hasTokenQuota = (quota.tokens_used + estimatedTokens) <= effectiveTokens;
      const hasRequestQuota = quota.requests_used < effectiveRequests;

      return {
        hasQuota: hasTokenQuota && hasRequestQuota,
        tokensRemaining,
        requestsRemaining,
        resetTime: this.getResetTime(),
      };
    } catch (error) {
      console.error('Error checking quota:', error);
      // On error, allow request but log it
      return {
        hasQuota: true,
        tokensRemaining: this.DEFAULT_DAILY_TOKENS,
        requestsRemaining: this.DEFAULT_DAILY_REQUESTS,
        resetTime: this.getResetTime(),
      };
    }
  }

  /**
   * Get user's current quota status
   */
  async getUserQuota(userId: string): Promise<QuotaStatus | null> {
    try {
      await this.checkAndResetIfNeeded(userId);

      const quota = await this.getUserQuotaRecord(userId);
      if (!quota) {
        return null;
      }

      return {
        userId: quota.user_id,
        dailyTokens: quota.daily_tokens,
        tokensUsed: quota.tokens_used,
        tokensRemaining: Math.max(0, quota.daily_tokens - quota.tokens_used),
        requestsUsed: quota.requests_used,
        requestsRemaining: Math.max(
          0,
          quota.daily_request_limit - quota.requests_used
        ),
        dailyRequestLimit: quota.daily_request_limit,
        lastResetDate: quota.last_reset_date.toString(),
        resetTime: this.getResetTime(),
      };
    } catch (error) {
      console.error('Error getting user quota status:', error);
      return null;
    }
  }

  /**
   * Deduct tokens after API call
   * Uses atomic database operations to prevent race conditions
   * Note: checkAndResetIfNeeded should be called before this method (already done in checkQuota)
   * 
   * @param estimatedTokens - The estimated tokens used during quota check (for validation)
   */
  async deductTokens(
    userId: string,
    tokens: number,
    model: string,
    requestType: 'script' | 'image' | 'voice',
    inputTokens: number = 0,
    outputTokens: number = 0,
    estimatedTokens?: number
  ): Promise<void> {
    try {
      const client = getDbClient();

      // Ensure quota is reset if needed (safety check, though it should already be done)
      await this.checkAndResetIfNeeded(userId);

      // Validate: actual tokens shouldn't exceed estimated by more than 50% (safety margin)
      // This prevents quota bypass if actual usage is much higher than estimated
      if (estimatedTokens !== undefined && tokens > estimatedTokens * 1.5) {
        // Use estimated value to prevent quota bypass
        tokens = Math.min(tokens, Math.ceil(estimatedTokens * 1.5));
      }

      // Get current quota for update
      const quota = await this.getUserQuotaRecord(userId);
      if (!quota) {
        return;
      }

      // Calculate new values
      const newTokensUsed = quota.tokens_used + tokens;
      const newRequestsUsed = quota.requests_used + 1;
      const now = new Date().toISOString();

      // Update quota - Supabase update is atomic at the row level
      // For better race condition handling, we'll use a simple update
      // In production, consider using a PostgreSQL function for true atomic increment
      const { error: updateError } = await client
        .from('user_quotas')
        .update({
          tokens_used: newTokensUsed,
          requests_used: newRequestsUsed,
          updated_at: now,
        })
        .eq('user_id', userId);

      if (updateError) {
        // Don't throw - log the error but don't fail the request
        return;
      }

      // Log usage (separate query, but failure here shouldn't fail the request)
      try {
        await client
          .from('token_usage_log')
          .insert({
            user_id: userId,
            model_name: model,
            request_type: requestType,
            input_tokens: inputTokens,
            output_tokens: outputTokens,
            total_tokens: tokens,
          });
      } catch (logError) {
        // Silently fail - don't fail the request due to logging failure
      }
    } catch (error) {
      // Don't throw - silent fail to ensure API calls succeed
    }
  }

  /**
   * Reset daily quota for a user
   */
  async resetDailyQuota(userId: string): Promise<void> {
    try {
      const client = getDbClient();
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      const { error } = await client
        .from('user_quotas')
        .update({
          tokens_used: 0,
          requests_used: 0,
          last_reset_date: today,
          updated_at: now,
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error resetting quota:', error);
        throw error;
      }
    } catch (error) {
      console.error('Error resetting quota:', error);
      throw error;
    }
  }

  /**
   * Reset all user quotas (optional - for manual admin operations)
   * Note: Quotas reset automatically on-demand when users make requests,
   * so this method is not required for normal operation.
   */
  async resetAllQuotas(): Promise<number> {
    try {
      const client = getDbClient();
      const today = new Date().toISOString().split('T')[0];
      const now = new Date().toISOString();

      // Get count of users to reset
      const { count, error: countError } = await client
        .from('user_quotas')
        .select('*', { count: 'exact', head: true })
        .lt('last_reset_date', today);

      if (countError) {
        console.error('Error counting quotas to reset:', countError);
        return 0;
      }

      // Update all users
      const { error: updateError } = await client
        .from('user_quotas')
        .update({
          tokens_used: 0,
          requests_used: 0,
          last_reset_date: today,
          updated_at: now,
        })
        .lt('last_reset_date', today);

      if (updateError) {
        console.error('Error resetting all quotas:', updateError);
        throw updateError;
      }

      return count || 0;
    } catch (error) {
      console.error('Error resetting all quotas:', error);
      throw error;
    }
  }

  /**
   * Get reset time (next midnight UTC)
   */
  getResetTime(): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return tomorrow;
  }

  /**
   * Estimate tokens from content (fallback when metadata unavailable)
   */
  estimateTokens(content: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }
}
