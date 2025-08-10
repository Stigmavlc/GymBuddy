# GymBuddy Bot-API Integration Deployment Guide

This guide provides step-by-step instructions to deploy the updated bot integration and ensure perfect synchronization between the Telegram bot and the GymBuddy website.

## Overview

**What We're Implementing:**
- Convert bot from direct Supabase calls to API endpoints
- Fix the duplicate message issue (3 responses → 1 response)
- Ensure real-time sync between bot operations and website
- Add proper error handling and logging

**Deployment Options:**
1. **Option A**: Update existing n8n workflow (recommended for current setup)
2. **Option B**: Deploy standalone Node.js bot service (alternative)

## Prerequisites

1. **API Server**: https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com (already running)
2. **Database Access**: Supabase project with service role key
3. **Bot Token**: 8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ
4. **n8n Instance**: gymbuddy-n8n-a666114e1339.herokuapp.com (current)

## STEP 1: Database Setup

### 1.1 Update Database Schema

**Action**: Run the database setup script in Supabase SQL Editor

```sql
-- Copy and paste the contents of bot-integration/database-sync-setup.sql
-- Execute in Supabase SQL Editor as authenticated user
```

**What This Does:**
- Adds `telegram_id` column to users table
- Maps Ivan's Telegram ID (1195143765) to his email
- Creates chat_history table for bot conversations
- Sets up proper RLS policies for bot access
- Creates helper functions for bot operations

**Verification:**
```sql
-- Check Ivan's mapping is correct
SELECT name, email, telegram_id 
FROM users 
WHERE telegram_id = '1195143765';

-- Should return: Ivan, ivanaguilarmari@gmail.com, 1195143765
```

### 1.2 Test API Connectivity

```bash
# Test that API can access the updated database
curl "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/user/by-email/ivanaguilarmari@gmail.com"

# Should return Ivan's user information
```

## STEP 2: Option A - Update n8n Workflow (Recommended)

### 2.1 Access n8n Workflow Editor

1. Go to: https://gymbuddy-n8n-a666114e1339.herokuapp.com
2. Open the existing GymBuddy workflow (ID: xmi3G9Ms6bNKzZb4)
3. Make the following critical changes:

### 2.2 Fix the Claude AI Node (CRITICAL)

**Problem**: Node uses `.item` which processes each availability record separately, causing 3 responses

**Solution**: Change the Claude AI node configuration

**Current Code** (causes 3 responses):
```javascript
$('Determine User Type').item.json
```

**Updated Code** (single response):
```javascript
$('Determine User Type').first().json
```

**Full Updated Message Parameter:**
```javascript
{{ 
  "User: " + $('Determine User Type').first().json.userData.firstName + 
  " (" + $('Determine User Type').first().json.userType + ")" +
  " - Telegram ID: " + $('Determine User Type').first().json.userData.telegramId + 
  "\nMessage: " + $('Determine User Type').first().json.userData.messageText + 
  "\n\nUser's current availability:\n" + 
  (($('Get User Availability').first().json && $('Get User Availability').first().json.slots && $('Get User Availability').first().json.slots.length > 0) ? 
      $('Get User Availability').first().json.slots.map(slot => 
          "- " + slot.day.charAt(0).toUpperCase() + slot.day.slice(1) + 
          ": " + slot.startTime + ":00 - " + slot.endTime + ":00"
      ).join("\n") : 
      "No availability set yet"
  ) +
  "\n\nPlease respond naturally to the user's message. Use availability data only when relevant."
}}
```

### 2.3 Replace Database Nodes with API Calls

**A. Replace "Get User from DB" node:**
- Change to HTTP Request node
- URL: `https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/user/by-email/{{ $json.userEmail }}`
- Method: GET

**B. Replace "Get User Availability" node:**
- Change to HTTP Request node  
- URL: `https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/{{ $json.userEmail }}`
- Method: GET

**C. Add Clear Availability Operation node:**
- HTTP Request node
- URL: `https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/{{ $json.userEmail }}`
- Method: DELETE
- Trigger when user message contains "clear" or "reset"

### 2.4 Update User Data Processing

**Replace existing user processing with:**
```javascript
// Extract and structure user data for API service
const message = $input.all()[0].json.message;

const userData = {
    telegramId: message.from.id,
    firstName: message.from.first_name,
    username: message.from.username || null,
    chatId: message.chat.id,
    messageText: message.text,
    messageDate: message.date
};

console.log('[n8n] Extracted user data:', userData);

// Determine user type and email based on Telegram ID
let userType = 'unknown';
let userEmail = null;

if (userData.telegramId === 1195143765) {
    userType = 'Ivan';
    userEmail = 'ivanaguilarmari@gmail.com';
} else {
    // Add Youssef's ID when known
    userType = 'guest';
}

return [{
    userData: userData,
    userType: userType,
    userEmail: userEmail,
    timestamp: new Date().toISOString()
}];
```

### 2.5 Test the Updated Workflow

1. **Save the updated workflow**
2. **Send test message to bot**: "This is a test message"
3. **Expected result**: Single response that addresses the actual message
4. **Test clear operation**: "Clear my availability"

## STEP 3: Option B - Deploy Standalone Bot (Alternative)

### 3.1 Setup Bot Environment

