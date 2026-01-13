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

The frontend has been updated to automatically use the backend URL. Here's how it works:

### Development (already configured)
- The `vite.config.ts` proxies `/api/*` to `http://localhost:3001`
- No environment variable needed - uses relative paths that go through the proxy

### Production
Set the `VITE_API_URL` environment variable in your frontend deployment:

```bash
VITE_API_URL=https://your-backend-url.com
```

**Important:** 
- The URL should **NOT** include `/api` at the end
- Example: `https://api.reelsmith.com` ✅ (correct)
- Example: `https://api.reelsmith.com/api` ❌ (wrong - will result in `/api/api/...`)

The frontend code automatically appends `/api/` to the base URL, so:
- `VITE_API_URL=https://api.reelsmith.com` → calls `https://api.reelsmith.com/api/gemini/script`
- If `VITE_API_URL` is not set → uses relative paths (works if frontend/backend on same domain)

### Frontend Environment Variables

For your frontend deployment, set:
```
VITE_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=https://your-backend-url.com  # Optional - only needed if backend is on different domain
```

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
