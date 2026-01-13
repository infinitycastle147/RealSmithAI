import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { clerkMiddleware, getAuth } from '@clerk/express';
import { QuotaService } from './api/services/quota';
import scriptRoute from './api/routes/gemini/script';
import imageRoute from './api/routes/gemini/image';
import voiceRoute from './api/routes/gemini/voice';
import quotaStatusRoute from './api/routes/quota/status';
import { setupCronJobs } from './api/cron/scheduler';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Clerk middleware FIRST - must be applied before any other middleware
// This attaches the auth object to the request so getAuth() can work
// Clerk automatically reads CLERK_SECRET_KEY from process.env
if (!process.env.CLERK_SECRET_KEY) {
  console.error('❌ ERROR: CLERK_SECRET_KEY is not set in environment variables');
  console.error('   Authentication will not work. Please set CLERK_SECRET_KEY in your environment.');
  console.error('   Get your key from: https://dashboard.clerk.com → Your App → API Keys → Secret Key');
  process.exit(1); // Exit if secret key is not set
}

// Apply Clerk middleware - this must be done before any routes use getAuth()
app.use(clerkMiddleware());
console.log('✅ Clerk middleware initialized');

// Other middleware
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
    // Check if CLERK_SECRET_KEY is set
    if (!process.env.CLERK_SECRET_KEY) {
      console.error('CLERK_SECRET_KEY is not set in environment variables');
      res.status(500).json({ 
        error: 'Server configuration error: CLERK_SECRET_KEY not set', 
        code: 'SERVER_ERROR' 
      });
      return;
    }

    const { userId } = getAuth(req);
    
    if (!userId) {
      console.warn('Authentication failed: No userId found in request');
      // Log request headers for debugging (don't log full token for security)
      const authHeader = req.headers.authorization;
      console.warn('Authorization header present:', !!authHeader);
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return;
    }
    
    req.userId = userId;
    next();
  } catch (error: any) {
    console.error('Auth error:', error.message || error);
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
