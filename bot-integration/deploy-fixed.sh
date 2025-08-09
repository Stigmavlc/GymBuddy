#!/bin/bash

echo "🔧 GymBuddy Bot Deployment - Final Fix"
echo "====================================="

APP_NAME="gymbuddy-telegram-bot"

# Check if we're in the right directory
if [ ! -f "telegramBot.js" ]; then
    echo "❌ Error: telegramBot.js not found. Please run from bot-integration directory"
    exit 1
fi

echo "🧹 Cleaning up any existing git setup..."
rm -rf .git 2>/dev/null

echo "🔧 Setting up fresh git repository..."
git init
git add .
git commit -m "Deploy updated GymBuddy bot with API integration"

echo "📱 Adding Heroku remote..."
heroku git:remote -a $APP_NAME

echo "🚀 Deploying to Heroku..."
git push heroku master --force

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 SUCCESS! Bot deployed successfully!"
    echo ""
    echo "⏱️  Waiting for bot to start (10 seconds)..."
    sleep 10
    
    echo "📱 Testing bot status..."
    heroku ps --app $APP_NAME
    
    echo ""
    echo "📊 Recent logs:"
    heroku logs --tail --num 15 --app $APP_NAME
    
    echo ""
    echo "✅ Deployment complete! Test your bot:"
    echo "   1. Message @GymBuddyAppBot with: /start"
    echo "   2. Should get 1 response (not 3 duplicates)"
    echo "   3. Try: 'clear my availability' and check website"
    echo ""
else
    echo ""
    echo "❌ Deployment failed. Checking status..."
    heroku logs --tail --num 20 --app $APP_NAME
fi