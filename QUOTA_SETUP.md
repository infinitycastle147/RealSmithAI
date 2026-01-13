# Token Quota System Setup Guide (Supabase PostgreSQL)

## Overview

The token quota system uses Supabase PostgreSQL for Vercel serverless compatibility. Supabase provides a free tier perfect for small applications with few users.

## Database Setup

### Supabase Configuration

**Tables Created:**
- ✅ `user_quotas` - Per-user quota tracking
- ✅ `token_usage_log` - Usage analytics and debugging
- ✅ Row Level Security (RLS) enabled with policies

**Setup Steps:**

1. **Get Service Role Key:**
   - Go to your Supabase Dashboard → Settings → API
   - Copy the **Service Role Key** (secret key, starts with `sb_secret_...`)
   - ⚠️ **Important**: Use Service Role Key, NOT Publishable Key for serverless functions
   - The Service Role Key bypasses RLS (we handle auth via Clerk)

2. **Set Environment Variables in Vercel:**
   - `SUPABASE_URL` - Your Supabase project URL (e.g., `https://bzyhmnxpzowiauoqllhw.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Service Role Key (secret key)

3. **Verify Tables:**
   - Tables are already created via Supabase MCP migration
   - You can verify in Supabase Dashboard → Table Editor
   - Or call `POST /api/init-db` to verify tables exist

## Installation

```bash
npm install
```

This will install `@supabase/supabase-js` and other dependencies.

## Environment Variables

### Required (Vercel Dashboard)

- `SUPABASE_URL` - Supabase project URL (e.g., `https://bzyhmnxpzowiauoqllhw.supabase.co`)
- `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key (secret key from Supabase dashboard)
- `CLERK_SECRET_KEY` - Already configured
- `GEMINI_API_KEY` - Already configured

### Optional Configuration

- `DEFAULT_DAILY_TOKENS` - Default token quota per user (default: 10000)
- `DEFAULT_DAILY_REQUESTS` - Default request limit per user (default: 15)
- `QUOTA_BUFFER_PERCENT` - Safety buffer percentage (default: 0.2 = 20%)
- `CRON_SECRET` - Secret for securing cron endpoint (optional but recommended)
- `DB_INIT_SECRET` - Secret for database initialization endpoint (optional)

## Quota Calculation

**Free Tier (100 daily active users):**
- Total daily requests: 1,500
- Per-user requests: 15 requests/user/day
- Total daily tokens: ~1,000,000
- Per-user tokens: 10,000 tokens/user/day
- **With 20% buffer:** 8,000 tokens, 12 requests per user

## Features Implemented

✅ Per-user quota tracking
✅ Token usage extraction from Gemini responses
✅ Daily quota reset (cron job + lazy reset)
✅ Quota enforcement before API calls
✅ Real-time quota display in UI
✅ 429 error handling when quota exceeded
✅ Quota status API endpoint
✅ Usage logging for analytics
✅ Supabase PostgreSQL database
✅ Row Level Security (RLS) enabled

## API Endpoints

### Quota Status
- `GET /api/quota/status` - Get current user's quota status

### Cron Job
- `GET /api/cron/reset-quotas` - Daily reset (called by Vercel cron)

### Database Init
- `POST /api/init-db` - Verify database tables exist (one-time setup)

## Supabase Setup Instructions

1. **Get Service Role Key:**
   - Go to Supabase Dashboard → Settings → API
   - Find "Service Role" key (secret key)
   - Copy the key (starts with `sb_secret_...`)
   - ⚠️ **Never expose this key publicly** - only use in serverless functions

2. **Set Environment Variables in Vercel:**
   - `SUPABASE_URL`: `https://bzyhmnxpzowiauoqllhw.supabase.co`
   - `SUPABASE_SERVICE_ROLE_KEY`: Your service role key

3. **Verify Tables:**
   - Tables are already created via MCP migration
   - Check Supabase Dashboard → Table Editor
   - You should see `user_quotas` and `token_usage_log` tables

4. **RLS Policies:**
   - RLS is enabled on both tables
   - Policies allow users to access their own data
   - Service Role Key bypasses RLS (used in serverless functions)

## Testing

1. **Test Quota Check:**
   - Make API calls and verify quota is checked
   - Check quota status endpoint returns correct values

2. **Test Quota Exceeded:**
   - Exhaust quota by making many requests
   - Verify 429 error is returned
   - Verify UI shows quota exceeded message

3. **Test Reset:**
   - Wait for daily reset or manually trigger
   - Verify quotas reset to 0

4. **Test Concurrent Requests:**
   - Make multiple simultaneous requests
   - Verify no race conditions in quota updates

## Monitoring

- Check `token_usage_log` table in Supabase Dashboard for usage patterns
- Monitor quota exceeded events
- Track database performance in Supabase Dashboard
- Use Supabase Analytics for insights

## Troubleshooting

### "Cannot find module '@supabase/supabase-js'"
- Run `npm install` to install dependencies

### Database connection errors
- Verify `SUPABASE_URL` is set correctly (include `https://`)
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not publishable key)
- Check Supabase Dashboard for project status

### Quota not resetting
- Check cron job is configured in `vercel.json`
- Verify cron job is running (check Vercel logs)
- Lazy reset should work as fallback

### Quota not being deducted
- Check API responses include `usageMetadata`
- Verify quota service is being called
- Check database connection in Supabase Dashboard

### RLS Policy Errors
- Service Role Key should bypass RLS automatically
- If you see RLS errors, verify you're using Service Role Key (not Publishable Key)
- Check RLS policies in Supabase Dashboard → Authentication → Policies

## Supabase Free Tier Limits

- **500MB** database storage
- **2GB** bandwidth
- **50,000** monthly active users
- **500MB** file storage
- Perfect for small applications with few users

## Local Development

For local development, you can use Supabase local instance or connect to your cloud project:

```bash
# Set environment variables
export SUPABASE_URL=https://bzyhmnxpzowiauoqllhw.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Run your dev server
npm run dev

# Initialize database (call POST /api/init-db or tables already exist)
```

## Security Notes

- ✅ Service Role Key is only used in serverless functions (never exposed to client)
- ✅ RLS policies protect data at database level
- ✅ Clerk authentication handles user authentication
- ✅ Service Role Key bypasses RLS (by design, for server-side operations)

## Next Steps

1. Install dependencies: `npm install`
2. Get Service Role Key from Supabase Dashboard
3. Set environment variables in Vercel
4. Verify tables exist (already created via MCP)
5. Deploy to Vercel
6. Test quota system
7. Monitor usage patterns
