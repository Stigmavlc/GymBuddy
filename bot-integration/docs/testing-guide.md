# GymBuddy Bot-API Integration Testing Guide

This guide provides a comprehensive testing strategy to verify that the bot integration works correctly and maintains synchronization with the website.

## Testing Environment Setup

### Prerequisites

1. **API Server Running**
   ```bash
   # Test API server is accessible
   curl https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/
   # Should return: {"status": "GymBuddy API is running! 💪", ...}
   ```

2. **Database Schema Updated**
   ```bash
   # Run the database setup script first
   # Execute bot-integration/database-sync-setup.sql in Supabase
   ```

3. **Environment Variables Set**
   ```bash
   export GYMBUDDY_API_URL=https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com
   export TELEGRAM_BOT_TOKEN=8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ
   export BOT_DEBUG_MODE=true
   ```

## Test Categories

### 1. API Service Integration Tests

#### Test 1.1: User Identification Mapping
```bash
# Test Telegram ID to email mapping
node -e "
const APIService = require('./bot-integration/apiService');
const api = new APIService();

// Test Ivan's mapping
const email = api.getTelegramUserEmail('1195143765');
console.log('Ivan Telegram ID → Email:', email);

// Test unknown user
const unknownEmail = api.getTelegramUserEmail('999999999');
console.log('Unknown Telegram ID → Email:', unknownEmail);
"
```

**Expected Results:**
- Ivan's Telegram ID should map to `ivanaguilarmari@gmail.com`
- Unknown ID should return `null`

#### Test 1.2: API Health Check
```bash
# Test API connectivity
node -e "
const APIService = require('./bot-integration/apiService');
const api = new APIService();

api.healthCheck().then(result => {
  console.log('Health Check Result:', JSON.stringify(result, null, 2));
});
"
```

**Expected Results:**
- `success: true`
- API status and version information
- Available endpoints list

#### Test 1.3: User Lookup by Telegram ID
```bash
# Test user lookup functionality
node -e "
const APIService = require('./bot-integration/apiService');
const api = new APIService();

api.getUserByTelegramId('1195143765').then(user => {
  console.log('User Lookup Result:', JSON.stringify(user, null, 2));
});
"
```

**Expected Results:**
- User object with `id`, `name`, `email`, `telegram_id`
- Ivan's user information should be returned

### 2. Availability Management Tests

#### Test 2.1: Get Current Availability
```bash
# Test availability retrieval
curl "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com" \
  -H "Content-Type: application/json"
```

**Expected Results:**
- JSON response with user info and availability slots
- Empty slots array if no availability set

#### Test 2.2: Clear Availability (Main Bot Operation)
```bash
# Test the primary bot operation
curl -X DELETE "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com" \
  -H "Content-Type: application/json"
```

**Expected Results:**
- Success response with deletion count
- User information included
- Real-time sync should trigger on website

#### Test 2.3: Set Availability
```bash
# Test setting new availability
curl -X POST "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com" \
  -H "Content-Type: application/json" \
  -d '{
    "slots": [
      {"day": "monday", "start_time": 6, "end_time": 8},
      {"day": "wednesday", "start_time": 18, "end_time": 20}
    ]
  }'
```

**Expected Results:**
- Success response with created slots
- Website should show new availability immediately

### 3. Real-time Sync Verification

#### Test 3.1: Bot-to-Website Sync
```bash
# Step 1: Open website availability page in browser
# Step 2: Execute bot clear operation
curl -X DELETE "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com"

# Step 3: Verify website updates automatically (no refresh needed)
```

**Expected Results:**
- Website shows toast notification: "Your availability has been updated"
- Calendar clears immediately without page refresh
- Browser console shows real-time subscription logs

#### Test 3.2: Website-to-Bot Sync
```bash
# Step 1: Set availability on website
# Step 2: Check via bot API
curl "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com"
```

**Expected Results:**
- Bot API returns the same availability set on website
- Data matches exactly (days, times, user info)

### 4. n8n Workflow Tests (if using n8n)

#### Test 4.1: Webhook Trigger
```bash
# Send test message to n8n webhook
curl -X POST "https://gymbuddy-n8n-a666114e1339.herokuapp.com/webhook/gymbuddy" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "from": {"id": 1195143765, "first_name": "Ivan"},
      "text": "Test message for bot",
      "chat": {"id": 1195143765}
    }
  }'
```

**Expected Results:**
- Single response (not multiple)
- Response addresses the test message content
- No duplicate processing

#### Test 4.2: Fix Duplicate Message Issue
```bash
# Send message that previously caused 3 responses
curl -X POST "https://gymbuddy-n8n-a666114e1339.herokuapp.com/webhook/gymbuddy" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "from": {"id": 1195143765, "first_name": "Ivan"},
      "text": "this is just a test message",
      "chat": {"id": 1195143765}
    }
  }'
```

**Expected Results:**
- Only ONE response sent to Telegram
- Response relates to the actual test message
- No availability data mentioned unless relevant

