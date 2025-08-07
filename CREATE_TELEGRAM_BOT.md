# 🤖 Create GymBuddy Telegram Bot

## Step 1: Create Bot with @BotFather

1. Open Telegram and search for **@BotFather**
2. Start a chat and type: `/newbot`
3. **Bot Name**: `GymBuddy Coordinator`
4. **Bot Username**: Something like `gymbuddy_coordinator_bot` or `gymbuddy_ivan_bot`
5. Copy the **Bot Token** that @BotFather gives you (keep this secret!)

## Step 2: Customize Your Bot

Send these commands to @BotFather:

```
/setdescription
```
Then select your bot and set description:
```
AI-powered gym scheduling coordinator. Message me to coordinate gym sessions with your workout partner!
```

```
/setabouttext
```
Then set about text:
```
GymBuddy helps coordinate gym schedules between workout partners using AI assistance.
```

```
/setuserpic
```
Upload a profile picture for your bot (you can use the GymBuddy logo)

## Step 3: Save Your Bot Details

Write down:
- **Bot Token**: (the long string from @BotFather)
- **Bot Username**: @your_bot_username
- **Bot Name**: GymBuddy Coordinator

## Step 4: Test Your Bot

1. Search for your bot in Telegram
2. Start a chat with it
3. It won't respond yet (we need to deploy the code first)
4. But you should see the name, description, and profile picture

## Next Steps

Once you've created the bot, I'll deploy the Node.js application to Heroku that will:
- Receive messages sent to your bot
- Forward them to n8n → Claude
- Send Claude's responses back to users

**Important**: Keep your bot token secret - this is like a password for your bot!