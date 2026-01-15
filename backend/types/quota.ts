/**
 * Quota Service Types
 */

export interface QuotaStatus {
  userId: string;
  dailyTokens: number;
  tokensUsed: number;
  tokensRemaining: number;
  requestsUsed: number;
  requestsRemaining: number;
  dailyRequestLimit: number;
  lastResetDate: string;
  resetTime: Date;
}

export interface QuotaCheckResult {
  hasQuota: boolean;
  tokensRemaining: number;
  requestsRemaining: number;
  resetTime: Date | null;
}
