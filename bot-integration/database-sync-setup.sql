-- ========================================
-- GYMBUDDY BOT-WEBSITE SYNC DATABASE SETUP
-- ========================================
--
-- This script ensures proper synchronization between the Telegram bot
-- and the web application by setting up the necessary database schema
-- and user identification mapping.
--
-- EXECUTION INSTRUCTIONS:
-- 1. Run this script in Supabase SQL Editor as authenticated user
-- 2. Verify the service role has proper access
-- 3. Test bot operations after completion
--
-- ========================================

BEGIN;

-- ==========================================
-- 1. ADD TELEGRAM_ID COLUMN FOR BOT IDENTIFICATION
-- ==========================================

-- Check if telegram_id column already exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'telegram_id'
    ) THEN
        -- Add telegram_id column
        ALTER TABLE public.users 
        ADD COLUMN telegram_id TEXT UNIQUE;
        
        -- Create index for bot queries
        CREATE INDEX users_telegram_id_idx ON public.users(telegram_id);
        
        RAISE NOTICE '✅ Added telegram_id column to users table';
    ELSE
        RAISE NOTICE 'ℹ️ telegram_id column already exists';
    END IF;
END $$;

-- ==========================================
-- 2. POPULATE KNOWN TELEGRAM IDS
-- ==========================================

-- Ivan's Telegram ID from bot documentation
UPDATE public.users 
SET telegram_id = '1195143765'
WHERE email = 'ivanaguilarmari@gmail.com'
AND telegram_id IS NULL;

-- Note: Add Youssef's Telegram ID when available:
-- UPDATE public.users 
-- SET telegram_id = 'YOUSSEF_TELEGRAM_ID'
-- WHERE email = 'youssef@domain.com';

-- ==========================================
-- 3. CREATE CHAT HISTORY TABLE FOR BOT CONVERSATIONS
-- ==========================================

-- Create chat_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    telegram_message_id INTEGER NOT NULL,
    message_text TEXT NOT NULL,
    response_text TEXT,
    message_type TEXT NOT NULL CHECK (message_type IN ('user_message', 'bot_response', 'command')),
    session_context JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS chat_history_user_id_idx ON public.chat_history(user_id);
CREATE INDEX IF NOT EXISTS chat_history_created_at_idx ON public.chat_history(created_at DESC);
CREATE INDEX IF NOT EXISTS chat_history_telegram_msg_idx ON public.chat_history(telegram_message_id);

-- ==========================================
-- 4. ADD LAST_ACTIVE TRACKING FOR BOT USAGE
-- ==========================================

-- Add last_active column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'users' 
        AND column_name = 'last_active'
    ) THEN
        ALTER TABLE public.users 
        ADD COLUMN last_active TIMESTAMP WITH TIME ZONE;
        
        RAISE NOTICE '✅ Added last_active column to users table';
    ELSE
        RAISE NOTICE 'ℹ️ last_active column already exists';
    END IF;
END $$;

-- ==========================================
-- 5. RLS POLICIES FOR BOT ACCESS
-- ==========================================

-- Enable RLS on chat_history table
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own chat history
CREATE POLICY "Users can view their own chat history" ON public.chat_history
    FOR SELECT USING (auth.uid() = user_id);

-- Service role (bot) can manage all chat history
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'chat_history' 
        AND policyname = 'service_role_full_access_chat_history'
    ) THEN
        CREATE POLICY "service_role_full_access_chat_history" ON public.chat_history
            FOR ALL 
            USING (auth.role() = 'service_role');
        
        RAISE NOTICE '✅ Created service role policy for chat_history';
    END IF;
END $$;

-- Ensure service role can access users table (should already exist)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'users' 
        AND policyname = 'service_role_full_access_users'
    ) THEN
        CREATE POLICY "service_role_full_access_users" ON public.users
            FOR ALL 
            USING (auth.role() = 'service_role');
        
        RAISE NOTICE '✅ Created service role policy for users';
    ELSE
        RAISE NOTICE 'ℹ️ Service role policy for users already exists';
    END IF;
END $$;

-- ==========================================
-- 6. FUNCTIONS FOR BOT OPERATIONS
-- ==========================================

