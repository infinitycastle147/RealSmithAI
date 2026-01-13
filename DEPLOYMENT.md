# Clerk Authentication Deployment Guide

## Implementation Summary

This application has been successfully transformed from a pure frontend app to a full-stack application with mandatory Clerk authentication.

## What Was Implemented

### Phase 1: Backend Infrastructure ✅
- ✅ Created `/api` directory with Vercel serverless functions
- ✅ Created `/prompts` directory for centralized prompt management
- ✅ Installed dependencies: `@clerk/clerk-react`, `@clerk/express`, `@vercel/node`
- ✅ Created `vercel.json` configuration

### Phase 2: Backend API ✅
- ✅ Created `/api/_middleware.ts` - Authentication helper
- ✅ Created `/api/gemini/script.ts` - Script generation endpoint
- ✅ Created `/api/gemini/image.ts` - Image generation endpoint
- ✅ Created `/api/gemini/voice.ts` - Voice synthesis endpoint
- ✅ All endpoints require Clerk authentication

### Phase 3: Frontend Integration ✅
- ✅ Updated `index.tsx` - Added ClerkProvider wrapper
- ✅ Updated `App.tsx` - Added authentication checks and UserButton
- ✅ Updated `services/gemini.ts` - Now calls backend APIs instead of direct Gemini calls
- ✅ Removed API key from `vite.config.ts`

### Phase 4: Error Handling ✅
- ✅ Session expiration handling with redirect to sign-in
- ✅ Network error handling with user-friendly messages
- ✅ Loading states during authentication

## Environment Variables Setup

### Frontend (.env file)
Create a `.env` file in the project root with:
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_b25lLWxlbXVyLTQ4LmNsZXJrLmFjY291bnRzLmRldiQ
```

### Vercel Dashboard (Backend)
Add these environment variables in your Vercel project settings:

1. **CLERK_SECRET_KEY**
   - Value: `sk_test_6RshvOSKNgVlasQi8yHl1DOotMkrFYUEhw65bNLqKW`

2. **GEMINI_API_KEY**
   - Value: Your Google Gemini API key (move from frontend)

3. **SUPABASE_URL** (for PostgreSQL quota system)
   - Value: Your Supabase project URL (e.g., `https://bzyhmnxpzowiauoqllhw.supabase.co`)

4. **SUPABASE_SERVICE_ROLE_KEY** (for PostgreSQL quota system)
   - Value: Your Supabase Service Role Key (secret key)
   - Get this from Supabase Dashboard → Settings → API → Service Role Key
   - ⚠️ **Important**: Use Service Role Key (starts with `sb_secret_...`), NOT Publishable Key

## Installation Steps

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Set Up Environment Variables**
   - Create `.env` file with `VITE_CLERK_PUBLISHABLE_KEY`
   - Add `CLERK_SECRET_KEY` and `GEMINI_API_KEY` to Vercel dashboard

3. **Local Development**
   ```bash
   # Install Vercel CLI if not already installed
   npm i -g vercel
   
   # Run local development server
   vercel dev
   ```

4. **Deploy to Vercel**
   ```bash
   vercel
   ```

## Security Notes

- ✅ API key is no longer exposed in frontend bundle
- ✅ All API routes require authentication
- ✅ Unauthenticated users are redirected to sign-in
- ✅ Session tokens are validated on every API request

## Testing Checklist

- [ ] Test sign-in flow
- [ ] Test unauthenticated access (should redirect)
- [ ] Test script generation endpoint
- [ ] Test image generation endpoint
- [ ] Test voice synthesis endpoint
- [ ] Test session expiration handling
- [ ] Test network error handling
- [ ] Verify API key is not in frontend bundle (check build output)

## Troubleshooting

### "Missing Clerk Publishable Key" Error
- Ensure `.env` file exists with `VITE_CLERK_PUBLISHABLE_KEY`
- Restart dev server after adding environment variables

### "Unauthorized" Errors
- Check that `CLERK_SECRET_KEY` is set in Vercel dashboard
- Verify the token is being sent in Authorization header

### API Routes Not Working
- Ensure `vercel.json` is configured correctly
- Check that API routes are in `/api` directory
- Verify Vercel runtime is set to `@vercel/node`

## Database Setup (Supabase PostgreSQL)

The quota system uses Supabase PostgreSQL for Vercel serverless compatibility.

1. **Get Service Role Key:**
   - Go to Supabase Dashboard → Settings → API
   - Copy the **Service Role Key** (secret key, starts with `sb_secret_...`)
   - ⚠️ **Important**: Use Service Role Key, NOT Publishable Key for serverless functions

2. **Set Environment Variables:**
   - Add `SUPABASE_URL` (your project URL) to Vercel dashboard
   - Add `SUPABASE_SERVICE_ROLE_KEY` (your service role key) to Vercel dashboard

3. **Verify Tables:**
   - Tables are already created via Supabase MCP migration
   - Check Supabase Dashboard → Table Editor to verify
   - Or call `POST /api/init-db` to verify tables exist

See `QUOTA_SETUP.md` for detailed instructions.

## Next Steps

1. Deploy to Vercel
2. Configure environment variables in Vercel dashboard
3. Set up Turso database and initialize tables
4. Test authentication flow in production
5. Monitor for any authentication errors
6. Test quota system (Feature 2: Token Quota System)
