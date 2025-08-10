# Fix for Supabase RLS Infinite Recursion Error

## Problem Diagnosis

The "Failed to fetch" authentication errors in your GymBuddy app are caused by **infinite recursion in Row Level Security (RLS) policies** on the `users` table. Here's what was wrong:

### 1. **Circular Reference Problem**
The policy "Users can view own and partner profile" had this problematic condition:
```sql
WHERE (users_1.id = users_1.id)  -- This is ALWAYS true!
```
This created an infinite loop because every user matched this condition, causing the database to loop endlessly.

### 2. **Missing Type Casting**
Comparisons between `auth.uid()` (returns UUID) and `id` (also UUID) sometimes fail without explicit casting:
```sql
auth.uid() = id  -- Can fail
auth.uid()::text = id::text  -- Reliable
```

### 3. **Policy Conflicts**
Multiple overlapping policies were causing conflicts and performance issues.

## Solution Steps

### Step 1: Run the SQL Fix
1. **Open your Supabase Dashboard**: Go to https://supabase.com/dashboard
2. **Navigate to your project**: `cikoqlryskuczwtfkprq`
3. **Go to SQL Editor**: Click on "SQL Editor" in the left sidebar
4. **Copy and paste the contents** of `supabase/fix_rls_infinite_recursion.sql`
5. **Run the migration**: Click "RUN" to execute all commands

### Step 2: Test the Fix
After running the SQL migration, test the connection:

```bash
# In your project directory, run:
node test-db-connection.js
```

This will test:
- ✅ Basic database connectivity
- ✅ RLS policies are working correctly (but not causing infinite loops)
- ✅ Access to other tables like badges

### Step 3: Verify in Your App
1. **Start your development server**:
   ```bash
   npm run dev
   ```
2. **Try to access your app**: The authentication errors should be gone
3. **Test user login/registration**: Should work without "Failed to fetch" errors

## What the New Policies Do

### 🔧 **Fixed Policies Overview**:

1. **Service Role Access**: Full admin access for backend operations
2. **Own Profile Access**: Users can view/edit their own profile (with proper type casting)
3. **Partner Profile Access**: Users can view their partner's profile (NO circular reference)
4. **Profile Creation**: Users can create their own profile during registration
5. **General Profile Reading**: Authenticated users can read basic profile info for partner matching
6. **Bot Access**: Special policies for Telegram bot operations

### 🎯 **Key Improvements**:
- ✅ **No more infinite recursion** - Removed the `users_1.id = users_1.id` condition
- ✅ **Explicit type casting** - All UUID comparisons use `::text` casting
- ✅ **Clear policy separation** - Each policy has a specific, non-overlapping purpose
- ✅ **Performance optimized** - Policies are structured for efficient execution

## Troubleshooting

If you still get errors after applying the fix:

### Error: "Cannot apply migration in read-only mode"
- This means you need to use the Supabase Dashboard SQL Editor instead of the CLI
- Copy the SQL from `supabase/fix_rls_infinite_recursion.sql` into the Dashboard

### Error: "Failed to fetch" still occurs
1. **Clear your browser cache** and try again
2. **Check the browser console** for more specific error messages
3. **Run the test script** to isolate if it's a database or frontend issue

### Error: "Insufficient privileges"
- Make sure you're running the SQL in Supabase Dashboard as the project owner
- The dashboard gives you the necessary privileges that the anon key doesn't have

## Files Created

1. **`supabase/fix_rls_infinite_recursion.sql`** - The SQL migration to fix the policies
2. **`test-db-connection.js`** - Test script to verify the fix worked
3. **`RLS_FIX_INSTRUCTIONS.md`** - This instruction document

## Need Help?

If you run into any issues:
1. **Check the SQL Editor output** - Look for any error messages when running the migration
2. **Run the test script** - It will help identify exactly what's failing
3. **Check browser console** - Look for specific error messages in your app

The fix addresses the root cause of the infinite recursion and should resolve your authentication issues completely.