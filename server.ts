import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { getAuth } from '@clerk/express';
import { QuotaService } from './api/services/quota';
import scriptRoute from './api/routes/gemini/script';
import imageRoute from './api/routes/gemini/image';
import voiceRoute from './api/routes/gemini/voice';
import quotaStatusRoute from './api/routes/quota/status';
import { setupCronJobs } from './api/cron/scheduler';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Extend Express Request type to include userId
declare global {
  namespace Express {
    interface Request {
      userId?: string;
      quotaService?: QuotaService;
    }
  }
}

/**
 * Authentication middleware
 * Verifies Clerk JWT token and attaches userId to request
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId } = getAuth(req);
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }
    
    req.userId = userId;
    next();
  } catch (error: any) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }
}

// API Routes
app.use('/api/gemini/script', requireAuth, scriptRoute);
app.use('/api/gemini/image', requireAuth, imageRoute);
app.use('/api/gemini/voice', requireAuth, voiceRoute);
app.use('/api/quota/status', requireAuth, quotaStatusRoute);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: err.message || 'Internal server error', 
    code: 'INTERNAL_ERROR' 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Express server running on port ${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
  
  // Setup cron jobs
  setupCronJobs();
  console.log('⏰ Cron jobs initialized');
});