**Create package.json:**
```json
{
  "name": "gymbuddy-telegram-bot",
  "version": "1.0.0",
  "description": "GymBuddy Telegram Bot with API integration",
  "main": "telegramBot.js",
  "scripts": {
    "start": "node telegramBot.js",
    "dev": "BOT_DEBUG_MODE=true node telegramBot.js"
  },
  "dependencies": {
    "node-telegram-bot-api": "^0.64.0",
    "node-fetch": "^2.7.0"
  },
  "engines": {
    "node": ">=14.0.0"
  }
}
```

### 3.2 Deploy to Heroku

```bash
# Create new Heroku app for standalone bot
heroku create gymbuddy-bot-api

# Set environment variables
heroku config:set GYMBUDDY_API_URL=https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com -a gymbuddy-bot-api
heroku config:set TELEGRAM_BOT_TOKEN=8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ -a gymbuddy-bot-api
heroku config:set BOT_DEBUG_MODE=true -a gymbuddy-bot-api

# Deploy files
cp bot-integration/telegramBot.js ./
cp bot-integration/apiService.js ./
git add .
git commit -m "Deploy standalone GymBuddy bot with API integration"
git push heroku main
```

### 3.3 Set Bot Webhook (if needed)

```bash
# If using webhooks instead of polling
curl -X POST "https://api.telegram.org/bot8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ/setWebhook" \
  -d "url=https://gymbuddy-bot-api.herokuapp.com/webhook"
```

## STEP 4: Validation and Testing

### 4.1 Critical Tests to Run

**Test 1: Single Response Fix**
```bash
# Send test message that previously caused 3 responses
# Expected: Only 1 response that addresses the actual message
```

**Test 2: Bot-Website Sync**
```bash
# 1. Open website availability page: https://your-website.github.io/availability
# 2. Send bot command: "Clear my availability"  
# 3. Expected: Website immediately shows toast notification and clears calendar
```

**Test 3: API Operations**
```bash
# Test all bot operations work through API
curl -X DELETE "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com"
# Should clear availability and sync with website
```

### 4.2 Monitoring and Logs

**n8n Workflow Logs:**
```bash
heroku logs --tail -a gymbuddy-n8n
```

**API Server Logs:**
```bash
heroku logs --tail -a gymbuddy-api
```

**Bot Logs (if standalone):**
```bash
heroku logs --tail -a gymbuddy-bot-api
```

## STEP 5: Production Deployment

### 5.1 Environment Variables

**Required for n8n:**
- `GYMBUDDY_API_URL=https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com`
- `ANTHROPIC_API_KEY=your_claude_api_key`
- `TELEGRAM_BOT_TOKEN=8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ`

**Set in Heroku:**
```bash
heroku config:set GYMBUDDY_API_URL=https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com -a gymbuddy-n8n
heroku config:set BOT_DEBUG_MODE=false -a gymbuddy-n8n
```

### 5.2 Switch to Production Mode

1. **Turn off debug logging**: Set `BOT_DEBUG_MODE=false`
2. **Enable error monitoring**: Monitor bot error rates
3. **Set up health checks**: Regular bot functionality tests

## STEP 6: User Communication

### 6.1 Test with Real Users

1. **Inform Ivan**: "The bot has been updated with better sync and no more duplicate messages"
2. **Test all operations**: availability checking, clearing, scheduling
3. **Verify real-time sync**: Website and bot stay in perfect sync

### 6.2 Expected Improvements

**Before (Issues):**
- ❌ Bot sends 3 duplicate messages
- ❌ Bot ignores user's actual message
- ❌ Bot operations don't sync with website

**After (Fixed):**
- ✅ Bot sends exactly 1 relevant response
- ✅ Bot responds to user's actual message content
- ✅ All bot operations sync with website in real-time
- ✅ Proper error handling and helpful messages
- ✅ Better logging for troubleshooting

## Troubleshooting Common Issues

### Issue 1: Bot Still Sends Multiple Messages

**Cause**: n8n node still using `.item` instead of `.first()`
**Fix**: Double-check Claude AI node message parameter uses `.first()`

### Issue 2: User Not Found Errors

**Cause**: telegram_id not set in database
**Fix**: Run database setup script and verify mapping

### Issue 3: Bot Operations Don't Sync with Website

**Cause**: API server not properly connected to Supabase
**Fix**: Verify API server environment variables and test endpoints

### Issue 4: API Timeout Errors

**Cause**: Heroku app sleeping or network issues
**Fix**: Add health check pings or upgrade Heroku plan

## Success Metrics

**Deployment is successful when:**
- ✅ Bot responds with exactly 1 message per user input
- ✅ Bot addresses user's actual message content
- ✅ Bot clear operation immediately reflects on website
- ✅ Website availability changes are visible to bot
- ✅ Error messages are helpful and user-friendly
- ✅ No more user complaints about duplicate messages

## Rollback Plan

If issues occur:

1. **n8n Option**: Revert to previous workflow version in n8n
2. **Standalone Option**: Scale down bot dyno and switch back to n8n
3. **Database**: No rollback needed (changes are additive and safe)

## Support and Monitoring

**Key Metrics to Monitor:**
- Bot response time
- API success/error rates  
- User complaint frequency
- Sync operation success rate

**Regular Health Checks:**
- Daily bot functionality test
- Weekly sync verification
- Monitor logs for errors

This deployment plan ensures a smooth transition to the new API-integrated bot with improved functionality and perfect website synchronization.