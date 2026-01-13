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
// Clerk requires both CLERK_SECRET_KEY and CLERK_PUBLISHABLE_KEY
if (!process.env.CLERK_SECRET_KEY) {
  console.error('❌ ERROR: CLERK_SECRET_KEY is not set in environment variables');
  console.error('   Authentication will not work. Please set CLERK_SECRET_KEY in your environment.');
  console.error('   Get your key from: https://dashboard.clerk.com → Your App → API Keys → Secret Key');
  process.exit(1); // Exit if secret key is not set
}

if (!process.env.CLERK_PUBLISHABLE_KEY) {
  console.error('❌ ERROR: CLERK_PUBLISHABLE_KEY is not set in environment variables');
  console.error('   Authentication will not work. Please set CLERK_PUBLISHABLE_KEY in your environment.');
  console.error('   Get your key from: https://dashboard.clerk.com → Your App → API Keys → Publishable Key');
  process.exit(1); // Exit if publishable key is not set
}

// CORS configuration - must be before other middleware
// Allow all origins in development, restrict in production
const corsOptions = {
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // In development, allow all origins for easier testing
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🌐 CORS: Allowing origin: ${origin}`);
      return callback(null, true);
    }
    
    // In production, use allowed origins from environment or default list
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
      'https://reelzeroai.vercel.app', // Production frontend
    ];
    
    // Add production frontend URL from environment (if different)
    if (process.env.FRONTEND_URL) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }
    
    if (allowedOrigins.includes(origin)) {
      console.log(`✅ CORS: Allowed origin: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`⚠️ CORS: Blocked origin: ${origin}`);
      callback(new Error(`Not allowed by CORS. Origin: ${origin}`));
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['X-Quota-Tokens-Remaining', 'X-Quota-Requests-Remaining', 'X-Quota-Reset-Time'],
  maxAge: 86400, // Cache preflight requests for 24 hours
};

app.use(cors(corsOptions));

// Apply Clerk middleware - this must be done before any routes use getAuth()
// Explicitly pass both keys to clerkMiddleware
app.use(clerkMiddleware({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,
}));
console.log('✅ Clerk middleware initialized');

// Other middleware
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
  // Handle CORS errors
  if (err.message && err.message.includes('CORS')) {
    console.error('CORS error:', err.message);
    return res.status(403).json({ 
      error: 'CORS policy violation: ' + err.message, 
      code: 'CORS_ERROR' 
    });
  }
  
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
