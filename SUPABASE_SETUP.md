# Supabase Setup Summary

## ✅ What's Already Done

1. **Tables Created** via Supabase MCP:
   - `user_quotas` - Per-user quota tracking
   - `token_usage_log` - Usage analytics
   - Row Level Security (RLS) enabled
   - RLS policies configured

2. **Code Updated**:
   - Database client uses Supabase PostgreSQL
   - Quota service uses Supabase query builder
   - All SQL queries converted to Supabase methods

## 🔧 What You Need to Do

### 1. Get Service Role Key

**Important**: You provided the Publishable Key, but we need the **Service Role Key** for serverless functions.

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Find **Service Role** key (under "Project API keys")
5. Copy the key (it starts with `sb_secret_...`)
6. ⚠️ **Never expose this key publicly** - only use in serverless functions

### 2. Set Environment Variables in Vercel

Add these to your Vercel project settings:

```
SUPABASE_URL=https://bzyhmnxpzowiauoqllhw.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 3. Install Dependencies

```bash
npm install
```

This will install `@supabase/supabase-js`.

### 4. Verify Setup

After deployment, verify tables exist:
- Check Supabase Dashboard → Table Editor
- Or call `POST /api/init-db` endpoint

## 📋 Environment Variables Checklist

- ✅ `SUPABASE_URL` - Your project URL
- ✅ `SUPABASE_SERVICE_ROLE_KEY` - Service Role Key (secret)
- ✅ `CLERK_SECRET_KEY` - Already configured
- ✅ `GEMINI_API_KEY` - Already configured

## 🔒 Security Notes

- ✅ Service Role Key bypasses RLS (by design, for server-side operations)
- ✅ Service Role Key is only used in serverless functions (never exposed to client)
- ✅ Clerk handles user authentication
- ✅ RLS policies protect data at database level

## 📚 Documentation

- See `QUOTA_SETUP.md` for detailed quota system documentation
- See `DEPLOYMENT.md` for deployment instructions
