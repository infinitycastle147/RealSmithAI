import { Request, Response, NextFunction } from 'express';
import { QuotaService } from '../services/quota';

/**
 * Middleware to enforce quota before processing API requests
 * Returns true if quota check passes, false otherwise (and sends 429 response)
 */
export async function enforceQuota(
  req: Request,
  res: Response,
  estimatedTokens: number = 0
): Promise<boolean> {
  try {
    const userId = req.userId; // Set by requireAuth middleware
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return false;
    }

    const quotaService = new QuotaService();
    const checkResult = await quotaService.checkQuota(userId, estimatedTokens);

    if (!checkResult.hasQuota) {
      res.status(429).json({
        error: 'Quota exceeded',
        code: 'QUOTA_EXCEEDED',
        resetTime: checkResult.resetTime?.toISOString() || null,
        tokensRemaining: checkResult.tokensRemaining,
        requestsRemaining: checkResult.requestsRemaining,
        dailyTokens: parseInt(process.env.DEFAULT_DAILY_TOKENS || '10000', 10),
        dailyRequests: parseInt(process.env.DEFAULT_DAILY_REQUESTS || '15', 10),
      });
      return false;
    }

    // Attach quota service to request for post-processing
    req.quotaService = quotaService;
    req.userId = userId;

    return true;
  } catch (error: any) {
    console.error('Quota check error:', error);
    // On error, allow request but log it
    return true;
  }
}
