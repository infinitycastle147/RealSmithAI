import { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_middleware';
import { QuotaService } from '../services/quota';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  // Verify authentication
  const userId = await requireAuth(req, res);
  if (!userId) {
    return; // Response already sent by requireAuth
  }

  try {
    const quotaService = new QuotaService();
    const quotaStatus = await quotaService.getUserQuota(userId);

    if (!quotaStatus) {
      return res.status(500).json({ error: 'Failed to retrieve quota status', code: 'QUOTA_ERROR' });
    }

    return res.status(200).json({
      data: quotaStatus
    });
  } catch (error: any) {
    console.error('Error getting quota status:', error);
    return res.status(500).json({
      error: error.message || 'Failed to retrieve quota status',
      code: 'QUOTA_ERROR'
    });
  }
}
