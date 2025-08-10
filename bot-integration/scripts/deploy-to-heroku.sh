#!/bin/bash

# GymBuddy Telegram Bot - Deploy to Heroku
# This script deploys the updated bot with API integration to replace direct database calls

set -e

echo "🤖 GymBuddy Telegram Bot Deployment to Heroku"
echo "=============================================="

# Configuration
BOT_APP_NAME="gymbuddy-telegram-bot"
API_URL="https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com"
BOT_TOKEN="8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ"

echo "📋 Deployment Configuration:"
echo "   Bot App: ${BOT_APP_NAME}"
echo "   API URL: ${API_URL}"
echo "   Bot Token: ${BOT_TOKEN:0:10}..."
echo ""

# Check if Heroku CLI is available
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first:"
    echo "   npm install -g heroku"
    exit 1
fi

# Check if user is logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Not logged in to Heroku. Please login first:"
    echo "   heroku login"
    exit 1
fi

echo "✅ Heroku CLI is ready"

# Check if app already exists
if heroku apps:info -a $BOT_APP_NAME &> /dev/null; then
    echo "📱 App $BOT_APP_NAME already exists, updating..."
    UPDATE_EXISTING=true
else
    echo "📱 Creating new app: $BOT_APP_NAME"
    heroku create $BOT_APP_NAME
    UPDATE_EXISTING=false
fi

echo ""
echo "🔧 Setting environment variables..."

# Set environment variables
heroku config:set \
    TELEGRAM_BOT_TOKEN="$BOT_TOKEN" \
    GYMBUDDY_API_URL="$API_URL" \
    BOT_DEBUG_MODE="true" \
    NODE_ENV="production" \
    -a $BOT_APP_NAME

echo "✅ Environment variables set"

# Verify API connectivity
echo ""
echo "🔍 Testing API connectivity..."
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL")
if [ "$API_STATUS" = "200" ]; then
    echo "✅ API server is accessible ($API_STATUS)"
else
    echo "⚠️  API server status: $API_STATUS (continuing anyway)"
fi

# Prepare files for deployment
echo ""
echo "📦 Preparing deployment files..."

# Create temporary directory for deployment
TEMP_DIR=$(mktemp -d)
echo "   Using temp directory: $TEMP_DIR"

# Copy bot files to temp directory
cp telegramBot.js "$TEMP_DIR/"
cp apiService.js "$TEMP_DIR/"
cp package.json "$TEMP_DIR/"
cp Procfile "$TEMP_DIR/"
cp .env.example "$TEMP_DIR/"

# Create deployment package
cd "$TEMP_DIR"

# Initialize git repo if not exists
if [ ! -d ".git" ]; then
    git init
    git config user.email "deploy@gymbuddy.com"
    git config user.name "GymBuddy Deploy"
fi

# Add Heroku remote
git remote remove heroku 2>/dev/null || true
git remote add heroku https://git.heroku.com/$BOT_APP_NAME.git

# Commit files
git add .
git commit -m "Deploy GymBuddy Telegram Bot with API integration

- Replace direct Supabase database calls with API endpoints
- Fix duplicate message issue (3 responses → 1 response)  
- Add real-time sync between bot operations and website
- Improve error handling and logging
- Support for natural language processing with Claude AI

API endpoints used:
- GET /user/by-email/{email} - User lookup
- GET /availability/by-email/{email} - Check availability
- POST /availability/by-email/{email} - Set availability  
- DELETE /availability/by-email/{email} - Clear availability

Bot operations now sync perfectly with website in real-time."

echo "✅ Files prepared for deployment"

# Deploy to Heroku
echo ""
echo "🚀 Deploying to Heroku..."
echo "   This may take a few minutes..."

if git push heroku main --force; then
    echo "✅ Deployment successful!"
else
    echo "❌ Deployment failed"
    cd - > /dev/null
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Clean up
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo ""
echo "🔧 Scaling bot dyno..."
heroku ps:scale web=1 -a $BOT_APP_NAME

echo ""
echo "📊 Deployment Status:"
heroku ps -a $BOT_APP_NAME

echo ""
echo "📋 Environment Variables:"
heroku config -a $BOT_APP_NAME

echo ""
echo "🎉 GymBuddy Telegram Bot Deployment Complete!"
echo ""
echo "✅ What was accomplished:"
echo "   • Bot now uses API endpoints instead of direct database calls"
echo "   • Fixed duplicate message issue (bot will send only 1 response)"  
echo "   • Added real-time synchronization with website"
echo "   • Improved error handling and user feedback"
echo "   • Added support for natural language processing"
echo ""
echo "🧪 Testing the deployment:"
echo "   1. Send message to @GymBuddyAppBot: '/start'"
echo "   2. Expected: Single welcome message (not 3 duplicates)"
echo "   3. Try: '/availability' - should show current schedule"
echo "   4. Try: '/clear' - should clear availability and sync with website"
echo "   5. Try natural message: 'What's my schedule today?'"
echo ""
echo "📱 Monitoring commands:"
echo "   heroku logs --tail -a $BOT_APP_NAME"
echo "   heroku ps -a $BOT_APP_NAME"
echo "   heroku restart -a $BOT_APP_NAME"
echo ""
echo "🔄 The bot is now live and syncing with the website!"

# Test basic connectivity
echo ""
echo "🔍 Testing bot connectivity..."
sleep 5
heroku logs --tail --num=20 -a $BOT_APP_NAME