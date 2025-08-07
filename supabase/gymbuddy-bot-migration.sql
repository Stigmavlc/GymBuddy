-- GymBuddy Bot Database Migration
-- This script adds the necessary tables and fields for Telegram bot functionality
-- Execute this script in your Supabase SQL editor

-- 1. Add missing fields to users table for bot integration
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS telegram_id BIGINT UNIQUE,
ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Create chat_history table for conversation memory
CREATE TABLE IF NOT EXISTS public.chat_history (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    message_text TEXT NOT NULL,
    response_text TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user_message', 'bot_response')),
    session_context JSONB DEFAULT '{}'::jsonb
);

-- 3. Add index for better performance on chat history queries
CREATE INDEX IF NOT EXISTS idx_chat_history_user_timestamp 
ON public.chat_history (user_id, timestamp DESC);

-- 4. Add index for telegram_id lookups
CREATE INDEX IF NOT EXISTS idx_users_telegram_id 
ON public.users (telegram_id) WHERE telegram_id IS NOT NULL;

-- 5. Enable RLS for chat_history table
ALTER TABLE public.chat_history ENABLE ROW LEVEL SECURITY;

-- 6. Create RLS policies for chat_history
CREATE POLICY IF NOT EXISTS "Users can view their own chat history" 
ON public.chat_history FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert their own chat history" 
ON public.chat_history FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- 7. Enhanced sessions table for bot integration (optional fields)
ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS created_via VARCHAR(20) DEFAULT 'website' CHECK (created_via IN ('website', 'telegram_bot')),
ADD COLUMN IF NOT EXISTS bot_message_id VARCHAR(50);

-- 8. Function to automatically clean up old chat history (30 days retention)
CREATE OR REPLACE FUNCTION cleanup_old_chat_history()
RETURNS void AS $$
BEGIN
    DELETE FROM public.chat_history 
    WHERE timestamp < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- 9. Optional: Create a scheduled job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-chat-history', '0 2 * * *', 'SELECT cleanup_old_chat_history();');

-- 10. Sample data insertion for testing (replace with actual Telegram IDs)
-- Update Ivan's record with his Telegram ID
UPDATE public.users 
SET telegram_id = 1195143765 
WHERE email ILIKE '%ivan%' AND telegram_id IS NULL;

-- Note: You'll need to manually update Youssef's telegram_id when he first messages the bot
-- The bot will automatically identify him based on his name/email from the database

-- Verification queries (run these to check the migration worked)
-- SELECT 'Users table updated' as status, count(*) as users_with_telegram_id FROM public.users WHERE telegram_id IS NOT NULL;
-- SELECT 'Chat history table created' as status, count(*) as chat_records FROM public.chat_history;
-- SELECT 'Sessions table enhanced' as status, count(*) as sessions FROM public.sessions;