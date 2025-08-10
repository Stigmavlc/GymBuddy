# Real-time Partner Coordination API - Complete Guide

This guide covers the enhanced GymBuddy API with real-time partner coordination, session negotiation, and instant synchronization capabilities.

## 🚀 Overview

The enhanced API provides:
- **Partner Discovery & Invitations** - Find and invite partners by email or Telegram ID
- **Real-time Synchronization** - Instant updates via Server-Sent Events (SSE)
- **Session Negotiation** - Comprehensive proposal and counter-proposal system
- **Dual Notifications** - Simultaneous updates to website and Telegram bot
- **Availability Coordination** - Smart session suggestion algorithms

## 📋 Prerequisites

1. **Database Schema**: Partner coordination tables must be deployed
2. **Environment Variables**: Supabase credentials configured
3. **Dependencies**: All npm packages installed

## 🛠️ Installation & Setup

### 1. Install Dependencies

```bash
cd /Users/ivanaguilar/Desktop/Web Development  Projects/Completed By Me/GymBuddy/api
npm install
```

### 2. Environment Configuration

Ensure your `.env` file contains:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
PORT=3001
```

### 3. Database Setup

Ensure the partner coordination schema is deployed:

```bash
# Run the partner coordination schema in Supabase SQL Editor
cat ../supabase/partner_coordination_schema.sql
```

### 4. Start the Server

```bash
npm start
# or
node server.js
```

The server will start with real-time synchronization enabled:
```
🏋️ GymBuddy API running on port 3001
📡 Real-time synchronization service active
🔗 SSE endpoint: http://localhost:3001/realtime/connect/:userEmail
📊 Real-time status: http://localhost:3001/realtime/status
🤝 Partner coordination: http://localhost:3001/partners/find/:identifier
📅 Session proposals: http://localhost:3001/sessions/propose
```

## 🔧 API Endpoints

### Partner Discovery & Management

#### Find Partner by Email or Telegram ID
```http
GET /partners/find/:identifier
```
- `identifier`: Email address or Telegram ID
- Returns user details and partnership status

#### Get Partner Relationship Status
```http
GET /partners/status/:email
```
- Returns current partner, pending requests, and coordination state

#### Send Partner Request
```http
POST /partners/request
Content-Type: application/json

{
  "requesterIdentifier": "ivan@example.com",
  "targetIdentifier": "partner@example.com", 
  "message": "Let's be gym partners!"
}
```

#### Respond to Partner Request
```http
PUT /partners/requests/:requestId/respond
Content-Type: application/json

{
  "userEmail": "partner@example.com",
  "response": "accepted", // or "rejected"
  "message": "Yes, let's do this!"
}
```

#### Get Partner Requests for User
```http
GET /partners/requests/:email
```

### Session Coordination

#### Get Session Suggestions
```http
GET /sessions/suggestions/:email1/:email2
```
- Returns optimal session suggestions based on overlapping availability

#### Create Session Proposal
```http
POST /sessions/propose
Content-Type: application/json

{
  "proposerEmail": "ivan@example.com",
  "proposedDate": "2024-12-15",
  "startTime": 20,    // 10:00 AM (half-hour slots)
  "endTime": 24,      // 12:00 PM
  "message": "How about Monday morning?"
}
```

#### Respond to Session Proposal
```http
PUT /sessions/proposals/:proposalId/respond
Content-Type: application/json

{
  "userEmail": "partner@example.com",
  "response": "accepted", // "rejected" or "counter_proposed"
  "message": "Perfect timing!"
}
```

#### Counter-Propose
```http
POST /sessions/proposals/:proposalId/counter
Content-Type: application/json

{
  "userEmail": "partner@example.com",
  "counterDate": "2024-12-16", 
  "counterStartTime": 22,
  "counterEndTime": 26,
  "message": "How about Tuesday instead?"
}
```

#### Get All Proposals for User
```http
GET /sessions/proposals/:email?status=pending&limit=20
```

#### Cancel Proposal
```http
DELETE /sessions/proposals/:proposalId
Content-Type: application/json

{
  "userEmail": "proposer@example.com"
}
```

### Real-time Synchronization

#### Connect to Real-time Updates
```javascript
const eventSource = new EventSource('http://localhost:3001/realtime/connect/ivan@example.com');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Real-time update:', data.type, data);
  
  // Handle different event types
  switch(data.type) {
    case 'partner_request_update':
      // Partner request received/responded to
      break;
    case 'session_proposal_update': 
      // Session proposal created/responded to
      break;
    case 'session_update':
      // Session confirmed/cancelled
      break;
    case 'availability_update':
      // Partner availability changed
      break;
  }
};
```

#### Get Real-time Service Status
```http
GET /realtime/status
```

### Notifications

#### Get User Notifications
```http
GET /notifications/:email?unreadOnly=true&limit=20
```

#### Mark Notification as Read
```http
PUT /notifications/:notificationId/read
Content-Type: application/json

