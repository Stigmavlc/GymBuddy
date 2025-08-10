# 🔑 Get Your Supabase Service Key

Your API server is deployed but needs the Supabase service role key to function. Here's how to get it:

## Step 1: Go to Supabase Dashboard
1. Open [supabase.com/dashboard](https://supabase.com/dashboard) in your browser
2. Sign in with your account
3. Select your **GymBuddy** project

## Step 2: Navigate to API Settings
1. In the left sidebar, click **Settings**
2. Click **API** 
3. Scroll down to the **Project API keys** section

## Step 3: Copy the Service Role Key
1. Look for the key labeled **"service_role"** 
2. It will be a very long key that starts with `eyJ...`
3. Click the copy button next to it
4. **This is different from the anon key** - make sure you get the service_role key!

## Step 4: Set the Environment Variable
Once you have the service role key, run this command:

```bash
heroku config:set SUPABASE_SERVICE_KEY=your_service_key_here --app gymbuddy-api-ivan
```

**Replace `your_service_key_here` with the actual service role key you copied.**

## Example:
If your service role key is `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`, then run:

```bash
heroku config:set SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... --app gymbuddy-api-ivan
```

## ✅ How to Verify It Worked
After setting the key, test your API:

```bash
curl https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/
```

You should see a response like:
```json
{
  "status": "GymBuddy API is running! 💪",
  "version": "2.0.0"
}
```

## 🤖 Your Bot Integration URLs
Once the service key is set, your bot can use these endpoints:

- **Clear availability**: `DELETE https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com`
- **Check availability**: `GET https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com`
- **Set availability**: `POST https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com/availability/by-email/ivanaguilarmari@gmail.com`

## ⚠️ Important Security Note
The service_role key has full database access, so:
- Never commit it to your code
- Only use it in server-side applications (like your bot)
- Keep it secure and don't share it

Once you set this key, your bot-website synchronization will work perfectly!