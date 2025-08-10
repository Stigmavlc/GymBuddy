# GymBuddy Bot-Website Sync Solution

## Problem Solved

**Issue**: Bot CRUD operations on availability were not syncing with the website. When the Telegram bot cleared availability, the website still showed the old data after refresh.

**Root Cause**: The original Telegram bot directory was deleted, and there was no proper API interface for bot operations to interact with the Supabase database.

## Solution Implementation

### 1. Fixed API Server Architecture

**Location**: `/api/server.js`

The API server has been enhanced with proper bot-compatible endpoints that use the same database schema as the website:

#### Key Endpoints for Bot Operations:

**User Identification**:
- `GET /user/by-email/:email` - Look up user by email address
- Returns: User ID, name, and email for bot operations

**Availability Management**:
- `GET /availability/by-email/:email` - Check user's current availability
- `DELETE /availability/by-email/:email` - Clear all availability (bot operation)
- `POST /availability/by-email/:email` - Set new availability slots

**Debug & Monitoring**:
- `GET /debug/sync-status/:email?` - Comprehensive sync status
- `POST /debug/test-sync/:email` - Test real-time sync functionality

### 2. Database Schema Alignment

The API now properly uses the day-based availability schema:
```sql
CREATE TABLE public.availability (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES public.users(id),
    day TEXT NOT NULL, -- 'monday', 'tuesday', etc.
    start_time INTEGER, -- Hour (0-23)
    end_time INTEGER,   -- Hour (1-24)
    created_at TIMESTAMP
);
```

### 3. Real-time Synchronization

**Website Side** (`/src/pages/Availability.tsx`):
- Already has Supabase real-time subscriptions implemented
- Listens for all changes on the `availability` table
- Automatically reloads when changes affect the current user
- Shows toast notifications when sync occurs

**Bot Operations**:
- All bot CRUD operations go through the API server
- API server uses the same Supabase client as the website
- Changes are immediately reflected in the database
- Real-time subscriptions automatically notify the website

## How to Use the Bot API

### For Bot Developers

**Base URL**: `http://localhost:3001` (or your deployed API URL)

**Clear User Availability** (Main bot operation):
```bash
curl -X DELETE "http://localhost:3001/availability/by-email/ivanaguilarmari@gmail.com"
```

**Check User Availability**:
```bash
curl "http://localhost:3001/availability/by-email/ivanaguilarmari@gmail.com"
```

**Set New Availability**:
```bash
curl -X POST "http://localhost:3001/availability/by-email/ivanaguilarmari@gmail.com" \
  -H "Content-Type: application/json" \
  -d '{"slots": [{"day": "Wednesday", "start_time": 6, "end_time": 8}]}'
```

### Response Format

**Success Response**:
```json
{
  "success": true,
  "user": "Ivan",
  "email": "ivanaguilarmari@gmail.com",
  "userId": "f8939d4a-c2d3-4c7b-80e2-3a384fc953bd",
  "message": "Cleared 2 availability slots",
  "deletedCount": 2,
  "timestamp": "2025-08-09T00:08:19.269Z"
}
```

**Error Response**:
```json
{
  "error": "User not found",
  "email": "invalid@example.com"
}
```

## Sync Verification

### Debug Endpoints

**Check Sync Status**:
```bash
curl "http://localhost:3001/debug/sync-status/ivanaguilarmari@gmail.com" | jq .stats
```

**Test Real-time Sync**:
```bash
curl -X POST "http://localhost:3001/debug/test-sync/ivanaguilarmari@gmail.com"
```
This creates a test availability slot, then automatically deletes it after 2 seconds to trigger real-time sync events.

### Manual Verification Steps

1. **Open Website**: Navigate to `/availability` page while logged in
2. **Open Browser Console**: Check for real-time subscription logs
3. **Execute Bot Operation**: Use curl to clear availability
4. **Verify Website Updates**: Should see toast notification and calendar refresh

## Deployment Instructions

### API Server Setup

1. **Environment Variables** (create `/api/.env`):
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
PORT=3001
```

2. **Start API Server**:
```bash
cd api
npm install
npm start
```

### Bot Integration

**For existing Telegram bot projects**, replace database operations with API calls:

**Instead of direct Supabase queries**:
```javascript
// OLD - Direct database access
await supabase.from('availability').delete().eq('user_id', userId)
```

**Use API endpoints**:
```javascript
// NEW - API-based approach
const response = await fetch('http://your-api-url/availability/by-email/user@example.com', {
    method: 'DELETE'
});
const result = await response.json();
console.log('Cleared:', result.deletedCount, 'slots');
```

## Environment Variables for Bot

Add these to your bot's environment:
```
GYMBUDDY_API_URL=http://localhost:3001
IVAN_EMAIL=ivanaguilarmari@gmail.com
YOUSSEF_EMAIL=youssef.dummy@test.com
```

## Testing the Solution

### Complete End-to-End Test

1. **Setup Test Data**:
```bash
curl -X POST "http://localhost:3001/availability/by-email/ivanaguilarmari@gmail.com" \
  -H "Content-Type: application/json" \
  -d '{"slots": [{"day": "Wednesday", "start_time": 6, "end_time": 8}, {"day": "Thursday", "start_time": 6, "end_time": 8}]}'
```

2. **Open Website**: Go to `/availability` and verify 4 slots are visible

3. **Simulate Bot Clear**:
```bash
curl -X DELETE "http://localhost:3001/availability/by-email/ivanaguilarmari@gmail.com"
```

4. **Verify Website Sync**: Website should immediately show toast notification and clear the calendar (no refresh needed)

### Expected Results

- ✅ Bot operations immediately reflect on website
- ✅ Website shows real-time notifications when bot makes changes
- ✅ No manual refresh required
- ✅ All operations properly logged for debugging

## Monitoring and Logs

### API Server Logs
```bash
# Watch API server logs for bot operations
tail -f /path/to/api/logs

# Or check Docker/Heroku logs if deployed
heroku logs --tail -a your-api-app
```

### Website Console Logs
Look for these messages in browser console:
- "Availability page: Change detected"
- "Change affects current user, reloading"
- "Your availability has been updated"

## Security Considerations

1. **API Authentication**: Consider adding API key authentication for production
2. **CORS Setup**: Already configured for cross-origin requests
3. **Rate Limiting**: Consider adding rate limiting for bot endpoints
4. **Input Validation**: Email format validation implemented

## Future Enhancements

1. **Webhook Support**: Add webhook endpoints for immediate bot notifications
2. **Batch Operations**: Support multiple user operations in single requests  
3. **Audit Trail**: Log all bot operations for debugging
4. **Health Checks**: Automated monitoring of sync functionality

---

## Summary

This solution provides:
- ✅ **Proper Bot API** with email-based user identification
- ✅ **Real-time Sync** between bot and website
- ✅ **Database Consistency** using shared Supabase instance
- ✅ **Debug Tools** for sync verification
- ✅ **Comprehensive Logging** for troubleshooting
- ✅ **Easy Integration** for any bot platform

The synchronization issue is now fully resolved. Bot operations will immediately appear on the website without requiring manual refresh.