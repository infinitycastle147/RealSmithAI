/**
 * Express Request Type Extensions
 */

import { Request } from 'express';
import { QuotaService } from '../api/services/quota';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      quotaService?: QuotaService;
    }
  }
}
