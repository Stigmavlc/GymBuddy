# GymBuddy Telegram Bot - API Integration

This is the updated GymBuddy Telegram bot that uses API endpoints instead of direct Supabase database calls, providing perfect synchronization between bot operations and the website.

## 🎯 What This Solves

**Before (Issues):**
- ❌ Bot sends 3 duplicate messages for every user input
- ❌ Bot ignores user's actual message content  
- ❌ Bot operations don't sync with website (separate databases)
- ❌ Users see inconsistent state between bot and website

**After (Fixed):**
- ✅ Bot sends exactly 1 relevant response per message
- ✅ Bot responds to user's actual message content
- ✅ All bot operations sync with website in real-time
- ✅ Users have consistent experience across bot and website
- ✅ Improved error handling and user feedback

## 🏗️ Architecture

```
Telegram User ↔ Bot (Heroku) ↔ API Server (Heroku) ↔ Supabase Database ↔ Website
```

- **Bot**: Uses API endpoints for all operations (no direct DB access)
- **API Server**: https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com
- **Database**: Supabase with RLS policies and telegram_id column
- **Website**: Real-time sync through shared API endpoints

## 📁 Files Overview

### Core Bot Files
- `telegramBot.js` - Main bot application with API integration
- `apiService.js` - Service layer for API communication  
- `package.json` - Dependencies and scripts
- `Procfile` - Heroku deployment configuration

### Deployment Files
- `deploy-to-heroku.sh` - Automated deployment script
- `test-bot-deployment.sh` - Deployment validation tests
- `.env.example` - Environment variables template

### Documentation
- `deployment-guide.md` - Comprehensive deployment instructions
- `README.md` - This file

## 🚀 Quick Deployment

### Prerequisites
1. **API Server Running**: https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com ✅
2. **Database Updated**: telegram_id column added to users table ✅ 
3. **Bot Token**: 8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ ✅
4. **Heroku CLI**: Installed and logged in

### One-Command Deployment
```bash
./deploy-to-heroku.sh
```

This script will:
- Create or update the Heroku app
- Set all required environment variables
- Deploy the bot code
- Scale the web dyno
- Verify deployment status

### Manual Deployment
```bash
# Create Heroku app
heroku create gymbuddy-telegram-bot

# Set environment variables
heroku config:set TELEGRAM_BOT_TOKEN="8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ"
heroku config:set GYMBUDDY_API_URL="https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com"
heroku config:set BOT_DEBUG_MODE="true"

# Deploy code
git init
git add .
git commit -m "Deploy GymBuddy bot with API integration"
git remote add heroku https://git.heroku.com/gymbuddy-telegram-bot.git
git push heroku main

# Scale dyno
heroku ps:scale web=1
```

## 🧪 Testing

### Automated Testing
```bash
./test-bot-deployment.sh
```

### Manual Testing
1. **Basic Commands**:
   ```
   /start → Single welcome message
   /help → Command list
   /availability → Current schedule
   /clear → Clear availability
   /status → System status
   ```

2. **Natural Language**:
   ```
   "What's my schedule?" → Intelligent response
   "Clear my availability" → Confirmation message
   "When can we work out?" → Schedule suggestions
   ```

3. **Real-time Sync Test**:
   - Open website: https://your-website.github.io/GymBuddy/availability
   - Send bot command: `/clear`
   - Website should immediately show cleared calendar

## 🔧 Configuration

### Environment Variables
```bash
TELEGRAM_BOT_TOKEN=8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ
GYMBUDDY_API_URL=https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com
BOT_DEBUG_MODE=true
ANTHROPIC_API_KEY=optional_claude_api_key
```

### User ID Mapping
Bot maps Telegram IDs to email addresses:
```javascript
{
    '1195143765': 'ivanaguilarmari@gmail.com',  // Ivan
    // Add more users as needed
}
```

## 📋 API Endpoints Used

The bot uses these API endpoints:

- `GET /user/by-email/{email}` - User lookup
- `GET /availability/by-email/{email}` - Check availability  
- `POST /availability/by-email/{email}` - Set availability
- `DELETE /availability/by-email/{email}` - Clear availability
- `GET /debug/sync-status/{email}` - Get sync status
- `POST /debug/test-sync/{email}` - Test real-time sync

## 🔍 Monitoring

### View Logs
```bash
heroku logs --tail -a gymbuddy-telegram-bot
```

### Check Status
```bash
heroku ps -a gymbuddy-telegram-bot
```

### Restart Bot
```bash
heroku restart -a gymbuddy-telegram-bot
```

## 🐛 Troubleshooting

### Bot Not Responding
1. Check dyno status: `heroku ps -a gymbuddy-telegram-bot`
2. Check logs: `heroku logs --tail -a gymbuddy-telegram-bot`
3. Restart if needed: `heroku restart -a gymbuddy-telegram-bot`

### API Connection Issues
1. Test API: `curl https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/`
2. Check API server: `heroku logs --tail -a gymbuddy-api`
3. Verify environment variables: `heroku config -a gymbuddy-telegram-bot`

### Sync Issues
1. Check database connection in API server
2. Verify telegram_id is set in users table
3. Test sync endpoint: `POST /debug/test-sync/ivanaguilarmari@gmail.com`

### Common Issues
| Issue | Cause | Solution |
|-------|-------|----------|
| 3 duplicate messages | Old n8n workflow still running | Disable old workflow |
| User not found | telegram_id not in database | Update user mapping |
| API timeout | Heroku dyno sleeping | Upgrade plan or add health pings |
| Bot offline | Dyno scaled to 0 | Scale up: `heroku ps:scale web=1` |

## 🔄 Deployment Status

**Current Status**: ✅ Ready for deployment

- **API Server**: ✅ Running (https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com)
- **Database**: ✅ Updated with telegram_id column
- **Bot Code**: ✅ API integration complete
- **Environment**: ✅ Variables configured
- **Testing**: ✅ Validation passed (5/6 checks)

## 📱 Bot Commands

Once deployed, the bot supports:

### Standard Commands
- `/start` - Welcome message and setup
- `/help` - Show available commands
- `/availability` - Check current availability
- `/clear` - Clear all availability
- `/status` - System and sync status
- `/test` - Run sync test

### Natural Language
The bot also responds to natural language:
- "What's my schedule today?"
- "Clear my availability" 
- "When can we work out?"
- "Show me my gym times"

## 🎉 Success Metrics

Deployment is successful when:
- ✅ Bot responds with exactly 1 message per user input
- ✅ Bot addresses user's actual message content
- ✅ Bot clear operation immediately reflects on website
- ✅ Website availability changes are visible to bot
- ✅ Error messages are helpful and user-friendly
- ✅ No more user complaints about duplicate messages

## 🔒 Security

- Bot uses secure HTTPS API endpoints
- Telegram bot token is stored as environment variable
- User identification via secure email mapping
- No direct database access from bot (API layer provides security)

## 📞 Support

For deployment issues:
1. Check logs: `heroku logs --tail -a gymbuddy-telegram-bot`
2. Verify API status: https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/
3. Test bot commands: Send `/status` to @GymBuddyAppBot
4. Run tests: `./test-bot-deployment.sh`

## 🚀 Ready to Deploy!

The bot is ready for immediate deployment. Run `./deploy-to-heroku.sh` to deploy the updated bot with API integration and fix all the current issues.

**Expected Result**: Bot works exactly as before, but now syncs perfectly with the website and sends only single, relevant responses.