#!/bin/bash

# Script to set Heroku environment variables for GymBuddy
# Run this script with: bash set-heroku-env.sh

echo "Setting Heroku environment variables for GymBuddy..."

# Set the Heroku app name
HEROKU_APP="dry-harbor-76962"

# Set Supabase configuration
heroku config:set VITE_SUPABASE_URL=https://cikoqlryskuczwtfkprq.supabase.co --app $HEROKU_APP
heroku config:set VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpa29xbHJ5c2t1Y3p3dGZrcHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzIwODcsImV4cCI6MjA2ODk0ODA4N30.O_DML3t7yZOAJ7LcIqnPSuWCo7_DpeAcqxxIN38TUd8 --app $HEROKU_APP

echo ""
echo "Environment variables set! Heroku will rebuild your app automatically."
echo "You can check the config with: heroku config --app $HEROKU_APP"
echo ""
echo "The app will be rebuilt with these environment variables embedded in the JavaScript bundle."