# Environment Variables Setup for Partner Coordination

## Overview

After deploying the database schema, you'll need to update your environment variables to support the partner coordination features. This guide shows you exactly what variables to add and where.

## Required Environment Variables

### For Your API Server (Heroku/Production)

These variables should be added to your API server environment (wherever your `server.js` is running):

```bash
# Core Supabase Configuration (you should already have these)
SUPABASE_URL=https://cikoqlryskuczwtfkprq.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here

# User Mapping for Bot Integration
IVAN_TELEGRAM_ID=your_telegram_user_id
YOUSSEF_TELEGRAM_ID=youssef_telegram_user_id

# API Configuration
API_BASE_URL=https://your-api-domain.herokuapp.com
BOT_DEBUG_MODE=true

# Optional: Custom Database Connection (only if not using Supabase)
# DB_HOST=your_custom_db_host
# DB_USER=your_custom_db_user  
# DB_PASSWORD=your_custom_db_password
# DB_NAME=your_custom_db_name
```

### For Your Telegram Bot (Bot Integration)

These variables should be added to your bot environment:

```bash
# Telegram Configuration (you should already have this)
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Claude/Anthropic Configuration (you should already have this)
ANTHROPIC_API_KEY=your_claude_api_key

# Supabase Configuration (same as API)
SUPABASE_URL=https://cikoqlryskuczwtfkprq.supabase.co
SUPABASE_SERVICE_KEY=your_service_role_key_here

# User Mapping (same as API)
IVAN_TELEGRAM_ID=your_telegram_user_id
YOUSSEF_TELEGRAM_ID=youssef_telegram_user_id

# API Connection
API_BASE_URL=https://your-api-domain.herokuapp.com
BOT_DEBUG_MODE=true
```

## How to Get the Missing Values

### 1. Getting Your Telegram User ID

**Method 1 - Using Your Bot:**
1. Send a message to your GymBuddy bot
2. Check the bot logs - they should show your Telegram user ID
3. Look for lines like "Received message from user ID: 123456789"

**Method 2 - Using @userinfobot:**
1. Find @userinfobot on Telegram
2. Send it any message
3. It will reply with your user ID

**Method 3 - Using Your Current Bot Code:**
Add this temporary debug code to your bot:
```javascript
bot.on('message', (msg) => {
    console.log(`User ID: ${msg.from.id}, Username: ${msg.from.username}, Name: ${msg.from.first_name}`);
});
```

### 2. Getting Youssef's Telegram User ID

You'll need Youssef to:
1. Send a message to your bot, OR
2. Use @userinfobot to get his ID, OR  
3. Give you his Telegram username so you can look it up

### 3. Getting Your Supabase Service Role Key

1. Go to [https://supabase.com](https://supabase.com)
2. Open your GymBuddy project
3. Go to Settings → API
4. Copy the "service_role" key (NOT the anon key)
5. This key is secret - don't share it publicly!

## Where to Add These Variables

### For Heroku API Deployment:

1. Go to [https://dashboard.heroku.com](https://dashboard.heroku.com)
2. Open your API app
3. Go to Settings → Config Vars
4. Click "Reveal Config Vars"
5. Add each variable with its value

### For Local Development:

1. Create or edit your `.env` file in your project root
2. Add all the variables listed above
3. Make sure `.env` is in your `.gitignore` file

### For Bot Integration (if separate):

1. If your bot runs on a separate service (Heroku, Railway, etc.)
2. Add the bot variables to that service's environment
3. If running locally, add to the bot project's `.env` file

## Example .env File Structure

```bash
# =================================
# CORE SUPABASE CONFIGURATION
# =================================
SUPABASE_URL=https://cikoqlryskuczwtfkprq.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# =================================  
# TELEGRAM CONFIGURATION
# =================================
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
IVAN_TELEGRAM_ID=123456789
YOUSSEF_TELEGRAM_ID=987654321

# =================================
# API CONFIGURATION  
# =================================
ANTHROPIC_API_KEY=sk-ant-api03-...
API_BASE_URL=https://your-api-domain.herokuapp.com
BOT_DEBUG_MODE=true

# =================================
# OPTIONAL: CUSTOM DATABASE
# =================================  
# DB_HOST=localhost
# DB_USER=postgres
# DB_PASSWORD=your_password
# DB_NAME=gymbuddy
```

## Testing Your Environment Variables

### Test API Server Variables:

1. Restart your API server after adding variables
2. Check the API health endpoint: `https://your-api-domain.com/`
3. You should see the new partner coordination endpoints listed

### Test Bot Variables:

1. Restart your bot after adding variables
2. Send a message to your bot
3. Check bot logs for any environment variable errors
4. Try the `/debug` command if available

### Quick Test Script:

You can add this to your API server temporarily to test variables:

```javascript
// Add this to server.js temporarily
app.get('/debug/env', (req, res) => {
    res.json({
        supabase_url: process.env.SUPABASE_URL ? 'SET' : 'MISSING',
        supabase_key: process.env.SUPABASE_SERVICE_KEY ? 'SET' : 'MISSING', 
        ivan_id: process.env.IVAN_TELEGRAM_ID ? 'SET' : 'MISSING',
        youssef_id: process.env.YOUSSEF_TELEGRAM_ID ? 'SET' : 'MISSING',
        api_base: process.env.API_BASE_URL ? 'SET' : 'MISSING',
        debug_mode: process.env.BOT_DEBUG_MODE
    });
});
```

Then visit: `https://your-api-domain.com/debug/env`

## Troubleshooting

### "Environment variable not found" errors:
- Make sure you added the variable to the correct service (API vs Bot)
- Check for typos in variable names
- Restart your service after adding variables

### "Invalid Supabase key" errors:
- Make sure you're using the service_role key, not the anon key
- Check that the key wasn't truncated when copying
- Verify you're using the correct project URL

### "User ID not found" errors:
- Make sure Telegram user IDs are numbers, not strings
- Verify the user IDs are correct by testing with your bot
- Check that both Ivan and Youssef have interacted with the bot

### Bot not responding to coordination requests:
- Verify API_BASE_URL is correct and accessible
- Check that both IVAN_TELEGRAM_ID and YOUSSEF_TELEGRAM_ID are set
- Enable BOT_DEBUG_MODE=true to see detailed logs

## Security Notes

1. **Never commit .env files** - Add `.env` to your `.gitignore`
2. **Protect your service role key** - It has full database access
3. **Use environment variables** - Never hardcode secrets in your code
4. **Rotate keys periodically** - Generate new keys if compromised
5. **Limit bot access** - Only give bot necessary permissions

## Next Steps After Setting Variables

1. **Deploy database schema** (if not done yet)
2. **Restart all services** after adding variables
3. **Test basic functionality** with validation queries
4. **Set up partner relationship** between Ivan and Youssef
5. **Test end-to-end workflow** with real messages

Remember: Environment variables won't take effect until you restart your services!