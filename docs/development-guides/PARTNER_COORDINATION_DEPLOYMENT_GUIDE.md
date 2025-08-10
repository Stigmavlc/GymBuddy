# GymBuddy Partner Coordination System - Deployment Guide

## Overview

This guide provides step-by-step instructions to deploy the comprehensive partner coordination system for GymBuddy, which includes:

1. **Partner Pairing**: Link Ivan and Youssef as gym partners
2. **Availability Overlap Detection**: Find common workout times between partners  
3. **Session Suggestions**: Suggest 2 optimal sessions (non-consecutive days, 2h duration)
4. **Dual Notifications**: Message both partners simultaneously
5. **Mutual Agreement**: Handle back-and-forth negotiation until both agree

## Architecture Overview

### Database Layer
- **New Tables**: `partner_requests`, `session_proposals`, `notifications`, `coordination_states`
- **Enhanced Tables**: Added fields to `sessions` table for proposal tracking
- **Security**: Comprehensive RLS policies for partner data access

### API Layer
- **Enhanced Endpoints**: Improved availability overlap detection
- **New Endpoints**: Partner management, session proposals, dual notifications
- **Algorithms**: 2-session suggestion algorithm with non-consecutive day logic

### Bot Layer
- **Enhanced Bot**: Automatic coordination triggering, inline keyboards, mutual agreement workflow
- **New Features**: Partner coordination detection, dual messaging, negotiation handling

## Prerequisites

- Existing GymBuddy installation with Supabase database
- API server deployed and running
- Telegram bot configured
- Environment variables properly set

## Deployment Steps

### Step 1: Database Schema Updates

1. **Apply Partner Coordination Schema**
   ```bash
   # Connect to your Supabase project
   # Run the partner coordination schema
   psql -h your-supabase-host -U postgres -d postgres -f supabase/partner_coordination_schema.sql
   ```

2. **Apply RLS Policies**
   ```bash
   # Apply the partner coordination RLS policies
   psql -h your-supabase-host -U postgres -d postgres -f supabase/partner_coordination_rls_policies.sql
   ```

3. **Verify Schema Installation**
   ```sql
   -- Check that new tables exist
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states');

   -- Check RLS policies
   SELECT schemaname, tablename, policyname 
   FROM pg_policies 
   WHERE schemaname = 'public' 
   AND tablename IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states')
   ORDER BY tablename, policyname;
   ```

### Step 2: API Server Updates

1. **Deploy Enhanced API Files**
   ```bash
   # Copy the new partner coordination API module
   cp api/partner_coordination_endpoints.js /path/to/your/api/

   # Update the main server.js with enhanced version
   cp api/server.js /path/to/your/api/server.js
   ```

2. **Install Dependencies** (if needed)
   ```bash
   cd /path/to/your/api/
   npm install  # Ensure all dependencies are installed
   ```

3. **Test API Endpoints**
   ```bash
   # Restart your API server
   pm2 restart gym-buddy-api  # or your process manager

   # Test health endpoint to verify new endpoints are listed
   curl https://your-api-domain.com/
   ```

### Step 3: Bot Integration

1. **Deploy Enhanced Bot Files**
   ```bash
   # Copy the partner coordination bot module
   cp bot-integration/partner_coordination_bot.js /path/to/your/bot/

   # Update the main Telegram bot with enhanced version
   cp bot-integration/telegramBot.js /path/to/your/bot/
   ```

2. **Set Required Environment Variables**
   ```bash
   # Add to your .env file or environment
   export IVAN_TELEGRAM_ID="your-ivan-telegram-id"
   export YOUSSEF_TELEGRAM_ID="youssef-telegram-id"  # Get this from Youssef
   
   # Ensure existing variables are set
   export TELEGRAM_BOT_TOKEN="your-bot-token"
   export ANTHROPIC_API_KEY="your-claude-api-key"
   export SUPABASE_URL="your-supabase-url"
   export SUPABASE_SERVICE_KEY="your-service-key"
   ```

