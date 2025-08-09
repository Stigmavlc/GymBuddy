#!/bin/bash

# Heroku Environment Variable Setup Script for GymBuddy
# This script sets the required environment variables on Heroku

APP_NAME="dry-harbor-76962"

echo "🚀 Setting up environment variables for Heroku app: $APP_NAME"

# Core Supabase Configuration (REQUIRED)
echo "Setting Supabase configuration..."
heroku config:set VITE_SUPABASE_URL=https://cikoqlryskuczwtfkprq.supabase.co --app $APP_NAME
heroku config:set VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpa29xbHJ5c2t1Y3p3dGZrcHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzIwODcsImV4cCI6MjA2ODk0ODA4N30.O_DML3t7yZOAJ7LcIqnPSuWCo7_DpeAcqxxIN38TUd8 --app $APP_NAME

# WhatsApp Integration
echo "Setting WhatsApp/Evolution API configuration..."
heroku config:set VITE_EVOLUTION_API_URL=https://gymbuddy-evolution-ivan-9989ed3d8228.herokuapp.com --app $APP_NAME
heroku config:set VITE_EVOLUTION_API_KEY=gymbuddy-secret-key-12345 --app $APP_NAME
heroku config:set VITE_EVOLUTION_INSTANCE_NAME=gymbuddy-coordinator --app $APP_NAME
heroku config:set VITE_N8N_WEBHOOK_URL=https://gymbuddy-n8n-a666114e1339.herokuapp.com/webhook/gymbuddy --app $APP_NAME

# Google Integration (Optional - for future use)
echo "Setting Google API configuration..."
heroku config:set VITE_GOOGLE_CLIENT_ID=42291494095-f7lij115hh9gs280ui65js2kib4r3tj4.apps.googleusercontent.com --app $APP_NAME
heroku config:set VITE_GOOGLE_CLIENT_SECRET=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 --app $APP_NAME
heroku config:set VITE_GOOGLE_API_KEY=AIzaSyC3wgcN8E3ngs5fbAyPY5YBUhhY3hGF7xM --app $APP_NAME

# User Configuration
echo "Setting user configuration..."
heroku config:set VITE_USER_IVAN_EMAIL=ivanaguilarmari@gmail.com --app $APP_NAME
heroku config:set VITE_USER_IVAN_PHONE=+447763242583 --app $APP_NAME
heroku config:set VITE_USER_YOUSSEF_EMAIL=youssef.dummy@test.com --app $APP_NAME
heroku config:set VITE_USER_YOUSSEF_PHONE=+447123456789 --app $APP_NAME

# Additional configurations (placeholders for services not yet implemented)
echo "Setting placeholder configurations..."
heroku config:set VITE_ONESIGNAL_APP_ID=your_onesignal_app_id --app $APP_NAME
heroku config:set VITE_TWILIO_ACCOUNT_SID=your_twilio_account_sid --app $APP_NAME
heroku config:set VITE_TWILIO_AUTH_TOKEN=your_twilio_auth_token --app $APP_NAME
heroku config:set VITE_SUPABASE_SERVICE_ROLE_KEY=your_service_role_key --app $APP_NAME

echo "✅ Environment variables set successfully!"
echo "🔄 Triggering a new build to apply changes..."
heroku releases:retry --app $APP_NAME

echo "📊 Current environment variables:"
heroku config --app $APP_NAME

echo "🎯 Deployment complete! Check the app at:"
echo "https://dry-harbor-76962-559d5aa4f14a.herokuapp.com/"