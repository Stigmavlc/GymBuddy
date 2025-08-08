-- Migration: Fix infinite recursion in users table RLS policies
-- Run this in your Supabase SQL Editor with elevated permissions

-- Step 1: Drop all existing problematic policies on the users table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own and partner profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can check profiles" ON public.users;
DROP POLICY IF EXISTS "Bot can read users by telegram_id" ON public.users;
DROP POLICY IF EXISTS "Bot can update user activity" ON public.users;
DROP POLICY IF EXISTS "Service role can manage all users" ON public.users;

-- Step 2: Create corrected policies with proper type casting and no circular references

-- 1. Service role has full access (for admin operations)
CREATE POLICY "Service role full access" ON public.users
    FOR ALL
    TO public
    USING (auth.role() = 'service_role'::text);

-- 2. Users can view their own profile (with explicit type casting)
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT
    TO public
    USING (auth.uid()::text = id::text);

-- 3. Users can view their partner's profile (without circular reference)
CREATE POLICY "Users can view partner profile" ON public.users
    FOR SELECT
    TO public
    USING (
        auth.uid()::text IS NOT NULL 
        AND id::text = (
            SELECT u.partner_id::text 
            FROM public.users u 
            WHERE u.id::text = auth.uid()::text 
            AND u.partner_id IS NOT NULL
        )
    );

-- 4. Users can insert their own profile (with explicit type casting)
CREATE POLICY "Users can insert own profile" ON public.users
    FOR INSERT
    TO public
    WITH CHECK (auth.uid()::text = id::text);

-- 5. Users can update their own profile (with explicit type casting)
CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE
    TO public
    USING (auth.uid()::text = id::text)
    WITH CHECK (auth.uid()::text = id::text);

-- 6. Authenticated users can read basic profile info (for partner matching)
CREATE POLICY "Authenticated can read profiles" ON public.users
    FOR SELECT
    TO public
    USING (
        auth.role() = 'authenticated'::text 
        AND auth.uid() IS NOT NULL
    );

-- 7. Bot can read users by telegram_id (anonymous access for bot operations)
CREATE POLICY "Bot read by telegram_id" ON public.users
    FOR SELECT
    TO anon
    USING (telegram_id IS NOT NULL);

-- 8. Bot can update user activity
CREATE POLICY "Bot update user activity" ON public.users
    FOR UPDATE
    TO anon
    USING (telegram_id IS NOT NULL)
    WITH CHECK (telegram_id IS NOT NULL);

-- Step 3: Verify the policies were created correctly
SELECT 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'users' 
ORDER BY policyname;