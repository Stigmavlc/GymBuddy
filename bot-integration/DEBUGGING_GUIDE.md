# GymBuddy Telegram Bot Debugging Guide

This guide will help you identify and fix issues with the GymBuddy Telegram bot when it's not accessing real-time data properly or routing intents incorrectly.

## Quick Diagnostic Steps

### Step 1: Enable Debug Mode
```bash
# Set environment variable
export BOT_DEBUG_MODE=true

# Start the bot
node telegramBot.js
```

### Step 2: Run Comprehensive Diagnostics
```bash
# Run the comprehensive test script
node debug_comprehensive_test.js
```

This will test:
- API connectivity
- User ID mapping
- Availability data access  
- Intent routing accuracy
- Data sync consistency
- Real-time data freshness

### Step 3: Test Specific Features

#### Test Intent Detection
Send this message to your bot:
```
/debug intent What's my availability?
```

This should show:
- **Detected Intent:** availability_query  
- **Confidence:** high
- **Routing:** → Direct Processing (Availability Query)

#### Test Data Access
Send this message to your bot:
```
/debug sync
```

This will run a full sync verification test.

#### Test API Connectivity
Send this message to your bot:
```
/debug api
```

This tests all API endpoints and response times.

## Common Issues and Solutions

### Issue 1: Bot Says "No availability data found" but user has availability

**Symptoms:**
- User has set availability on website
- Bot returns "You don't have any availability set yet"

**Debugging Steps:**
1. Check user mapping in `apiService.js`:
   ```javascript
   this.userMapping = {
       '1195143765': 'ivanaguilarmari@gmail.com',  // Ivan
       // Add your Telegram ID here
       'YOUR_TELEGRAM_ID': 'your.email@domain.com'
   };
   ```

2. Test with: `/debug sync`
3. Look for these log entries:
   ```
   [API OPERATION] GET_AVAILABILITY_START
   [API Service DEBUG] 📋 Availability request for: your.email@domain.com
   [API Service DEBUG] 📊 API Response Analysis
   ```

**Solution:** Add your Telegram ID to the user mapping.

### Issue 2: Availability queries go to Claude AI instead of direct processing

**Symptoms:**
- Messages like "What's my availability?" get generic responses
- Debug shows intent routing to `general_chat` instead of `availability_query`

**Debugging Steps:**
1. Test intent detection: `/debug intent What's my availability?`
2. Check debug logs for:
   ```
   [INTENT WARNING] Message "What's my availability?" fell back to general_chat
   ```

**Solution:** The intent detection has been enhanced. Common phrases that should work:
- "What's my availability"
- "Show my availability"  
- "Check my availability"
- "My schedule"
- "When am I available"

### Issue 3: API connectivity issues

**Symptoms:**
- Bot returns "API request failed" errors
- Timeout errors in logs

**Debugging Steps:**
1. Test API connectivity: `/debug api`
2. Check logs for:
   ```
   [API Service ERROR] Request failed: timeout
   [API Service ERROR] URL: https://gymbuddy-api-ivan-...
   ```

**Solution:** 
- Check if API server is running
- Verify `GYMBUDDY_API_URL` environment variable
- Default: `https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com`

### Issue 4: Data inconsistency between requests

**Symptoms:**
- Sometimes bot shows availability, sometimes it doesn't
- Data seems to change randomly

**Debugging Steps:**
1. Run data integrity check: `/debug data`
2. Check for caching issues in logs

**Solution:**
- Check database connection stability
- Look for race conditions in data access
- Verify API server health

## Debug Commands Reference

| Command | Description | Usage |
|---------|-------------|-------|
| `/debug` | Show conversation flow stats | Basic bot statistics |
| `/debug sync` | Run sync diagnostics | Test all data sync operations |
| `/debug data` | Run data integrity check | Validate data structure and consistency |
| `/debug intent <message>` | Test intent detection | `/debug intent What's my schedule?` |
| `/debug api` | Test API connectivity | Check all API endpoints |
| `/debug help` | Show debug help menu | List all available debug commands |

## Log Analysis

### Good Logs (Everything Working)
```
✅ [API SUCCESS] GET /availability/by-email/user@domain.com completed in 150ms
✅ INTENT DETECTED: availability_query
[ROUTING] Intent: availability_query (confidence: high)
[ROUTING] → Direct processing: Availability Query
✅ [AVAILABILITY SUCCESS] Found 3 slots for User Name
```

### Problem Logs (Issues Found)
```
❌ API request failed: 500 Internal Server Error
⚠️ INTENT FALLBACK: general_chat
[INTENT WARNING] Message "What's my availability?" fell back to general_chat
❌ [Bot Error] No email mapping found for Telegram ID: 12345
```

## Environment Variables

Make sure these are set:
```bash
BOT_DEBUG_MODE=true              # Enable detailed logging
TELEGRAM_BOT_TOKEN=your_token    # Bot token from BotFather
GYMBUDDY_API_URL=your_api_url    # API server URL (optional)
ANTHROPIC_API_KEY=your_key       # Claude API key (optional)
```

## Testing Checklist

Before deploying, test these scenarios:

- [ ] "What's my availability?" → Shows availability data
- [ ] "Set me available Monday 9am" → Updates availability  
- [ ] "Clear my availability" → Clears all availability
- [ ] "Cancel my session" → Shows session cancellation options
- [ ] User has no availability → Shows helpful message
- [ ] API is down → Shows appropriate error message
- [ ] Invalid Telegram ID → Shows registration message

## Get Help

If you're still having issues after following this guide:

1. Run: `node debug_comprehensive_test.js`
2. Check the generated diagnostic report JSON file
3. Look at the recommendations section
4. Enable debug mode and check the real-time logs
5. Test individual components using the `/debug` commands

The comprehensive logging system will help you identify exactly where the data flow breaks down.