-- Function to update last_active when bot interacts with user
CREATE OR REPLACE FUNCTION update_user_activity(user_telegram_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users 
    SET last_active = NOW()
    WHERE telegram_id = user_telegram_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log bot conversations
CREATE OR REPLACE FUNCTION log_bot_conversation(
    user_telegram_id TEXT,
    telegram_msg_id INTEGER,
    message_text TEXT,
    response_text TEXT DEFAULT NULL,
    msg_type TEXT DEFAULT 'user_message',
    context JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    user_record RECORD;
    chat_history_id UUID;
BEGIN
    -- Get user by telegram_id
    SELECT id, name, email INTO user_record
    FROM public.users 
    WHERE telegram_id = user_telegram_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found with telegram_id: %', user_telegram_id;
    END IF;
    
    -- Insert chat history record
    INSERT INTO public.chat_history (
        user_id,
        telegram_message_id,
        message_text,
        response_text,
        message_type,
        session_context
    ) VALUES (
        user_record.id,
        telegram_msg_id,
        message_text,
        response_text,
        msg_type,
        context
    ) RETURNING id INTO chat_history_id;
    
    -- Update user's last_active
    PERFORM update_user_activity(user_telegram_id);
    
    RETURN chat_history_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 7. VERIFICATION AND TESTING
-- ==========================================

-- Test user lookup by telegram_id (should find Ivan)
DO $$
DECLARE 
    user_record RECORD;
BEGIN
    SELECT * INTO user_record
    FROM public.users 
    WHERE telegram_id = '1195143765';
    
    IF FOUND THEN
        RAISE NOTICE '✅ SUCCESS: Found user with telegram_id 1195143765 - Name: %, Email: %', 
            user_record.name, user_record.email;
    ELSE
        RAISE WARNING '❌ FAILED: No user found with telegram_id 1195143765';
    END IF;
END $$;

-- Test chat history logging
DO $$
DECLARE 
    chat_id UUID;
BEGIN
    SELECT log_bot_conversation(
        '1195143765',
        12345,
        'Test message from database setup',
        'Test response',
        'user_message',
        '{"test": true}'::jsonb
    ) INTO chat_id;
    
    IF chat_id IS NOT NULL THEN
        RAISE NOTICE '✅ SUCCESS: Chat history logging works - ID: %', chat_id;
        
        -- Clean up test record
        DELETE FROM public.chat_history WHERE id = chat_id;
    ELSE
        RAISE WARNING '❌ FAILED: Chat history logging failed';
    END IF;
END $$;

COMMIT;

-- ==========================================
-- 8. VERIFICATION QUERIES
-- ==========================================

-- Show all users with their telegram_id status
SELECT 
    id, 
    name, 
    email, 
    telegram_id,
    last_active,
    CASE 
        WHEN telegram_id IS NOT NULL THEN '✅ Has Telegram ID'
        ELSE '⚠️ Missing Telegram ID'
    END as telegram_status,
    CASE 
        WHEN last_active IS NOT NULL THEN '✅ Has Activity'
        ELSE '📋 No Activity Yet'
    END as activity_status
FROM public.users
ORDER BY created_at;

-- Show RLS policies for bot-related tables
SELECT 
    schemaname,
    tablename,
    policyname,
    cmd,
    roles,
    qual
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('users', 'availability', 'chat_history')
    AND (policyname LIKE '%service_role%' OR policyname LIKE '%bot%')
ORDER BY tablename, policyname;

-- Show available functions for bot operations
SELECT 
    routine_name,
    routine_type,
    data_type,
    routine_definition
FROM information_schema.routines
WHERE routine_schema = 'public'
    AND (routine_name LIKE '%bot%' OR routine_name LIKE '%activity%')
ORDER BY routine_name;

-- ==========================================
-- NEXT STEPS FOR BOT INTEGRATION
-- ==========================================
--
-- After running this script:
--
-- 1. VERIFY SETUP:
--    - Check that Ivan's telegram_id is set correctly
--    - Verify service role policies are in place
--    - Test functions work properly
--
-- 2. UPDATE BOT CONFIGURATION:
--    - Set SUPABASE_SERVICE_KEY in bot environment
--    - Configure GYMBUDDY_API_URL pointing to API server
--    - Test bot user lookup and operations
--
-- 3. ADD YOUSSEF'S TELEGRAM ID:
--    UPDATE public.users 
--    SET telegram_id = 'HIS_TELEGRAM_ID' 
--    WHERE email = 'his_email@domain.com';
--
-- 4. TEST BOT OPERATIONS:
--    - Test /start command
--    - Test availability operations
--    - Verify real-time sync with website
--
-- 5. MONITOR LOGS:
--    - Check bot operation success/failure
--    - Monitor chat_history table growth
--    - Verify sync events trigger properly
--
-- ========================================