{
  "userEmail": "user@example.com"
}
```

## 🔄 Real-time Event Types

The system automatically sends these real-time events:

### Partner Request Events
```javascript
{
  "type": "partner_request_update",
  "event": "INSERT|UPDATE|DELETE", 
  "request": { /* partner request data */ },
  "requester": { /* user data */ },
  "requestedUser": { /* user data */ }
}
```

### Session Proposal Events
```javascript
{
  "type": "session_proposal_update",
  "event": "INSERT|UPDATE|DELETE",
  "proposal": { /* proposal data */ },
  "proposer": { /* user data */ },
  "partner": { /* user data */ }
}
```

### Session Events
```javascript
{
  "type": "session_update", 
  "event": "INSERT|UPDATE|DELETE",
  "session": { /* session data */ },
  "participants": [ /* user data */ ]
}
```

### Availability Events
```javascript
{
  "type": "availability_update",
  "event": "INSERT|UPDATE|DELETE",
  "user": { /* user data */ },
  "partner": { /* partner data */ }
}
```

## 🤖 Telegram Bot Integration

### Bot-Ready Endpoints

The API is designed to work seamlessly with your Telegram bot:

1. **User Identification**: Find users by Telegram ID
2. **Instant Notifications**: Real-time events can trigger bot messages
3. **Status Updates**: Bot can query partner and proposal status
4. **Action Handling**: Bot can send requests and responses

### Example Bot Integration

```javascript
// In your Telegram bot
async function handlePartnerRequest(telegramUserId, targetEmail) {
  const response = await fetch(`${API_URL}/partners/request`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requesterIdentifier: telegramUserId, // Telegram ID
      targetIdentifier: targetEmail,       // Email
      message: 'Sent via Telegram bot'
    })
  });
  
  // Real-time notifications will be sent automatically
  return response.json();
}
```

## 🧪 Testing

### Run Comprehensive Tests

```bash
node test_realtime_coordination.js
```

This tests:
- API health and real-time service status
- Partner discovery by email and Telegram ID
- Session suggestions and proposals
- Notification delivery
- Real-time event handling

### Manual Testing

1. **Start the API server**
2. **Open SSE connection** in browser dev tools:
   ```javascript
   const eventSource = new EventSource('http://localhost:3001/realtime/connect/your-email@example.com');
   eventSource.onmessage = (e) => console.log(JSON.parse(e.data));
   ```
3. **Trigger events** via API calls and watch real-time updates

## 🚀 Deployment Considerations

### Production Setup

1. **Environment Variables**: Set production Supabase credentials
2. **CORS Configuration**: Update allowed origins for your domain
3. **SSL/TLS**: Use HTTPS for SSE connections in production
4. **Connection Limits**: Monitor SSE connection count
5. **Database Indexes**: Ensure proper indexing for performance

### Scaling

- **Horizontal Scaling**: Multiple API instances can run simultaneously
- **Connection Management**: SSE connections are managed per instance
- **Database Connection Pooling**: Use connection pooling for high loads
- **Caching**: Consider Redis for session state if needed

### Monitoring

Key metrics to monitor:
- Active SSE connections (`GET /realtime/status`)
- Database query performance
- Real-time event delivery latency
- Partner coordination success rates

## 🛠️ Troubleshooting

### Common Issues

1. **SSE Connection Fails**
   - Check CORS headers
   - Verify user email format
   - Check network/firewall settings

2. **Real-time Events Not Received**
   - Verify Supabase realtime is enabled
   - Check database triggers are active
   - Ensure proper row-level security policies

3. **Partner Requests Fail**
   - Verify both users exist in database
   - Check for existing partnership
   - Validate email/Telegram ID format

4. **Session Proposals Fail**
   - Ensure users are partners
   - Validate time slot format (0-47)
   - Check minimum duration (2 hours = 4 slots)

### Debug Endpoints

- `GET /debug/sync-status/:email` - Database sync status
- `GET /realtime/status` - Real-time service health
- `POST /debug/test-sync/:email` - Trigger test events

## 📞 Support

For issues with the real-time coordination system:

1. Check the console logs for detailed error messages
2. Use the test suite to identify specific failures
3. Verify database schema is properly deployed
4. Ensure all environment variables are set correctly

---

## 🎯 Summary

The enhanced GymBuddy API now provides:

✅ **Complete partner coordination** - Discovery, invitations, acceptance
✅ **Real-time synchronization** - Instant updates via SSE
✅ **Session negotiation** - Proposals, counter-proposals, acceptance
✅ **Dual notifications** - Website + Telegram bot integration
✅ **Smart matching** - Availability-based session suggestions
✅ **Production-ready** - Proper error handling and monitoring

The system is designed to handle the complete partner coordination workflow with real-time updates ensuring both partners stay synchronized across all platforms.