# 🔧 Fix Heroku Authentication - Step-by-Step Instructions

## What Was Wrong
Your authentication was failing because the environment variables (Supabase URL and API key) weren't embedded in your JavaScript files when deployed to Heroku. The pre-built `dist/` folder didn't contain these values.

## What I Fixed
1. ✅ Removed the pre-built `dist/` folder from git
2. ✅ Added `dist/` to `.gitignore` so it won't be tracked
3. ✅ Created a script to set Heroku environment variables
4. ✅ Committed all changes

## What You Need to Do Now

### Step 1: Install Heroku CLI (if not already installed)
If you don't have the Heroku CLI installed, you need to install it first:

**On Mac (using Homebrew):**
```bash
brew tap heroku/brew && brew install heroku
```

**Or download from:** https://devcenter.heroku.com/articles/heroku-cli

### Step 2: Login to Heroku
Open your terminal and run:
```bash
heroku login
```
This will open your browser to log in.

### Step 3: Set Environment Variables on Heroku
I've created a script that will do this for you. In your terminal, run:
```bash
bash set-heroku-env.sh
```

This will set:
- `VITE_SUPABASE_URL` 
- `VITE_SUPABASE_ANON_KEY`

### Step 4: Push Changes to GitHub
Push the changes to trigger a new build on Heroku:
```bash
git push origin main
```

### Step 5: Monitor the Deployment
Watch the Heroku build process:
```bash
heroku logs --tail --app dry-harbor-76962
```

Look for messages like:
- "Building for production..."
- "Build completed"
- "GymBuddy server running on port..."

### Step 6: Test Authentication
Once the build is complete (usually takes 2-3 minutes):

1. Go to: https://dry-harbor-76962-559d5aa4f14a.herokuapp.com/
2. Try logging in with your credentials:
   - Email: ivanaguilarmari@gmail.com
   - Password: [your password]

## How to Verify It's Working

### Check if Environment Variables are Set:
```bash
heroku config --app dry-harbor-76962
```

You should see:
```
VITE_SUPABASE_ANON_KEY: eyJhbGc...
VITE_SUPABASE_URL:      https://cikoqlryskuczwtfkprq.supabase.co
```

### Check Build Logs:
```bash
heroku logs --tail --app dry-harbor-76962 | grep "vite build"
```

You should see Vite building with the environment variables.

## If Authentication Still Doesn't Work

1. **Clear your browser cache** (important!)
2. **Check browser console** for errors (press F12)
3. **Restart the Heroku app:**
   ```bash
   heroku restart --app dry-harbor-76962
   ```

## Understanding the Fix

**Before:** 
- dist/ folder was pre-built locally without environment variables
- Heroku served these files, but they had undefined values for Supabase

**After:**
- Heroku builds the app fresh each time you deploy
- During build, Vite embeds the environment variables into the JavaScript
- Your app now has the correct Supabase credentials

## Summary
The key insight is that Vite needs to embed environment variables at **build time**, not runtime. By letting Heroku build your app with the correct environment variables, your authentication will work properly.

---
*Once you complete these steps, your authentication should work! The app will connect to Supabase correctly.*