# Heroku Deployment Fix Instructions

## Problem Identified ✅
The authentication failures are caused by missing environment variables on Heroku. The build process is embedding placeholder values instead of actual Supabase credentials.

**Status: DIAGNOSED** - The issue is confirmed. Vite is not loading environment variables during the Heroku build process.

## Root Cause ✅
1. **Heroku doesn't automatically copy local `.env` files** - Environment variables must be explicitly set on the Heroku platform
2. **Vite requires environment variables during build time** - VITE_* prefixed variables are embedded at build time, not runtime
3. **Build verification shows placeholder values** - The built JavaScript contains `"your_anon_key"` instead of actual credentials

## Diagnosis Results
- ✅ Local environment variables are correctly configured
- ✅ Vite build process works with explicit environment variables
- ❌ Heroku environment variables are not set
- ❌ Production build contains placeholder values

## Solution

### Step 1: Set Environment Variables on Heroku

You have two options:

#### Option A: Use the provided script (Recommended)
```bash
chmod +x heroku-env-setup.sh
./heroku-env-setup.sh
```

#### Option B: Set variables manually
Run these commands in your terminal:

```bash
# Critical Supabase Configuration
heroku config:set VITE_SUPABASE_URL=https://cikoqlryskuczwtfkprq.supabase.co --app dry-harbor-76962
heroku config:set VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpa29xbHJ5c2t1Y3p3dGZrcHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzIwODcsImV4cCI6MjA2ODk0ODA4N30.O_DML3t7yZOAJ7LcIqnPSuWCo7_DpeAcqxxIN38TUd8 --app dry-harbor-76962

# WhatsApp Integration
heroku config:set VITE_EVOLUTION_API_URL=https://gymbuddy-evolution-ivan-9989ed3d8228.herokuapp.com --app dry-harbor-76962
heroku config:set VITE_EVOLUTION_API_KEY=gymbuddy-secret-key-12345 --app dry-harbor-76962
heroku config:set VITE_EVOLUTION_INSTANCE_NAME=gymbuddy-coordinator --app dry-harbor-76962
heroku config:set VITE_N8N_WEBHOOK_URL=https://gymbuddy-n8n-a666114e1339.herokuapp.com/webhook/gymbuddy --app dry-harbor-76962

# User Configuration
heroku config:set VITE_USER_IVAN_EMAIL=ivanaguilarmari@gmail.com --app dry-harbor-76962
heroku config:set VITE_USER_IVAN_PHONE=+447763242583 --app dry-harbor-76962
heroku config:set VITE_USER_YOUSSEF_EMAIL=youssef.dummy@test.com --app dry-harbor-76962
heroku config:set VITE_USER_YOUSSEF_PHONE=+447123456789 --app dry-harbor-76962
```

### Step 2: Trigger a New Build
After setting the environment variables, trigger a new deployment:

```bash
# Option 1: Push a commit (recommended)
git add .
git commit -m "Fix Heroku environment variables configuration"
git push heroku main

# Option 2: Manually trigger rebuild
heroku releases:retry --app dry-harbor-76962
```

### Step 3: Verify the Fix

1. **Check environment variables are set:**
   ```bash
   heroku config --app dry-harbor-76962
   ```

2. **Wait for build to complete** (check at: https://dashboard.heroku.com/apps/dry-harbor-76962/activity)

3. **Test the authentication:**
   - Visit: https://dry-harbor-76962-559d5aa4f14a.herokuapp.com/
   - Open browser console (F12)
   - Look for the "Environment Variable Diagnostics" output
   - Verify that the Supabase URL shows your actual project URL (not placeholder)

4. **Test sign-up/sign-in:**
   - Try creating a new account
   - Should succeed without "Failed to fetch" errors

## Expected Results

After applying this fix:
- Environment variables will be properly embedded in the built JavaScript files
- Supabase client will connect to the correct project
- Authentication will work without network errors
- Users can successfully sign up and sign in

## Verification Commands

```bash
# Check if build completed successfully
heroku logs --tail --app dry-harbor-76962

# Verify environment variables are set
heroku config --app dry-harbor-76962 | grep VITE_SUPABASE

# Check the deployed JavaScript contains correct values
curl -s https://dry-harbor-76962-559d5aa4f14a.herokuapp.com/ | grep "cikoqlryskuczwtfkprq"
```

## Troubleshooting

If authentication still fails after applying the fix:

1. **Clear browser cache** - Old cached files might still be loaded
2. **Check Supabase project status** - Ensure your Supabase project is active
3. **Verify RLS policies** - Make sure Row Level Security policies allow user creation
4. **Check network logs** - Look for CORS or network errors in browser dev tools

## Prevention

To prevent this issue in the future:
- Always set environment variables on Heroku when deploying
- Never commit sensitive credentials to git
- Test deployment in a staging environment before production
- Use the heroku-env-setup.sh script for consistent deployments