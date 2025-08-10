# GymBuddy API Server 🤖💪

This is the bot synchronization API server that enables seamless communication between your Telegram bot and the GymBuddy React website.

## 🚀 Quick Deploy Links

### Option 1: Railway (Recommended for beginners)
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/7KrJzG?referralCode=bonus)

### Option 2: Render (Free tier available)
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy)

### Option 3: Heroku
[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy)

## 🛠️ Manual Deployment Steps

### 1. Choose Your Platform

**Railway** (Easiest - Recommended):
- Go to [railway.app](https://railway.app)
- Click "Login with GitHub"
- Click "New Project" → "Deploy from GitHub repo"
- Select your GymBuddy repository
- Select the `/api` folder as the root directory

**Render** (Good free tier):
- Go to [render.com](https://render.com)
- Click "New" → "Web Service"
- Connect your GitHub repository
- Set Root Directory: `api`
- Build Command: `npm install`
- Start Command: `npm start`

**Heroku** (More complex but powerful):
- Install Heroku CLI
- `heroku create your-gymbuddy-api`
- `git subtree push --prefix=api heroku main`

### 2. Set Environment Variables

In your deployment platform, add these environment variables:

```
SUPABASE_URL=https://cikoqlryskuczwtfkprq.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here
PORT=3001
```

**Important**: You need your Supabase **service role key** (not the anon key) for bot operations.

### 3. Get Your Service Role Key

1. Go to [supabase.com](https://supabase.com/dashboard)
2. Select your GymBuddy project
3. Go to Settings → API
4. Copy the "service_role" key (starts with `eyJ...`)
5. Paste it as `SUPABASE_SERVICE_KEY` in your deployment platform

### 4. Test Your Deployment

Once deployed, visit your API URL (you'll get this from your deployment platform).
You should see:

```json
{
  "status": "GymBuddy API is running! 💪",
  "version": "2.0.0",
  "endpoints": { ... }
}
```

## 📋 API Endpoints

### User Operations
- `GET /user/by-email/ivanaguilarmari@gmail.com` - Find user by email

### Availability Management  
- `GET /availability/by-email/ivanaguilarmari@gmail.com` - Get availability
- `DELETE /availability/by-email/ivanaguilarmari@gmail.com` - Clear availability
- `POST /availability/by-email/ivanaguilarmari@gmail.com` - Set availability

### Debug & Testing
- `GET /debug/sync-status/ivanaguilarmari@gmail.com` - Check sync status
- `POST /debug/test-sync/ivanaguilarmari@gmail.com` - Test synchronization

## 🤖 Bot Integration

Once your API is deployed, update your bot code to use the API instead of direct database calls:

```javascript
// Instead of direct Supabase queries:
await supabase.from('availability').delete().eq('user_id', userId)

// Use your API:
const response = await fetch('https://your-api-url.railway.app/availability/by-email/ivanaguilarmari@gmail.com', {
    method: 'DELETE'
});
const result = await response.json();
console.log('✅ Cleared:', result.deletedCount, 'slots');
```

## 🔧 Local Development

```bash
cd api/
npm install
npm start
```

Visit http://localhost:3001 to test locally.

## 🆘 Troubleshooting

**"Cannot connect to database"**:
- Check your `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` 
- Make sure you're using the service_role key, not anon key

**"User not found"**:
- Run the database fix script first: `supabase/fix_bot_user_mapping.sql`
- This adds the telegram_id column needed for bot operations

**"No slots cleared"**:
- Check if the user has availability set on the website first
- Use debug endpoints to see what's happening

## 📝 Next Steps

1. Deploy the API server using one of the options above
2. Update your bot to use the API endpoints
3. Test bot operations (clear availability, set availability)
4. Enjoy seamless bot-website synchronization! 🎉