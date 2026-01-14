import { Router, Request, Response } from 'express';
import { QuotaService } from '../../services/quota';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
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
});

export default router;
