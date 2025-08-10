# 🚀 GymBuddy API Server Deployment Guide

## What Is This?

The API server enables your Telegram bot to sync with your website. When you deploy this, your bot will be able to:
- ✅ Clear your availability and see it disappear from the website instantly
- ✅ Set availability via bot and see it appear on the website  
- ✅ Get real-time synchronization between bot and website
- ✅ Use advanced debugging and monitoring

## 🎯 Easiest Option: Railway (Recommended)

**Step 1**: Go to [railway.app](https://railway.app)

**Step 2**: Click "Login with GitHub" and authorize Railway

**Step 3**: Click "New Project" 

**Step 4**: Click "Deploy from GitHub repo"

**Step 5**: Select your **GymBuddy** repository

**Step 6**: Railway will ask about the root directory:
- Click "Configure" 
- Set **Root Directory** to: `api`
- Click "Deploy"

**Step 7**: Add Environment Variables:
- In Railway, go to your project → Variables tab
- Add these 3 variables:

```
SUPABASE_URL = https://cikoqlryskuczwtfkprq.supabase.co
SUPABASE_SERVICE_KEY = [your service key - see below]
PORT = 3001
```

**Step 8**: Get Your Service Key:
1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Select your GymBuddy project  
3. Go to Settings → API
4. Copy the **"service_role"** key (the long one that starts with `eyJ...`)
5. Paste it as the `SUPABASE_SERVICE_KEY` value in Railway

**Step 9**: Wait for Deployment (2-3 minutes)

**Step 10**: Test Your API:
- Railway will give you a URL like `https://your-project.railway.app`
- Visit that URL - you should see: `"GymBuddy API is running! 💪"`

## 🛠️ Alternative: Render (Free Tier)

**Step 1**: Go to [render.com](https://render.com)

**Step 2**: Click "Get Started for Free" → Sign up with GitHub

**Step 3**: Click "New" → "Web Service" 

**Step 4**: Connect your GitHub and select **GymBuddy** repository

**Step 5**: Configure:
- **Name**: `gymbuddy-api`
- **Root Directory**: `api`  
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

**Step 6**: Add Environment Variables (same as Railway step 7-8 above)

**Step 7**: Click "Create Web Service"

## 🤖 Update Your Bot

Once your API is deployed, update your bot code. Replace direct database queries with API calls:

### Before (Direct Database):
```javascript
// Old way - direct database access
const { data, error } = await supabase
    .from('availability')
    .delete()
    .eq('user_id', userId);
```

### After (Using Your API):
```javascript
// New way - using your API
const response = await fetch('https://your-api-url.railway.app/availability/by-email/ivanaguilarmari@gmail.com', {
    method: 'DELETE'
});
const result = await response.json();
console.log('✅ Cleared:', result.deletedCount, 'availability slots');
```

## 🧪 Test Your Setup

1. **Test API Health**: Visit your API URL - should show "GymBuddy API is running! 💪"

2. **Test User Lookup**:
   ```bash
   curl https://your-api-url.railway.app/user/by-email/ivanaguilarmari@gmail.com
   ```

3. **Test Bot Operations**: 
   ```bash
   # Clear availability
   curl -X DELETE https://your-api-url.railway.app/availability/by-email/ivanaguilarmari@gmail.com
   
   # Check if cleared
   curl https://your-api-url.railway.app/availability/by-email/ivanaguilarmari@gmail.com
   ```

## 📋 Important Notes

### ⚠️ Database Setup Required First

Before the bot sync works, you **MUST** run this SQL in Supabase:

```sql
-- Add telegram_id column for bot user identification
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);

-- Set your Telegram ID (replace 1195143765 with your actual Telegram user ID)
UPDATE public.users 
SET telegram_id = 1195143765 
WHERE email = 'ivanaguilarmari@gmail.com';
```

### 🔍 How to Find Your Telegram ID

1. Message the bot @userinfobot on Telegram
2. It will reply with your user ID (a number like 1195143765)
3. Use that number in the SQL above

### 🚨 Common Issues

**"Cannot connect to database"**:
- Check your `SUPABASE_SERVICE_KEY` is the service_role key, not anon key
- Verify the `SUPABASE_URL` is correct

**"User not found"**:
- Run the database SQL script above first
- Make sure your email matches exactly: `ivanaguilarmari@gmail.com`

**"Bot says cleared but website still shows availability"**:
- The database column is missing - run the SQL script above
- Check the debug endpoint: `/debug/sync-status/ivanaguilarmari@gmail.com`

## 🎉 Success!

Once deployed and configured:
- Your bot can clear availability → instantly disappears from website
- Your bot can set availability → instantly appears on website  
- No manual refresh needed - real-time synchronization works!
- Full debugging and monitoring available

The bot-website sync issue will be completely resolved! 🚀💪