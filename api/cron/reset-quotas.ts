import { VercelRequest, VercelResponse } from '@vercel/node';
import { QuotaService } from '../services/quota';

/**
 * Cron job endpoint to reset daily quotas
 * Scheduled to run daily at midnight UTC via Vercel cron
 * 
 * Security: Verify cron secret if CRON_SECRET is set
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
  }

  // Only allow GET requests (Vercel cron sends GET)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  try {
    const quotaService = new QuotaService();
    const resetCount = await quotaService.resetAllQuotas();

    console.log(`Quota reset completed. Reset ${resetCount} user(s).`);

    return res.status(200).json({
      success: true,
      message: `Reset quotas for ${resetCount} user(s)`,
      resetCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error resetting quotas:', error);
    return res.status(500).json({
      error: error.message || 'Failed to reset quotas',
      code: 'RESET_ERROR'
    });
  }
}
