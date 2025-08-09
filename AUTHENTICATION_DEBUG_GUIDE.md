# 🚨 Authentication "Failed to fetch" Debug Guide

This guide helps diagnose and fix "Failed to fetch" authentication issues in the GymBuddy React + Supabase app deployed on Heroku.

## 🔍 Quick Diagnostic Steps

### Step 1: Open Browser Console
1. Open your browser's Developer Tools (F12)
2. Go to the **Console** tab
3. Look for the comprehensive startup logs that begin with "🚀 GymBuddy Application Startup Diagnostics"

### Step 2: Check Environment Variables
Look for the "🔧 Environment Variable Diagnostics" section in console:
- ✅ **VITE_SUPABASE_URL exists**: Should be `true`
- ✅ **VITE_SUPABASE_ANON_KEY exists**: Should be `true`
- ✅ **Supabase URL preview**: Should show your Supabase project URL
- ✅ **Key preview**: Should show first 20 characters of your key

**If any are missing:**
- Check Heroku environment variables: `heroku config --app your-app-name`
- Verify variables start with `VITE_` prefix
- Restart the Heroku app after setting variables

### Step 3: Network Connectivity Test
Look for "🌐 Network Diagnostics" section:
- ✅ **Network ping successful**: Should show green checkmark
- ✅ **Response time**: Should be under 3000ms
- ✅ **CORS headers**: Should show access control headers

**If network fails:**
- Check if you're behind a corporate firewall
- Try accessing the app from a different network
- Disable browser extensions/ad blockers temporarily

### Step 4: Supabase Service Health
Look for "🏥 Checking Supabase service health" section:
- ✅ **REST API Root**: Should pass
- ✅ **Auth Settings**: Should pass  
- ⚠️ **Auth Health**: Might fail (this is sometimes expected)
- ⚠️ **Realtime Health**: Might fail (this is sometimes expected)

**If Supabase health fails:**
- Verify your Supabase project is active (not paused)
- Check Supabase status page: https://status.supabase.com/
- Verify your project URL and API keys are correct

### Step 5: Authentication Flow Test
Look for "🔐 Testing authentication flow" section:
- ✅ **Session Check**: Should pass
- ✅ **Anonymous Access**: Should pass
- ✅ **Auth Listener Setup**: Should pass

**If authentication fails:**
- This indicates a deeper Supabase configuration issue
- Check RLS (Row Level Security) policies
- Verify your Supabase project settings

## 🛠️ Common Issues & Solutions

### Issue 1: Environment Variables Not Found
**Symptoms:**
```
❌ VITE_SUPABASE_URL exists: false
❌ VITE_SUPABASE_ANON_KEY exists: false
```

**Solution:**
```bash
# Set Heroku environment variables
heroku config:set VITE_SUPABASE_URL="https://your-project.supabase.co" --app your-app-name
heroku config:set VITE_SUPABASE_ANON_KEY="your-anon-key" --app your-app-name

# Restart the app
heroku restart --app your-app-name
```

### Issue 2: CORS Configuration Problem
**Symptoms:**
```
❌ Network ping failed: TypeError: Failed to fetch
🚨 This looks like a network/CORS issue!
```

**Solution:**
1. Go to your Supabase dashboard
2. Navigate to Settings → API
3. Add your Heroku app domain to the "Site URL" field:
   ```
   https://your-app-name.herokuapp.com
   ```
4. Also add it to "Additional URLs" if needed

### Issue 3: Supabase Project Issues
**Symptoms:**
```
❌ Supabase service check failed
❌ Auth endpoint failed: 404
```

**Solution:**
1. Check if your Supabase project is paused (free tier limitation)
2. Verify your project URL is correct in environment variables
3. Check Supabase dashboard for any project health issues
4. Regenerate API keys if they seem corrupted

### Issue 4: Build vs Runtime Environment
**Symptoms:**
- Variables work locally but not on Heroku
- Console shows "Environment variables valid" but still fails

**Solution:**
This is the most common issue with Vite apps on Heroku:

1. **Verify the build process includes environment variables:**
   ```bash
   # Check your package.json
   "scripts": {
     "heroku-postbuild": "npm run build"
   }
   ```

2. **Environment variables must be set BEFORE building:**
   ```bash
   # Set variables on Heroku
   heroku config:set VITE_SUPABASE_URL="..." --app your-app-name
   heroku config:set VITE_SUPABASE_ANON_KEY="..." --app your-app-name
   
   # Trigger new build
   git commit --allow-empty -m "Rebuild with env vars"
   git push heroku main
   ```

3. **Check that variables are embedded at build time:**
   - Look at the "📊 All import.meta.env keys" in console
   - Should include your VITE_ prefixed variables
   - If missing, the build didn't include them

## 🧪 Manual Testing Commands

Open browser console and run these commands for additional testing:

```javascript
// Test environment variables
console.log('Environment check:', {
  url: import.meta.env.VITE_SUPABASE_URL,
  keyExists: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
  mode: import.meta.env.MODE
})

// Test network connectivity to Supabase
fetch(import.meta.env.VITE_SUPABASE_URL + '/rest/v1/', {
  method: 'HEAD',
  headers: {
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + import.meta.env.VITE_SUPABASE_ANON_KEY
  }
}).then(r => console.log('Supabase connectivity:', r.status))
  .catch(e => console.error('Supabase connectivity failed:', e))

// Run health check (if available)
if (window.gymbuddyDebug) {
  window.gymbuddyDebug.runHealthCheck()
}
```

## 🎯 Debug Panel

In development mode, a floating debug panel appears in the top-right corner with:
- 🏥 **Health Check**: Run comprehensive diagnostics
- 🔐 **Test Auth**: Test authentication without login
- 🧹 **Clear Logs**: Clear console for cleaner debugging
- ❌ **Close**: Remove the debug panel

## 📞 Contact Information

If none of these solutions work:
1. Take screenshots of the console logs
2. Note which specific step fails in the diagnostics
3. Check if the issue persists across different browsers/devices
4. Contact Ivan with the diagnostic information

The comprehensive logging should give you enough information to identify exactly where the authentication flow is failing.