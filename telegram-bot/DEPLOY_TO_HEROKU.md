# 🚀 Deploy GymBuddy Telegram Bot to Heroku

## Prerequisites
1. ✅ Created Telegram bot with @BotFather (see `../CREATE_TELEGRAM_BOT.md`)
2. ✅ Have your bot token ready
3. ✅ Heroku CLI installed and logged in

## Step 1: Initialize Git Repository

```bash
cd telegram-bot
git init
git add .
git commit -m "Initial GymBuddy Telegram bot"
```

## Step 2: Create Heroku App

```bash
heroku create gymbuddy-telegram-bot
```

If name is taken, try:
```bash
heroku create gymbuddy-telegram-coordinator
# or
heroku create your-unique-name-here
```

## Step 3: Set Environment Variables

Replace `YOUR_BOT_TOKEN` with the actual token from @BotFather:

```bash
heroku config:set TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN
heroku config:set N8N_WEBHOOK_URL=https://gymbuddy-n8n-a666114e1339.herokuapp.com/webhook/gymbuddy
heroku config:set NODE_ENV=production
heroku config:set API_KEY=gymbuddy-secret-key-12345
```

After deployment, set the webhook URL:
```bash
heroku config:set WEBHOOK_URL=https://your-app-name.herokuapp.com
```

## Step 4: Deploy to Heroku

```bash
git push heroku master
```

Or if using main branch:
```bash
git push heroku main
```

## Step 5: Check Status

```bash
heroku logs --tail
heroku open
```

## Step 6: Test Your Bot

1. Open Telegram and search for your bot
2. Send `/start` to begin
3. Send a test message about gym scheduling
4. Check Heroku logs to see if messages are being processed

## API Endpoints

Your deployed bot will have these endpoints:

- `GET /` - Health check and status
- `POST /webhook` - Telegram webhook (for receiving messages)
- `POST /send-message` - Send messages via bot (for n8n responses)
- `POST /broadcast` - Send message to all users

## Testing

Test the send-message endpoint:
```bash
curl -X POST https://your-app-name.herokuapp.com/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "chat_id": "YOUR_TELEGRAM_CHAT_ID",
    "message": "🤖 Hello from GymBuddy! Telegram integration is working!"
  }'
```

## Troubleshooting

### Bot not responding
- Check `heroku logs --tail`
- Verify `TELEGRAM_BOT_TOKEN` is correct
- Make sure bot is not in polling mode (should use webhooks in production)

### Webhook not working
- Ensure `WEBHOOK_URL` is set correctly
- Check if n8n is receiving messages
- Verify SSL certificate is valid

### Common Issues

1. **Bot token invalid**: Double-check token from @BotFather
2. **Webhook not set**: Make sure `WEBHOOK_URL` environment variable is correct
3. **n8n not receiving**: Check n8n webhook URL is accessible

## Success Indicators

✅ `heroku logs` shows "Bot server running"  
✅ `/start` command works in Telegram  
✅ Messages are forwarded to n8n  
✅ No errors in Heroku logs  

## Next Steps

Once deployed:
1. Update n8n workflow to handle Telegram messages
2. Update GymBuddy app to use Telegram bot
3. Test complete workflow end-to-end