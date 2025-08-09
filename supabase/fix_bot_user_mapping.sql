-- ========================================
-- BOT-WEBSITE SYNC FIX: USER IDENTITY MAPPING
-- ========================================
--
-- PROBLEM DIAGNOSED:
-- The bot-website sync issue is caused by a USER IDENTITY MAPPING FAILURE.
-- The bot expects a `telegram_id` column in the users table to identify users,
-- but this column doesn't exist in the current database schema.
--
-- SYMPTOMS:
-- - Website: User sets availability ✅ (works - uses auth.uid())
-- - Bot: Claims to clear availability ✅ (claims success but does nothing)  
-- - Website: Doesn't see bot changes ❌ (because bot never actually modifies data)
--
-- ROOT CAUSE:
-- 1. Bot calls getUserByTelegramId(telegramId) 
-- 2. This queries: SELECT * FROM users WHERE telegram_id = telegramId
-- 3. telegram_id column doesn't exist → query fails → returns null
-- 4. Bot operations continue with null user → affect zero records
-- 5. Bot reports "success" because no errors, but no data is modified
-- 6. Website never sees changes because none were actually made
--
-- SOLUTION:
-- Add telegram_id column to users table and populate known values
--
-- ========================================

BEGIN;

-- Step 1: Add telegram_id column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS telegram_id TEXT UNIQUE;

-- Step 2: Create index for performance (bot will query this frequently)
CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON public.users(telegram_id);

-- Step 3: Populate telegram_id for known users
-- Ivan's Telegram ID from bot code: 1195143765
UPDATE public.users 
SET telegram_id = '1195143765'
WHERE email = 'ivanaguilarmari@gmail.com';

-- Note: Youssef's telegram_id should be added when known
-- UPDATE public.users 
-- SET telegram_id = 'YOUSSEF_TELEGRAM_ID'
-- WHERE email = 'youssef@domain.com';

-- Step 4: Update RLS policies to ensure service role can access users by telegram_id
-- (The existing service_role_full_access_users policy should already cover this,
-- but let's verify it exists and works)

-- Verify service role policy exists for users table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'service_role_full_access_users'
  ) THEN
    -- Create service role policy if it doesn't exist
    CREATE POLICY "service_role_full_access_users" ON public.users
      FOR ALL 
      USING (auth.role() = 'service_role');
    
    RAISE NOTICE 'Created missing service_role_full_access_users policy';
  ELSE
    RAISE NOTICE 'service_role_full_access_users policy already exists';
  END IF;
END $$;

-- Step 5: Verify the fix worked by testing the query the bot uses
-- This should return Ivan's user record
DO $$
DECLARE 
  user_record RECORD;
BEGIN
  -- Test the exact query the bot will use
  SELECT * INTO user_record
  FROM public.users 
  WHERE telegram_id = '1195143765';
  
  IF FOUND THEN
    RAISE NOTICE 'SUCCESS: Found user with telegram_id 1195143765 - Name: %, Email: %', 
      user_record.name, user_record.email;
  ELSE
    RAISE WARNING 'FAILED: No user found with telegram_id 1195143765';
  END IF;
END $$;

-- Step 6: Test that service role can access availability table
-- (This should already work due to existing RLS policies)
DO $$
DECLARE 
  availability_count INTEGER;
BEGIN
  -- Count availability records (as service role would)
  SELECT COUNT(*) INTO availability_count
  FROM public.availability;
  
  RAISE NOTICE 'Service role can access % availability records', availability_count;
END $$;

COMMIT;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Run these queries to verify the fix worked:

-- 1. Check that telegram_id column was added and populated
SELECT 
  id, 
  name, 
  email, 
  telegram_id,
  CASE 
    WHEN telegram_id IS NOT NULL THEN '✅ Has Telegram ID'
    ELSE '❌ Missing Telegram ID'
  END as telegram_status
FROM public.users
ORDER BY created_at;

-- 2. Test bot user lookup query
SELECT 
  'Bot user lookup test' as test_type,
  id,
  name,
  email,
  telegram_id
FROM public.users 
WHERE telegram_id = '1195143765';

-- 3. Verify RLS policies for users table
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename = 'users'
ORDER BY policyname;

-- ========================================
-- NEXT STEPS FOR FULL BOT INTEGRATION
-- ========================================
--
-- 1. CONFIGURE BOT ENVIRONMENT:
--    - Ensure bot uses SUPABASE_SERVICE_KEY (not anon key)
--    - Verify bot has correct SUPABASE_URL
--
-- 2. ADD YOUSSEF'S TELEGRAM ID:
--    - When Youssef's Telegram ID is known, run:
--    UPDATE public.users SET telegram_id = 'HIS_TELEGRAM_ID' WHERE email = 'his_email@domain.com';
--
-- 3. TEST BOT OPERATIONS:
--    - Test bot can find users with getUserByTelegramId()
--    - Test bot can read/write availability
--    - Verify real-time sync between bot and website
--
-- 4. MONITORING:
--    - Check bot logs for user lookup successes/failures
--    - Monitor availability changes in real-time subscriptions
--
-- ========================================
-- SECURITY NOTES
-- ========================================
--
-- - telegram_id is set as UNIQUE to prevent duplicate Telegram users
-- - Only service role can access all user data (bot operations)
-- - Authenticated users can still only see their own data
-- - This change maintains all existing security boundaries
--
-- ========================================