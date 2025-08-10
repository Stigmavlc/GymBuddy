#!/bin/bash

echo "🔧 Fixing GymBuddy API Heroku Deployment"
echo "======================================="

APP_NAME="gymbuddy-api-ivan"

echo "📋 Step 1: Checking app status..."
heroku ps --app $APP_NAME

echo ""
echo "📋 Step 2: Checking recent logs..."
heroku logs --app $APP_NAME --num 20

echo ""
echo "📋 Step 3: Checking configuration..."
heroku config --app $APP_NAME

echo ""
echo "🔧 Step 4: Attempting to restart the app..."
heroku ps:restart --app $APP_NAME

echo ""
echo "⏱️  Step 5: Waiting for restart (10 seconds)..."
sleep 10

echo ""
echo "🧪 Step 6: Testing the API endpoint..."
curl -s https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/ | head -10

echo ""
echo ""
echo "🔧 If the API still doesn't work, let's redeploy with a different approach:"
echo ""
echo "1. The issue might be that Heroku can't find our files in the subdirectory"
echo "2. We may need to deploy differently"
echo ""
echo "💡 Alternative fix - run these commands manually:"
echo "   cd api/"
echo "   git add . && git commit -m 'Fix deployment'"
echo "   git push heroku main --force"
echo ""
echo "📞 If you need help, share the output from steps 1-3 above"