3. **Restart Bot Service**
   ```bash
   # Restart the bot
   pm2 restart gym-buddy-bot  # or your process manager
   ```

### Step 4: Partner Linking Setup

1. **Create Partner Relationship**

   Option A - Via API:
   ```bash
   # Send partner request from Ivan to Youssef
   curl -X POST https://your-api-domain.com/partners/request \
   -H "Content-Type: application/json" \
   -d '{
     "requesterEmail": "ivanaguilarmari@gmail.com",
     "targetEmail": "youssef.email@gmail.com",
     "message": "Let'\''s coordinate our gym sessions!"
   }'

   # Accept the request (you'll need the request ID from above response)
   curl -X PUT https://your-api-domain.com/partners/requests/REQUEST_ID/respond \
   -H "Content-Type: application/json" \
   -d '{
     "userEmail": "youssef.email@gmail.com",
     "response": "accepted",
     "message": "Let'\''s do this!"
   }'
   ```

   Option B - Direct Database:
   ```sql
   -- Get user IDs
   SELECT id, name, email FROM users WHERE email IN ('ivanaguilarmari@gmail.com', 'youssef.email@gmail.com');

   -- Link partners (replace with actual UUIDs)
   UPDATE users SET partner_id = 'youssef-uuid' WHERE email = 'ivanaguilarmari@gmail.com';
   UPDATE users SET partner_id = 'ivan-uuid' WHERE email = 'youssef.email@gmail.com';

   -- Create coordination state
   INSERT INTO coordination_states (partner_1_id, partner_2_id, state) 
   VALUES ('ivan-uuid', 'youssef-uuid', 'waiting_availability');
   ```

### Step 5: Testing the System

1. **Test Availability Overlap Detection**
   ```bash
   # Test common availability endpoint
   curl "https://your-api-domain.com/availability/common/ivanaguilarmari@gmail.com/youssef.email@gmail.com"

   # Test session suggestions
   curl "https://your-api-domain.com/sessions/suggestions/ivanaguilarmari@gmail.com/youssef.email@gmail.com"
   ```

2. **Test Bot Coordination Workflow**
   - Send availability updates from both Ivan and Youssef via Telegram
   - Verify automatic coordination trigger
   - Test inline keyboard responses
   - Test mutual agreement workflow

3. **Test Manual Coordination**
   ```bash
   # Send messages to bot like:
   # "Let's coordinate our workouts"
   # "When can we gym together?"
   # "Schedule a session with my partner"
   ```

## Configuration Options

### Environment Variables

```bash
# Core Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_service_role_key
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
ANTHROPIC_API_KEY=your_claude_api_key

# User Mapping
IVAN_TELEGRAM_ID=ivan_telegram_user_id
YOUSSEF_TELEGRAM_ID=youssef_telegram_user_id

# Bot Configuration
BOT_DEBUG_MODE=true  # Enable for detailed logging
API_BASE_URL=https://your-api-domain.com

# Database Configuration (if using custom connection)
DB_HOST=your_db_host
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name
```

### API Configuration

The API automatically includes these new endpoints:

- `GET /availability/common/:email1/:email2` - Find overlapping availability
- `GET /sessions/suggestions/:email1/:email2` - Generate session suggestions
- `POST /partners/request` - Send partner invitation
- `PUT /partners/requests/:id/respond` - Respond to partner request
- `POST /sessions/propose` - Create session proposal
- `PUT /sessions/proposals/:id/respond` - Respond to proposal
- `GET /sessions/proposals/pending/:email` - Get pending proposals

### Bot Configuration

The bot now includes:

- Automatic coordination triggering when both partners have availability
- Inline keyboard for session selection
- Partner coordination intent detection
- Dual messaging capabilities
- Mutual agreement workflow

## Monitoring and Maintenance

### Logging

1. **API Logs**
   ```bash
   # View API logs
   tail -f /path/to/api/logs/app.log

   # Check for partner coordination activity
   grep "PartnerCoordination" /path/to/api/logs/app.log
   ```

