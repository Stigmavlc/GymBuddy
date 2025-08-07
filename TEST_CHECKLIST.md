# GymBuddy Testing Checklist

Use this checklist to verify everything is working after deployment.

## Pre-Testing Setup ✅

### 1. Services Deployed
- [ ] Evolution API is running (check URL in browser)
- [ ] n8n is running (check URL in browser)
- [ ] Both services show green/healthy status

### 2. Environment Variables
- [ ] Created `.env` file from `.env.example`
- [ ] Added Supabase URL and anon key
- [ ] Added Evolution API key
- [ ] URLs match your deployed services

### 3. WhatsApp Connected
- [ ] Evolution API instance created ("gymbuddy-coordinator")
- [ ] QR code scanned with WhatsApp
- [ ] Instance shows "Connected" status

### 4. n8n Workflow
- [ ] Workflow imported from `/docs/N8N_WORKFLOW.json`
- [ ] Workflow is "Active" (toggle on)
- [ ] Webhook URL updated in Evolution API

## Testing Steps 🧪

### Step 1: Basic App Test
```bash
npm run dev
```
- [ ] App starts without errors
- [ ] Can access http://localhost:5173
- [ ] Login page appears

### Step 2: User Authentication
- [ ] Login as Ivan (ivanaguilarmari@gmail.com)
- [ ] Profile shows correct name
- [ ] Can access availability calendar

### Step 3: Database Test
Go to: http://localhost:5173/diagnostic
- [ ] Shows "Connected to Supabase"
- [ ] Lists both users (Ivan + Youssef)
- [ ] Shows availability for both users

### Step 4: WhatsApp Logic Test
Go to: http://localhost:5173/test-whatsapp
- [ ] Shows "Both users found"
- [ ] Displays common availability slots
- [ ] Shows WhatsApp message preview

### Step 5: Mock WhatsApp Test
Go to: http://localhost:5173/mock-whatsapp
- [ ] Can set availability for both users
- [ ] "Send WhatsApp" button appears
- [ ] Shows formatted message with times

### Step 6: Real WhatsApp Test
1. Set availability in main app
2. Check Evolution API logs
- [ ] Message sent successfully
- [ ] Phone receives WhatsApp message
- [ ] Message has correct format and times

### Step 7: AI Conversation Test
Reply to WhatsApp message:
- [ ] n8n receives the reply
- [ ] Claude AI responds
- [ ] Can confirm/modify sessions
- [ ] Session saved in database

### Step 8: Calendar Test
After confirming session:
- [ ] Google Calendar event created (if connected)
- [ ] .ics file downloadable
- [ ] Both users notified

## Common Issues & Fixes 🔧

### "503 Service Unavailable"
- Service not deployed yet
- Check deployment logs
- Verify service is running

### "401 Unauthorized"
- Wrong API key in .env
- Check Evolution API dashboard for correct key

### "No users found"
- RLS policies blocking access
- Run SQL commands from FIX_RLS_ISSUES.md

### WhatsApp Not Receiving
- Phone number format (must be +44...)
- Evolution API not connected
- Check instance status

### n8n Not Triggering
- Workflow not active
- Webhook URL mismatch
- Check n8n execution logs

## Success Criteria ✨

When everything works, you should be able to:

1. **Ivan** sets availability (Mon/Wed/Fri, 6-8 PM)
2. **Youssef** sets availability (Mon/Wed/Thu, 5-9 PM)
3. **WhatsApp** message sent to Ivan's phone
4. **Message** shows: "Monday 6-8 PM, Wednesday 6-8 PM"
5. **Reply** "Yes, Monday works better"
6. **AI** confirms Monday session
7. **Calendar** event created for both users
8. **App** shows upcoming session

## Final Production Checklist 🚀

Before going live:
- [ ] Remove test pages from router
- [ ] Update environment variables for production
- [ ] Enable proper authentication for all users
- [ ] Test with real gym partner
- [ ] Monitor logs for first week

Congratulations! Your GymBuddy app is ready! 🎉