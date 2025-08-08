-- Fix RLS policies to allow Telegram bot access
-- The bot uses the anon key and needs to access data on behalf of users
-- Generated: August 8, 2025

-- Create bot-specific policies for availability table
-- Allow anon role to read/write availability for valid users
CREATE POLICY "Bot can read all availability" ON public.availability
    FOR SELECT TO anon USING (true);

CREATE POLICY "Bot can insert availability" ON public.availability
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Bot can update availability" ON public.availability  
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE POLICY "Bot can delete availability" ON public.availability
    FOR DELETE TO anon USING (true);

-- Create bot-specific policies for sessions table
CREATE POLICY "Bot can read all sessions" ON public.sessions
    FOR SELECT TO anon USING (true);

CREATE POLICY "Bot can create sessions" ON public.sessions
    FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "Bot can update sessions" ON public.sessions
    FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- Create bot-specific policies for users table
-- Fix the infinite recursion issue by allowing direct access
CREATE POLICY "Bot can read users by telegram_id" ON public.users
    FOR SELECT TO anon USING (telegram_id IS NOT NULL);

CREATE POLICY "Bot can update user activity" ON public.users
    FOR UPDATE TO anon USING (telegram_id IS NOT NULL) WITH CHECK (telegram_id IS NOT NULL);

-- Create bot-specific policies for chat_history table
CREATE POLICY "Bot can read all chat history" ON public.chat_history
    FOR SELECT TO anon USING (true);

CREATE POLICY "Bot can insert chat history" ON public.chat_history
    FOR INSERT TO anon WITH CHECK (true);

-- Create bot-specific policies for user_badges table
CREATE POLICY "Bot can read user badges" ON public.user_badges
    FOR SELECT TO anon USING (true);

CREATE POLICY "Bot can insert user badges" ON public.user_badges
    FOR INSERT TO anon WITH CHECK (true);

-- Verify policies were created successfully
SELECT 
    tablename, 
    policyname, 
    cmd,
    roles
FROM pg_policies 
WHERE tablename IN ('availability', 'sessions', 'users', 'chat_history', 'user_badges') 
  AND policyname LIKE '%Bot%'
ORDER BY tablename, policyname;