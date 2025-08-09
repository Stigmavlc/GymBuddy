#!/bin/bash

# GymBuddy API Server Heroku Deployment Script
# This script will deploy your API server to a new Heroku app

echo "🚀 GymBuddy API Server - Heroku Deployment Script"
echo "================================================"

# Check if Heroku CLI is installed
if ! command -v heroku &> /dev/null; then
    echo "❌ Heroku CLI not found. Please install it first:"
    echo "   brew tap heroku/brew && brew install heroku"
    echo "   Or visit: https://devcenter.heroku.com/articles/heroku-cli"
    exit 1
fi

# Check if user is logged in to Heroku
if ! heroku auth:whoami &> /dev/null; then
    echo "❌ Not logged in to Heroku. Please run:"
    echo "   heroku login"
    exit 1
fi

echo "✅ Heroku CLI found and authenticated"

# Set app name
APP_NAME="gymbuddy-api-ivan"
echo "📱 Creating Heroku app: $APP_NAME"

# Create new Heroku app
heroku create $APP_NAME --region us

if [ $? -ne 0 ]; then
    echo "⚠️  App name might be taken. Trying with random suffix..."
    APP_NAME="gymbuddy-api-ivan-$(date +%s)"
    heroku create $APP_NAME --region us
fi

echo "✅ Created Heroku app: $APP_NAME"

# Set environment variables
echo "🔧 Setting environment variables..."

heroku config:set \
    SUPABASE_URL=https://cikoqlryskuczwtfkprq.supabase.co \
    NODE_ENV=production \
    PORT=3001 \
    --app $APP_NAME

echo "✅ Environment variables set"
echo ""
echo "🔑 IMPORTANT: You need to set your SUPABASE_SERVICE_KEY manually:"
echo "   1. Go to https://supabase.com/dashboard"
echo "   2. Select your GymBuddy project"  
echo "   3. Go to Settings → API"
echo "   4. Copy the 'service_role' key (starts with eyJ...)"
echo "   5. Run this command:"
echo "      heroku config:set SUPABASE_SERVICE_KEY=your_service_key_here --app $APP_NAME"
echo ""

# Add Heroku remote for the API subdirectory
echo "🔗 Adding Heroku remote..."
cd api/
git init
git remote add heroku https://git.heroku.com/$APP_NAME.git

# Create initial commit for API files
echo "📦 Preparing API files for deployment..."
git add .
git commit -m "Initial API server deployment"

# Deploy to Heroku
echo "🚀 Deploying to Heroku..."
git push heroku main --force

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 SUCCESS! Your API server is deployed!"
    echo "📍 API URL: https://$APP_NAME.herokuapp.com"
    echo ""
    echo "🧪 Test your API:"
    echo "   curl https://$APP_NAME.herokuapp.com"
    echo ""
    echo "🤖 For bot integration, use these endpoints:"
    echo "   GET  https://$APP_NAME.herokuapp.com/user/by-email/ivanaguilarmari@gmail.com"
    echo "   GET  https://$APP_NAME.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com" 
    echo "   DELETE https://$APP_NAME.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com"
    echo ""
    echo "⚠️  Don't forget to set SUPABASE_SERVICE_KEY (see instructions above)!"
else
    echo "❌ Deployment failed. Check the error messages above."
fi