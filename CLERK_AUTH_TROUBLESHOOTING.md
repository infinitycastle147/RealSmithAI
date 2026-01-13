# Clerk Authentication Troubleshooting Guide

## Problem: Getting `{"error":"Unauthorized","code":"UNAUTHORIZED"}`

This error means the backend cannot verify the Clerk JWT token. Here's how to fix it:

## Step 1: Verify Backend Environment Variables

**CRITICAL:** Your Express backend **MUST** have `CLERK_SECRET_KEY` set.

### Check Your Backend Deployment:

1. Go to your backend deployment platform (Railway, Render, etc.)
2. Navigate to **Environment Variables** or **Settings**
3. Verify `CLERK_SECRET_KEY` is set:
   ```
   CLERK_SECRET_KEY=sk_test_... or sk_live_...
   ```

### Get Your Clerk Secret Key:

1. Go to https://dashboard.clerk.com
2. Select your application
3. Go to **API Keys** in the sidebar
4. Copy the **Secret Key** (starts with `sk_test_` or `sk_live_`)
5. Add it to your backend environment variables

**Important:** 
- Use `sk_test_...` for development
- Use `sk_live_...` for production
- The secret key is different from the publishable key (`pk_test_...`)

## Step 2: Verify Frontend is Sending Token

The frontend should automatically send the token. Check:

1. Open browser DevTools → Network tab
2. Make an API request (e.g., generate script)
3. Check the request headers - should see:
   ```
   Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

If the `Authorization` header is missing:
- User might not be signed in
- Check if `getToken()` is being called
- Verify Clerk is initialized in the frontend

## Step 3: Check CORS Configuration

The backend should allow requests from your frontend domain.

In `server.ts`, CORS is configured as:
```typescript
app.use(cors());
```

This allows all origins. For production, you might want to restrict it:
```typescript
app.use(cors({
  origin: ['https://reelzeroai.vercel.app', 'http://localhost:3000'],
  credentials: true
}));
```

## Step 4: Verify Clerk Middleware is Applied

In `server.ts`, make sure `clerkMiddleware()` is called **before** routes:

```typescript
// ✅ Correct order
app.use(cors());
app.use(express.json());
app.use(clerkMiddleware()); // Must be before routes
app.use('/api/gemini/script', requireAuth, scriptRoute);
```

## Step 5: Test Authentication Flow

### Test 1: Health Check (No Auth Required)
```bash
curl https://your-backend-url.com/health
```
Should return: `{"status":"ok","timestamp":"..."}`

### Test 2: API Call Without Token (Should Fail)
```bash
curl https://your-backend-url.com/api/quota/status
```
Should return: `{"error":"Unauthorized","code":"UNAUTHORIZED"}`

### Test 3: API Call With Token (Should Work)
1. Get token from frontend (check browser console or network tab)
2. Use it in curl:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  https://your-backend-url.com/api/quota/status
```

## Common Issues

### Issue 1: "CLERK_SECRET_KEY is not set"
**Solution:** Add `CLERK_SECRET_KEY` to your backend environment variables

### Issue 2: "Invalid token format"
**Solution:** Make sure frontend is sending `Bearer <token>`, not just the token

### Issue 3: "Token expired"
**Solution:** User needs to sign in again. Frontend should handle this automatically.

### Issue 4: CORS errors in browser
**Solution:** Check CORS configuration in `server.ts` allows your frontend domain

### Issue 5: Different Clerk apps for frontend/backend
**Solution:** Make sure both frontend and backend use the **same Clerk application**:
- Frontend uses: `VITE_CLERK_PUBLISHABLE_KEY`
- Backend uses: `CLERK_SECRET_KEY`
- Both should be from the same Clerk app

## Debugging Steps

1. **Check Backend Logs:**
   - Look for "Auth error:" messages
   - Check if `clerkMiddleware()` is being called
   - Verify environment variables are loaded

2. **Check Frontend Console:**
   - Look for authentication errors
   - Verify `getToken()` returns a token
   - Check if API calls include Authorization header

3. **Test Locally:**
   ```bash
   # Terminal 1: Start backend
   npm run dev:server
   
   # Terminal 2: Start frontend
   npm run dev:client
   ```
   - Test if authentication works locally
   - If it works locally but not in production, check environment variables

## Quick Checklist

- [ ] `CLERK_SECRET_KEY` is set in backend environment variables
- [ ] Frontend `VITE_CLERK_PUBLISHABLE_KEY` is set
- [ ] Both keys are from the same Clerk application
- [ ] `clerkMiddleware()` is called in `server.ts` before routes
- [ ] Frontend is sending `Authorization: Bearer <token>` header
- [ ] User is signed in (check `isSignedIn` in frontend)
- [ ] CORS allows your frontend domain
- [ ] Backend is restarted after adding environment variables

## Still Not Working?

1. Check backend logs for detailed error messages
2. Verify the token format in browser DevTools → Network tab
3. Test with a simple curl command to isolate the issue
4. Make sure you're using the correct Clerk application (test vs production)
