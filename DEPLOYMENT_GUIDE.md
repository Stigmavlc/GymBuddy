# GymBuddy Deployment Guide

This guide will help you deploy the required services to complete your GymBuddy app.

## Prerequisites
- Heroku account (free tier is fine)
- Heroku CLI installed on your computer
- Git installed

## Step 1: Deploy Evolution API (WhatsApp Service)

### 1.1 Install Heroku CLI
If you haven't already, install the Heroku CLI:
- Go to: https://devcenter.heroku.com/articles/heroku-cli
- Download and install for your operating system

### 1.2 Login to Heroku
Open your terminal and run:
```bash
heroku login
```
This will open your browser to login.

### 1.3 Create Evolution API App
In your terminal, navigate to your GymBuddy folder:
```bash
cd "/Users/ivanaguilar/Desktop/Web Development  Projects/Completed By Me/GymBuddy"
```

Create the Heroku app:
```bash
heroku create gymbuddy-evolution-api
```

### 1.4 Deploy Evolution API
Since Evolution API is from GitHub, we'll deploy it directly:
```bash
# Create a temporary directory
mkdir temp-evolution && cd temp-evolution

# Clone Evolution API
git clone https://github.com/EvolutionAPI/evolution-api.git
cd evolution-api

# Add Heroku remote
heroku git:remote -a gymbuddy-evolution-api

# Set config vars from app.json
heroku config:set SERVER_URL=https://gymbuddy-evolution-api.herokuapp.com
heroku config:set DATABASE_ENABLED=true
heroku config:set WEBHOOK_GLOBAL_ENABLED=true
heroku config:set WEBHOOK_GLOBAL_WEBHOOK_BY_EVENTS=true
heroku config:set CORS_ORIGIN=*
heroku config:set CORS_METHODS=POST,GET,PUT,DELETE
heroku config:set CORS_CREDENTIALS=true

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:essential-0

# Deploy
git push heroku main

# Go back to GymBuddy folder
cd ../../
rm -rf temp-evolution
```

### 1.5 Get Your API Key
After deployment, get your Evolution API key:
```bash
heroku config:get AUTHENTICATION_API_KEY -a gymbuddy-evolution-api
```
Save this key - you'll need it for your .env file!

## Step 2: Deploy n8n (Workflow Automation)

### 2.1 Create n8n App
```bash
heroku create gymbuddy-n8n
```

### 2.2 Deploy n8n
```bash
# Create temporary directory
mkdir temp-n8n && cd temp-n8n

# Create package.json for n8n
echo '{
  "name": "gymbuddy-n8n",
  "version": "1.0.0",
  "description": "n8n for GymBuddy",
  "main": "index.js",
  "scripts": {
    "start": "n8n"
  },
  "dependencies": {
    "n8n": "^1.9.0"
  },
  "engines": {
    "node": "18.x"
  }
}' > package.json

# Initialize git
git init
git add .
git commit -m "Initial n8n setup"

# Add Heroku remote
heroku git:remote -a gymbuddy-n8n

# Set config vars
heroku config:set N8N_HOST=0.0.0.0
heroku config:set N8N_PORT=80
heroku config:set WEBHOOK_URL=https://gymbuddy-n8n.herokuapp.com
heroku config:set N8N_BASIC_AUTH_ACTIVE=true
heroku config:set N8N_BASIC_AUTH_USER=admin
heroku config:set GENERIC_TIMEZONE=Europe/London
heroku config:set N8N_PROTOCOL=https
heroku config:set NODE_ENV=production

# Add PostgreSQL
heroku addons:create heroku-postgresql:essential-0

# Deploy
git push heroku main

# Get the basic auth password
heroku config:get N8N_BASIC_AUTH_PASSWORD -a gymbuddy-n8n

# Go back
cd ../
rm -rf temp-n8n
```

## Step 3: Configure Your App

### 3.1 Create .env file
Copy the example file:
```bash
cp .env.example .env
```

### 3.2 Update .env with your values
Open `.env` in your text editor and update:

1. **Supabase credentials** (from your Supabase dashboard)
2. **Evolution API key** (from Step 1.5)
3. Keep the URLs as they are in .env.example

### 3.3 Connect WhatsApp
1. Open Evolution API: https://gymbuddy-evolution-api.herokuapp.com
2. Use your API key to authenticate
3. Create instance named "gymbuddy-coordinator"
4. Scan QR code with WhatsApp

### 3.4 Import n8n Workflow
1. Open n8n: https://gymbuddy-n8n.herokuapp.com
2. Login with username: admin, password: (from Step 2.2)
3. Import workflow from `/docs/N8N_WORKFLOW.json`
4. Update the webhook URL in Evolution API to point to your n8n webhook

## Step 4: Test Everything

### 4.1 Run your app locally
```bash
npm run dev
```

### 4.2 Test the flow
1. Go to http://localhost:5173
2. Login as Ivan
3. Set availability
4. Use the test pages to verify WhatsApp works

## Troubleshooting

### If Evolution API doesn't start:
- Check logs: `heroku logs --tail -a gymbuddy-evolution-api`
- Make sure PostgreSQL addon is attached

### If n8n doesn't start:
- Check logs: `heroku logs --tail -a gymbuddy-n8n`
- Verify all environment variables are set

### If WhatsApp messages don't send:
- Verify Evolution API instance is connected (green status)
- Check Evolution API logs for errors
- Make sure phone numbers are in correct format (+44...)

## Next Steps
Once everything is deployed and working:
1. Test with real users
2. Monitor the logs
3. Remove test pages before final deployment