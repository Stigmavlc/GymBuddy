# 🚀 Deploy Telegram Bot to Heroku - Step by Step

## Step 2: Deploy Telegram Bot to Heroku

### What You Need Before Starting
- ✅ Telegram bot token from @BotFather (you completed this!)
- ✅ Heroku account (you already have this)
- ✅ The telegram-bot folder is ready in your project

### 2.1: Navigate to Your Telegram Bot Folder

**Open Terminal/Command Prompt and type:**
```bash
cd "/Users/ivanaguilar/Desktop/Web Development  Projects/Completed By Me/GymBuddy/telegram-bot"
```

**Verify you're in the right place:**
```bash
ls
```
You should see: `server.js`, `package.json`, `Procfile`

### 2.2: Create New Heroku App

**In the same terminal, run:**
```bash
heroku create gymbuddy-telegram-bot
```

This creates a new Heroku app called `gymbuddy-telegram-bot`.

### 2.3: Set Environment Variables

**Replace YOUR_BOT_TOKEN with the token from @BotFather:**
```bash
heroku config:set TELEGRAM_BOT_TOKEN=YOUR_BOT_TOKEN -a gymbuddy-telegram-bot
```

**Set the n8n webhook URL (this should already exist):**
```bash
heroku config:set N8N_WEBHOOK_URL=https://gymbuddy-n8n-a666114e1339.herokuapp.com/webhook/gymbuddy -a gymbuddy-telegram-bot
```

**Set a secret API key for your bot:**
```bash
heroku config:set API_KEY=gymbuddy-secret-key-12345 -a gymbuddy-telegram-bot
```

### 2.4: Initialize Git and Deploy

**Initialize git in the telegram-bot folder:**
```bash
git init
git add .
git commit -m "Initial Telegram bot commit"
```

**Connect to Heroku and deploy:**
```bash
heroku git:remote -a gymbuddy-telegram-bot
git push heroku main
```

### 2.5: Verify Deployment

**Check if your bot is running:**
```bash
heroku logs --tail -a gymbuddy-telegram-bot
```

You should see: "✅ Telegram bot server running on port XXXX"

**Test the bot URL in your browser:**
- Go to: `https://gymbuddy-telegram-bot.herokuapp.com/`
- You should see: `{"status": "Telegram bot is running", "webhook": "configured"}`

---

## Step 3: Test the Complete Workflow

### 3.1: Update GymBuddy App Configuration

**Edit your `.env` file in the main GymBuddy folder:**
```bash
cd "/Users/ivanaguilar/Desktop/Web Development  Projects/Completed By Me/GymBuddy"
```

**Open `.env` file and add/update these lines:**
```
VITE_TELEGRAM_BOT_URL=https://gymbuddy-telegram-bot.herokuapp.com
VITE_TELEGRAM_BOT_USERNAME=@your_bot_username
VITE_TELEGRAM_API_KEY=gymbuddy-secret-key-12345
VITE_N8N_WEBHOOK_URL=https://gymbuddy-n8n-a666114e1339.herokuapp.com/webhook/gymbuddy
```

**Replace `@your_bot_username` with the actual username from @BotFather.**

### 3.2: Get Your Chat IDs

**Send a message to your bot:**
1. Open Telegram
2. Search for your bot username (from @BotFather)
3. Send: `/start`
4. Send: "Hello bot!"

**Check Heroku logs to find your chat ID:**
```bash
heroku logs --tail -a gymbuddy-telegram-bot
```

Look for lines like:
```
Chat ID: 123456789, User: Ivan Aguilar
```

**Save your chat ID - you'll need it for n8n configuration.**

### 3.3: Update n8n Workflow

**Go to your n8n dashboard:**
- URL: https://gymbuddy-n8n-a666114e1339.herokuapp.com/
- Login: admin / gymbuddy123

**Import the new Telegram workflow:**
1. Click "Workflows" in sidebar
2. Click "Import from file" 
3. Upload: `/Users/ivanaguilar/Desktop/Web Development  Projects/Completed By Me/GymBuddy/docs/N8N_WORKFLOW_TELEGRAM.json`

**Configure environment variables in n8n:**
1. Go to "Settings" → "Environment variables"
2. Add these variables:
   ```
   TELEGRAM_BOT_URL=https://gymbuddy-telegram-bot.herokuapp.com
   IVAN_TELEGRAM_CHAT_ID=your_chat_id_from_logs
   YOUSSEF_TELEGRAM_CHAT_ID=will_get_this_when_youssef_starts_bot
   ```

**Activate the workflow:**
1. Open the "GymBuddy Telegram Coordinator" workflow
2. Click the "Active" toggle (top right)
3. Should show "Active" with green dot

### 3.4: Test Basic Bot Functionality

**Test 1: Bot Response Test**
1. Start your GymBuddy app: `npm run dev`
2. Go to Dashboard
3. Click "Test Telegram Bot" button
4. Should show: "✅ Telegram bot is working!"

**Test 2: Message Processing**
1. Send message to your bot: "I'm available Monday morning"
2. Check n8n "Executions" tab for new workflow runs
3. Check Heroku logs: `heroku logs --tail -a gymbuddy-telegram-bot`

**Test 3: Availability Notification**
1. In GymBuddy Dashboard, click "📅 Test Availability Notification"
2. Should either:
   - Send Telegram message if configured properly
   - Open Telegram chat as fallback

### 3.5: Full Integration Test (When Youssef Joins)

**When Youssef starts using the bot:**
1. Have Youssef send `/start` to the bot
2. Get his chat ID from Heroku logs
3. Update n8n environment variables with his chat ID
4. Test cross-user notifications

---

## Troubleshooting Guide

### Problem: "heroku: command not found"
**Solution:** Install Heroku CLI
- Go to: https://devcenter.heroku.com/articles/heroku-cli
- Download and install for Mac
- Restart terminal

### Problem: Bot not responding to messages
1. Check Heroku logs: `heroku logs --tail -a gymbuddy-telegram-bot`
2. Verify bot token is correct: `heroku config -a gymbuddy-telegram-bot`
3. Check if bot URL works: https://gymbuddy-telegram-bot.herokuapp.com/

### Problem: n8n workflow not triggered
1. Check webhook URL matches in bot
2. Verify n8n workflow is "Active"
3. Check n8n "Executions" for errors

### Problem: Environment variables not working
1. Check .env file exists in main GymBuddy folder
2. Restart development server: `npm run dev`
3. Check browser console for configuration

---

## What Should Work After Setup

✅ **Bot responds to messages**  
✅ **n8n workflow processes messages**  
✅ **GymBuddy app can test bot connection**  
✅ **Availability notifications work**  
✅ **Cross-user coordination ready**  

---

## Important URLs to Save

- **Telegram Bot:** https://gymbuddy-telegram-bot.herokuapp.com/
- **n8n Dashboard:** https://gymbuddy-n8n-a666114e1339.herokuapp.com/
- **Bot Username:** @your_bot_username (from @BotFather)

## Next Steps After Everything Works

1. Get Youssef to start the bot (`/start`)
2. Update his chat ID in n8n
3. Test full coordination workflow
4. Use the app for real gym scheduling! 💪

Let me know if you get stuck on any step - I'll help debug! 🤖