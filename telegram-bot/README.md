# 🤖 GymBuddy Telegram Bot

AI-powered gym scheduling coordinator that actually works! No QR codes, no database headaches, just a simple Telegram bot.

## Features

- ✅ **Official Telegram Bot API** - Reliable and well-supported
- ✅ **No Database Required** - Stateless and simple
- ✅ **Separate from Personal Account** - Professional bot identity
- ✅ **Claude AI Integration** - Smart scheduling coordination via n8n
- ✅ **Free to Run** - Works on Heroku free tier
- ✅ **Easy Setup** - No phone scanning or complex authentication

## How It Works

```
You/Youssef → Telegram Bot → n8n Webhook → Claude AI → n8n → Telegram Bot → Users
```

1. **Users message the bot** about gym scheduling
2. **Bot forwards to n8n** which processes with Claude AI
3. **Claude coordinates** the schedule and responds
4. **Bot sends responses** back to all relevant users

## Quick Start

### 1. Create Bot
Follow `../CREATE_TELEGRAM_BOT.md` to create your bot with @BotFather

### 2. Deploy
Follow `DEPLOY_TO_HEROKU.md` to deploy to Heroku

### 3. Test
- Send `/start` to your bot in Telegram
- Send a message like "I'm available Monday and Wednesday"
- Check that it forwards to n8n and Claude responds

## Bot Commands

- `/start` - Initialize bot and get welcome message
- `/help` - Show help and usage instructions
- `/status` - Check bot status and active users

## API Endpoints

- `GET /` - Health check
- `POST /send-message` - Send message to specific user
- `POST /broadcast` - Send message to all users
- `POST /webhook` - Telegram webhook (internal)

## Environment Variables

```bash
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
N8N_WEBHOOK_URL=https://gymbuddy-n8n-a666114e1339.herokuapp.com/webhook/gymbuddy
NODE_ENV=production
WEBHOOK_URL=https://your-heroku-app.herokuapp.com
```

## Development

```bash
npm install
cp .env.example .env  # Add your bot token
npm run dev
```

## Production

Deploy to Heroku using the deployment guide. The bot automatically switches to webhook mode in production for better performance.

## Benefits Over WhatsApp

- 🚫 **No QR Code Scanning** - Just create bot and deploy
- 🚫 **No Database Issues** - Completely stateless
- 🚫 **No Personal Account Conflicts** - Separate bot identity
- 🚫 **No Port Configuration** - Standard HTTP webhooks
- ✅ **Official API Support** - Telegram actively maintains bot API
- ✅ **Better Developer Experience** - Clear documentation and examples

## Integration with GymBuddy

The bot integrates seamlessly with your existing:
- n8n workflow (just update webhook handling)
- Claude AI coordination logic
- GymBuddy app (update to show Telegram instead of WhatsApp)

This is the solution that will actually work reliably! 🎉