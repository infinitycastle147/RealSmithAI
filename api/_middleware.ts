import { getAuth } from '@clerk/express';
import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Middleware helper to require authentication for API routes
 * Returns userId if authenticated, null otherwise (and sends 401 response)
 * 
 * Note: Clerk Express automatically reads CLERK_SECRET_KEY from environment
 * and validates the Authorization header token
 */
export async function requireAuth(req: VercelRequest, res: VercelResponse): Promise<string | null> {
  try {
    // getAuth automatically validates the token from Authorization header
    // and reads CLERK_SECRET_KEY from process.env
    const { userId } = getAuth(req);
    
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      return null;
    }
    
    return userId;
  } catch (error: any) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    return null;
  }
}