### 5. Standalone Bot Tests (if using Node.js bot)

#### Test 5.1: Bot Initialization
```bash
# Start the standalone bot
cd bot-integration
node telegramBot.js
```

**Expected Results:**
- Bot starts without errors
- API health check passes
- Telegram polling begins successfully

#### Test 5.2: Command Tests
Send these messages to the bot via Telegram:

1. `/start` - Should show welcome message and check user registration
2. `/help` - Should show all available commands
3. `/availability` - Should show current availability (if any)
4. `/clear` - Should clear availability and confirm
5. `/status` - Should show system status and user info
6. `/test` - Should run sync test

**Expected Results:**
- All commands respond appropriately
- Operations sync with website in real-time
- Error messages are user-friendly

### 6. Error Handling Tests

#### Test 6.1: Invalid User
```bash
# Test with unknown Telegram ID
node -e "
const APIService = require('./bot-integration/apiService');
const api = new APIService();

api.getUserByTelegramId('999999999').then(result => {
  console.log('Unknown User Result:', result);
});
"
```

**Expected Results:**
- Returns `null` gracefully
- No errors thrown
- Appropriate logging

#### Test 6.2: API Server Down
```bash
# Test with invalid API URL
GYMBUDDY_API_URL=https://invalid-url.com node -e "
const APIService = require('./bot-integration/apiService');
const api = new APIService();

api.healthCheck().then(result => {
  console.log('Offline API Result:', result);
});
"
```

**Expected Results:**
- Returns `{success: false, error: "..."}` 
- Doesn't crash the application
- Error message is helpful

### 7. Integration Test Script

#### Complete End-to-End Test
```bash
# Create comprehensive test script
cat > test-bot-integration.sh << 'EOF'
#!/bin/bash

echo "🧪 Starting GymBuddy Bot Integration Tests..."

# Test 1: API Health Check
echo "1. Testing API connectivity..."
curl -s https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/ | jq .status

# Test 2: Clear Availability
echo "2. Testing bot clear operation..."
CLEAR_RESULT=$(curl -s -X DELETE "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com")
echo $CLEAR_RESULT | jq .message

# Test 3: Set Test Availability
echo "3. Setting test availability..."
SET_RESULT=$(curl -s -X POST "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com" \
  -H "Content-Type: application/json" \
  -d '{"slots": [{"day": "monday", "start_time": 6, "end_time": 8}]}')
echo $SET_RESULT | jq .message

# Test 4: Verify Set Availability
echo "4. Verifying availability was set..."
GET_RESULT=$(curl -s "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com")
echo $GET_RESULT | jq .totalSlots

# Test 5: Test Sync
echo "5. Testing real-time sync..."
SYNC_RESULT=$(curl -s -X POST "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/debug/test-sync/ivanaguilarmari@gmail.com")
echo $SYNC_RESULT | jq .message

# Test 6: Final Clear
echo "6. Final cleanup..."
FINAL_CLEAR=$(curl -s -X DELETE "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com")
echo $FINAL_CLEAR | jq .message

echo "✅ Bot Integration Tests Complete!"
EOF

chmod +x test-bot-integration.sh
./test-bot-integration.sh
```

## Test Results Documentation

### Success Criteria
- ✅ All API endpoints respond correctly
- ✅ User identification mapping works
- ✅ Bot operations sync with website in real-time
- ✅ No duplicate messages from bot
- ✅ Error handling is graceful and informative
- ✅ Bot responds to user's actual messages
- ✅ Website real-time subscriptions trigger on bot changes

### Common Issues to Check

1. **Multiple Responses**: Ensure n8n uses `.first()` instead of `.item`
2. **User Not Found**: Verify telegram_id is set in database
3. **API Timeout**: Check network connectivity and API server status
4. **Sync Not Working**: Verify Supabase real-time subscriptions are active
5. **RLS Errors**: Ensure service role policies are correctly configured

### Debugging Commands

```bash
# Check API server logs
heroku logs --tail -a gymbuddy-api

# Check n8n workflow logs
heroku logs --tail -a gymbuddy-n8n

# Test specific API endpoint
curl -v https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/debug/sync-status

# Check database state
# Run in Supabase SQL Editor:
SELECT * FROM users WHERE telegram_id IS NOT NULL;
SELECT COUNT(*) FROM availability;
```

## Performance Tests

### Load Testing
```bash
# Test multiple concurrent requests
for i in {1..10}; do
  curl -X DELETE "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com" &
done
wait
```

### Response Time Tests
```bash
# Measure API response times
time curl "https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com"
```

## Automated Testing

For continuous integration, create automated tests that:

1. Run all API endpoint tests
2. Verify bot operations work correctly
3. Check real-time sync functionality
4. Test error handling scenarios
5. Validate response formats and data integrity

This comprehensive testing approach ensures the bot integration works reliably and maintains perfect synchronization with the website.