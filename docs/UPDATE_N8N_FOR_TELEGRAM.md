# 🔄 Update n8n Workflow for Telegram Integration

## Overview

This guide helps you replace the WhatsApp workflow with the new Telegram workflow in your existing n8n instance.

## Prerequisites

- ✅ n8n running on Heroku: https://gymbuddy-n8n-a666114e1339.herokuapp.com/
- ✅ Telegram bot deployed and working
- ✅ Credentials: admin / gymbuddy123

## Step 1: Access n8n Dashboard

1. Go to: https://gymbuddy-n8n-a666114e1339.herokuapp.com/
2. Login with: admin / gymbuddy123

## Step 2: Import New Telegram Workflow

1. Click **"Workflows"** in the sidebar
2. Click **"Import from file"**
3. Upload: `N8N_WORKFLOW_TELEGRAM.json`
4. The new workflow will be imported

## Step 3: Configure Environment Variables

In n8n, go to **Settings** → **Environment variables** and add:

```
TELEGRAM_BOT_URL=https://your-telegram-bot.herokuapp.com
IVAN_TELEGRAM_CHAT_ID=your_ivan_chat_id
YOUSSEF_TELEGRAM_CHAT_ID=youssef_chat_id
```

### How to Get Chat IDs

After your Telegram bot is deployed:

1. **Ivan sends `/start` to the bot**
2. **Check Heroku logs**: `heroku logs --tail -a gymbuddy-telegram-bot`
3. **Copy Ivan's chat ID** from the logs
4. **Repeat for Youssef**

Alternative method - use this API call:
```bash
curl https://your-telegram-bot.herokuapp.com/
```
This shows active users and their chat IDs.

## Step 4: Activate New Workflow

1. **Open the Telegram workflow**
2. **Click the "Active" toggle** (top right)
3. **Deactivate the old WhatsApp workflow** (if still active)

## Step 5: Test the Integration

### Test Message Processing
1. Send a message to your Telegram bot: "I'm available Monday and Tuesday"
2. Check n8n **Executions** tab for successful runs
3. Verify Claude AI responses are sent back to Telegram

### Test Cross-User Notifications
1. Have Ivan send a scheduling message
2. Verify Youssef receives a notification
3. Test vice versa

## Step 6: Update Webhook URL (if needed)

If your Telegram bot URL changed, update the webhook URL in your GymBuddy app:

In your `.env` file:
```
VITE_N8N_WEBHOOK_URL=https://gymbuddy-n8n-a666114e1339.herokuapp.com/webhook/gymbuddy
```

## Workflow Overview

The new Telegram workflow:

```
Telegram Bot → n8n Webhook → Process Data → Claude AI → Send Response
                    ↓
               Cross-Notify Other User
```

### Key Features

- ✅ **Handles Telegram message format**
- ✅ **Processes user identification** (Ivan vs Youssef)
- ✅ **Claude AI coordination** with gym-specific prompts
- ✅ **Cross-user notifications** (Ivan's messages notify Youssef)
- ✅ **Formatted responses** with emojis and HTML
- ✅ **Error handling and logging**

## Troubleshooting

### Workflow not triggering
- Check webhook URL in Telegram bot matches n8n
- Verify n8n workflow is "Active"
- Check n8n **Executions** for errors

### Claude AI not responding
- Verify Claude API credentials in n8n
- Check if Claude node is properly configured
- Look for API rate limit errors

### Messages not sending to Telegram
- Verify `TELEGRAM_BOT_URL` environment variable
- Check Telegram bot Heroku logs
- Ensure chat IDs are correct

### Cross-notifications not working
- Verify `IVAN_TELEGRAM_CHAT_ID` and `YOUSSEF_TELEGRAM_CHAT_ID`
- Check if both users have started the bot (`/start`)

## Environment Variables Summary

```bash
# In n8n Settings → Environment Variables
TELEGRAM_BOT_URL=https://gymbuddy-telegram-bot.herokuapp.com
IVAN_TELEGRAM_CHAT_ID=123456789
YOUSSEF_TELEGRAM_CHAT_ID=987654321

# Claude API should already be configured in n8n
```

## Success Indicators

✅ New workflow shows "Active"  
✅ Test messages trigger workflow execution  
✅ Claude AI responds appropriately  
✅ Cross-user notifications work  
✅ No errors in n8n Executions log  

## Cleanup

Once everything is working:
1. **Delete old WhatsApp workflow** from n8n
2. **Remove old environment variables** (Evolution API related)
3. **Update documentation** to reflect Telegram integration

Your n8n is now fully integrated with Telegram! 🎉