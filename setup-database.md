# Database Setup Instructions

Your GymBuddy app needs the database tables to work properly. Here's how to set them up:

## Step 1: Access Your Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in to your account
3. Open your GymBuddy project (the one with URL: `https://cikoqlryskuczwtfkprq.supabase.co`)

## Step 2: Run the Database Schema

1. In your Supabase project dashboard, click on "SQL Editor" in the left sidebar
2. Click on "New Query"
3. Copy and paste the entire contents of the file `supabase/schema.sql` from your project
4. Click "Run" to execute the SQL

## Step 3: Verify Tables Were Created

1. Click on "Table Editor" in the left sidebar
2. You should see these tables:
   - users
   - availability
   - sessions
   - badges
   - user_badges
   - challenges
   - user_challenges

## What This Fixes

- **Authentication Issues**: User profiles can now be created and stored
- **Login Persistence**: Your login state will be saved properly
- **App Functionality**: Dashboard features will work correctly

## If You Get Errors

- Make sure you're logged into the correct Supabase project
- The SQL might take a minute to run - be patient
- If tables already exist, you might see "already exists" errors - that's OK!

After running the database setup, your app should work much better!