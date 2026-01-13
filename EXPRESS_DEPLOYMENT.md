# Express Backend Deployment Guide

## Deployment Configuration

For most deployment platforms, use these settings:

### Root Directory / Base Path
**Set to:** `.` (root of the project) or leave empty/default

The Express server entry point is `server.ts` at the root of the project.

### Build Command
**Set to:** `npm install` (or leave empty if platform auto-installs)

No build step needed since we're using `tsx` to run TypeScript directly.

### Start Command
**Set to:** `npm start`

This runs `tsx server.ts` which starts the Express server.

### Port Configuration
The server automatically uses `process.env.PORT` (most platforms set this automatically).
Default fallback is port `3001` if `PORT` is not set.

### Health Check Endpoint
Use: `/health` (returns `{ status: 'ok', timestamp: '...' }`)

---

## Platform-Specific Instructions

### Railway
- **Root Directory:** `.` (default)
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Port:** Auto-detected from `PORT` env var
- **Health Check Path:** `/health`

### Render
- **Root Directory:** `.` (default)
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Environment:** Node
- **Health Check Path:** `/health`

### Fly.io
- **Root Directory:** `.` (default)
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Port:** Auto-detected from `PORT` env var

### Heroku
- **Root Directory:** `.` (default)
- **Build Command:** `npm install` (auto-detected)
- **Start Command:** `npm start` (auto-detected from package.json)
- **Port:** Auto-detected from `PORT` env var

### DigitalOcean App Platform
- **Root Directory:** `.` (default)
- **Build Command:** `npm install`
- **Run Command:** `npm start`
- **HTTP Port:** `3001` (or use `PORT` env var)

### AWS Elastic Beanstalk / EC2
- **Root Directory:** `.` (default)
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Port:** Set via `PORT` environment variable

### Google Cloud Run
- **Root Directory:** `.` (default)
- **Build Command:** `npm install`
- **Start Command:** `npm start`
- **Port:** Cloud Run sets `PORT` automatically

---

## Environment Variables

Make sure to set these in your deployment platform:

```
PORT=3001 (optional - most platforms set this automatically)
CLERK_SECRET_KEY=your_clerk_secret_key
GEMINI_API_KEY=your_gemini_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DEFAULT_DAILY_TOKENS=10000 (optional)
DEFAULT_DAILY_REQUESTS=15 (optional)
CRON_SECRET=your_cron_secret (optional, for manual cron triggers)
```

---

## Frontend Configuration

After deploying your backend, update your frontend to point to the backend URL:

### Development (already configured)
The `vite.config.ts` proxies `/api/*` to `http://localhost:3001`

### Production
You'll need to either:

1. **Update API calls** to use your backend URL:
   ```typescript
   const API_BASE_URL = import.meta.env.VITE_API_URL || '';
   const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, ...);
   ```

2. **Or use a reverse proxy** (if frontend and backend are on same domain)

---

## Testing Deployment

1. Check health endpoint: `https://your-backend-url.com/health`
2. Test API endpoint: `https://your-backend-url.com/api/quota/status` (requires auth)
3. Verify cron jobs are running (check logs for daily quota reset)

---

## Important Notes

- The Express server serves **only the API routes** (`/api/*`)
- Your frontend should be deployed separately (Vite build outputs to `dist/`)
- For a monorepo setup, you might want to deploy frontend and backend together, but they're currently separate
- The cron job runs automatically in the Express process (no separate cron service needed)
