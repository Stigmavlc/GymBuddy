#!/bin/bash

echo "🔧 GymBuddy Bot Deployment Fix"
echo "=============================="

APP_NAME="gymbuddy-telegram-bot"
API_URL="https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com"

# Check if we're in the right directory
if [ ! -f "telegramBot.js" ]; then
    echo "❌ Error: telegramBot.js not found. Please run from bot-integration directory"
    exit 1
fi

echo "📋 Setting up Heroku remote..."
heroku git:remote -a $APP_NAME

echo "🔧 Preparing git repository..."
git init
git add .
git commit -m "Deploy updated bot with API integration"

echo "🚀 Deploying to Heroku (using master branch)..."
git push heroku master --force

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 SUCCESS! Bot deployed successfully!"
    echo ""
    echo "📱 Testing bot deployment..."
    sleep 5
    
    # Test bot health
    heroku logs --tail --num 10 --app $APP_NAME &
    LOG_PID=$!
    sleep 3
    kill $LOG_PID 2>/dev/null
    
    echo ""
    echo "✅ Bot is deployed! Test your bot now:"
    echo "   1. Message @GymBuddyAppBot with: /start"
    echo "   2. You should get 1 response (not 3)"
    echo "   3. Try clearing availability and check website sync"
    echo ""
    echo "📊 Monitor with: heroku logs --tail --app $APP_NAME"
else
    echo ""
    echo "❌ Deployment failed. Check the error messages above."
    echo "💡 Try running: heroku logs --app $APP_NAME"
fi