2. **Bot Logs**
   ```bash
   # View bot logs
   tail -f /path/to/bot/logs/bot.log

   # Check coordination workflow
   grep "PartnerBot" /path/to/bot/logs/bot.log
   ```

### Database Monitoring

```sql
-- Check partner relationships
SELECT 
  u1.name as user_name,
  u1.email as user_email,
  u2.name as partner_name,
  u2.email as partner_email
FROM users u1 
LEFT JOIN users u2 ON u1.partner_id = u2.id
WHERE u1.partner_id IS NOT NULL;

-- Check coordination states
SELECT 
  cs.*,
  u1.name as partner_1_name,
  u2.name as partner_2_name
FROM coordination_states cs
JOIN users u1 ON cs.partner_1_id = u1.id
JOIN users u2 ON cs.partner_2_id = u2.id;

-- Check active proposals
SELECT 
  sp.*,
  proposer.name as proposer_name,
  partner.name as partner_name
FROM session_proposals sp
JOIN users proposer ON sp.proposer_id = proposer.id
JOIN users partner ON sp.partner_id = partner.id
WHERE sp.status = 'pending';
```

### Cleanup Tasks

```sql
-- Clean up expired proposals (run periodically)
DELETE FROM session_proposals 
WHERE status = 'pending' AND expires_at < NOW();

-- Clean up old notifications (optional)
DELETE FROM notifications 
WHERE created_at < NOW() - INTERVAL '30 days';
```

## Troubleshooting

### Common Issues

1. **Bot Not Triggering Coordination**
   - Verify both users have partner relationship: `SELECT * FROM users WHERE partner_id IS NOT NULL;`
   - Check coordination state exists: `SELECT * FROM coordination_states;`
   - Ensure both users have availability: `SELECT user_id, COUNT(*) FROM availability GROUP BY user_id;`

2. **API Endpoints Not Working**
   - Check server logs for errors
   - Verify database connections
   - Test individual endpoints with curl

3. **RLS Policy Issues**
   - Verify service role policies exist
   - Check policy conditions don't create circular references
   - Test with both service and anon keys

4. **Partner Requests Failing**
   - Check user emails are correct
   - Verify users exist in database
   - Check for existing partner relationships

### Debug Commands

```bash
# Test API health
curl https://your-api-domain.com/

# Test user lookup
curl https://your-api-domain.com/user/by-email/ivanaguilarmari@gmail.com

# Test availability
curl https://your-api-domain.com/availability/by-email/ivanaguilarmari@gmail.com

# Test debug endpoint
curl https://your-api-domain.com/debug/sync-status/ivanaguilarmari@gmail.com
```

### Bot Debug Commands

In Telegram, use these commands:
- `/debug` - Show conversation flow statistics
- `/status` - Check sync status
- `/test` - Test API connectivity
- `/availability` - Check your availability

## Security Considerations

1. **RLS Policies**: Ensure all new tables have proper RLS policies
2. **Service Role**: Use service role key for bot operations only
3. **User Mapping**: Secure the Telegram ID to email mapping
4. **API Access**: Ensure API is only accessible from authorized sources
5. **Notification Privacy**: Users only see their own notifications

## Performance Optimization

1. **Database Indexes**: All necessary indexes are created by the schema
2. **API Caching**: Consider caching common availability lookups
3. **Bot Rate Limiting**: Telegram enforces rate limits automatically
4. **Cleanup Jobs**: Run cleanup tasks for old proposals and notifications

## Next Steps

1. **Expand User Base**: Update user mapping system for more users
2. **Enhanced Suggestions**: Improve session suggestion algorithm based on user feedback  
3. **Calendar Integration**: Add calendar invites to confirmed sessions
4. **Mobile Notifications**: Integrate push notifications
5. **Analytics**: Add coordination success metrics

## Support

For issues with this deployment:

1. Check logs first (API and Bot)
2. Verify environment variables
3. Test individual components
4. Check database state
5. Review RLS policies

Remember to backup your database before applying schema changes!