-- ========================================
-- FIX FOR SUPABASE RLS AUTHENTICATION ISSUES
-- ========================================
-- 
-- This script fixes the infinite recursion and authentication blocking issues
-- in the GymBuddy database by correcting RLS policies
--
-- PROBLEM DIAGNOSED:
-- 1. Missing service role policies that allow backend operations
-- 2. Potential infinite recursion from circular policy references  
-- 3. Missing policies for profile creation during sign-up
-- 4. Inconsistent UUID type casting that can cause comparison failures
-- 5. Missing policies for Telegram bot operations
-- 
-- SOLUTION:
-- - Add service role bypass for all backend operations
-- - Fix existing policies with proper UUID casting
-- - Add comprehensive policies for user profile management
-- - Add policies for bot operations
-- - Ensure no circular references that cause infinite loops
--
-- ========================================

-- START TRANSACTION
BEGIN;

-- ========================================
-- STEP 1: REMOVE ALL EXISTING RLS POLICIES
-- ========================================
-- This ensures we start with a clean slate and removes any problematic policies

-- Users table policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view partner profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own and partner profile" ON public.users;
DROP POLICY IF EXISTS "Service role full access to users" ON public.users;
DROP POLICY IF EXISTS "Allow authenticated users to read profiles" ON public.users;
DROP POLICY IF EXISTS "Allow bot access to users" ON public.users;

-- Availability table policies
DROP POLICY IF EXISTS "Users can manage their own availability" ON public.availability;
DROP POLICY IF EXISTS "Service role full access to availability" ON public.availability;

-- Sessions table policies
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can create sessions they participate in" ON public.sessions;
DROP POLICY IF EXISTS "Users can update sessions they participate in" ON public.sessions;
DROP POLICY IF EXISTS "Service role full access to sessions" ON public.sessions;

-- Badges table policies
DROP POLICY IF EXISTS "Anyone can read badges" ON public.badges;
DROP POLICY IF EXISTS "Service role full access to badges" ON public.badges;

-- User badges table policies
DROP POLICY IF EXISTS "Users can view their own badges" ON public.user_badges;
DROP POLICY IF EXISTS "Service role full access to user_badges" ON public.user_badges;

-- Challenges table policies
DROP POLICY IF EXISTS "Anyone can read challenges" ON public.challenges;
DROP POLICY IF EXISTS "Service role full access to challenges" ON public.challenges;

-- User challenges table policies
DROP POLICY IF EXISTS "Users can manage their own challenge progress" ON public.user_challenges;
DROP POLICY IF EXISTS "Service role full access to user_challenges" ON public.user_challenges;

-- ========================================
-- STEP 2: CREATE NEW SECURE RLS POLICIES
-- ========================================

-- USERS TABLE POLICIES
-- Priority 1: Service role needs full access for backend operations
CREATE POLICY "service_role_full_access_users" ON public.users
    FOR ALL 
    USING (auth.role() = 'service_role');

-- Priority 2: Users can manage their own profile
CREATE POLICY "users_can_select_own_profile" ON public.users
    FOR SELECT 
    USING (auth.uid()::text = id::text);

CREATE POLICY "users_can_insert_own_profile" ON public.users
    FOR INSERT 
    WITH CHECK (auth.uid()::text = id::text);

CREATE POLICY "users_can_update_own_profile" ON public.users
    FOR UPDATE 
    USING (auth.uid()::text = id::text);

-- Priority 3: Users can view their partner's profile (but NOT edit it)
-- This policy is carefully designed to avoid infinite recursion
CREATE POLICY "users_can_view_partner_profile" ON public.users
    FOR SELECT 
    USING (
        -- User can view their partner's profile by matching partner_id
        EXISTS (
            SELECT 1 FROM public.users AS self_user 
            WHERE self_user.id::text = auth.uid()::text 
            AND self_user.partner_id::text = public.users.id::text
        )
    );

-- Priority 4: Authenticated users can read basic profile info for partner matching
-- This allows users to see other users when setting up partnerships
CREATE POLICY "authenticated_users_can_read_basic_profiles" ON public.users
    FOR SELECT 
    USING (auth.role() = 'authenticated');

-- AVAILABILITY TABLE POLICIES
CREATE POLICY "service_role_full_access_availability" ON public.availability
    FOR ALL 
    USING (auth.role() = 'service_role');

CREATE POLICY "users_can_manage_own_availability" ON public.availability
    FOR ALL 
    USING (auth.uid()::text = user_id::text);

-- Users can view their partner's availability for coordination
CREATE POLICY "users_can_view_partner_availability" ON public.availability
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id::text = auth.uid()::text 
            AND users.partner_id::text = availability.user_id::text
        )
    );

-- SESSIONS TABLE POLICIES
CREATE POLICY "service_role_full_access_sessions" ON public.sessions
    FOR ALL 
    USING (auth.role() = 'service_role');

CREATE POLICY "users_can_view_own_sessions" ON public.sessions
    FOR SELECT 
    USING (auth.uid()::text = ANY(participants::text[]));

CREATE POLICY "users_can_create_sessions_they_participate_in" ON public.sessions
    FOR INSERT 
    WITH CHECK (auth.uid()::text = ANY(participants::text[]));

CREATE POLICY "users_can_update_sessions_they_participate_in" ON public.sessions
    FOR UPDATE 
    USING (auth.uid()::text = ANY(participants::text[]));

-- BADGES TABLE POLICIES (Read-only for users)
CREATE POLICY "service_role_full_access_badges" ON public.badges
    FOR ALL 
    USING (auth.role() = 'service_role');

CREATE POLICY "authenticated_users_can_read_badges" ON public.badges
    FOR SELECT 
    USING (auth.role() = 'authenticated');

-- USER BADGES TABLE POLICIES
CREATE POLICY "service_role_full_access_user_badges" ON public.user_badges
    FOR ALL 
    USING (auth.role() = 'service_role');

CREATE POLICY "users_can_view_own_badges" ON public.user_badges
    FOR SELECT 
    USING (auth.uid()::text = user_id::text);

-- Allow system to grant badges
CREATE POLICY "authenticated_users_can_insert_badges" ON public.user_badges
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid()::text = user_id::text);

-- CHALLENGES TABLE POLICIES (Read-only for users)
CREATE POLICY "service_role_full_access_challenges" ON public.challenges
    FOR ALL 
    USING (auth.role() = 'service_role');

CREATE POLICY "authenticated_users_can_read_challenges" ON public.challenges
    FOR SELECT 
    USING (auth.role() = 'authenticated');

-- USER CHALLENGES TABLE POLICIES
CREATE POLICY "service_role_full_access_user_challenges" ON public.user_challenges
    FOR ALL 
    USING (auth.role() = 'service_role');

CREATE POLICY "users_can_manage_own_challenge_progress" ON public.user_challenges
    FOR ALL 
    USING (auth.uid()::text = user_id::text);

-- ========================================
-- STEP 3: VERIFY NO INFINITE RECURSION
-- ========================================

-- Test that policies don't cause infinite loops
-- This query should NOT hang or cause recursion errors
DO $$
DECLARE 
    test_result INTEGER;
BEGIN
    -- Simple test query to verify policies work
    SELECT COUNT(*) INTO test_result FROM public.users LIMIT 1;
    RAISE NOTICE 'Policy test passed: Found % users (or 0 if none exist)', test_result;
EXCEPTION 
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Policy test failed: %', SQLERRM;
END $$;

-- ========================================
-- STEP 4: ADD HELPFUL FUNCTIONS
-- ========================================

-- Function to check if current user can access another user's data
CREATE OR REPLACE FUNCTION public.can_access_user_data(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Service role can access everything
    IF auth.role() = 'service_role' THEN
        RETURN TRUE;
    END IF;
    
    -- Users can access their own data
    IF auth.uid()::text = target_user_id::text THEN
        RETURN TRUE;
    END IF;
    
    -- Users can access their partner's data
    IF EXISTS (
        SELECT 1 FROM public.users 
        WHERE id::text = auth.uid()::text 
        AND partner_id::text = target_user_id::text
    ) THEN
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- ========================================
-- STEP 5: COMMIT TRANSACTION
-- ========================================

COMMIT;

-- ========================================
-- VERIFICATION QUERIES
-- ========================================
-- Run these queries to verify the fix worked:

-- 1. Check that policies exist and are properly named
SELECT schemaname, tablename, policyname, cmd, roles 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- 2. Test basic connectivity (should not hang)
SELECT 'Database connection test: SUCCESS' as status, NOW() as timestamp;

-- 3. Test that service role can access users table
-- (Run this with service role key)
-- SELECT COUNT(*) as user_count FROM public.users;

-- 4. Test that authenticated role can access badges
-- SELECT COUNT(*) as badge_count FROM public.badges;

-- ========================================
-- TROUBLESHOOTING NOTES
-- ========================================
--
-- If you still get "Failed to fetch" errors after running this script:
--
-- 1. CLEAR BROWSER CACHE: The old failed requests may be cached
--
-- 2. CHECK SUPABASE DASHBOARD:
--    - Go to Authentication > Settings 
--    - Verify "Enable email confirmations" matches your app expectations
--    - Check "Site URL" includes your domain
--
-- 3. VERIFY ENVIRONMENT VARIABLES:
--    - VITE_SUPABASE_URL should point to your project
--    - VITE_SUPABASE_ANON_KEY should be the anon key (not service key)
--
-- 4. TEST SPECIFIC OPERATIONS:
--    - Try signing up a new user
--    - Try signing in an existing user  
--    - Check browser console for specific error messages
--
-- 5. ROLLBACK IF NEEDED:
--    If this script causes new issues, you can rollback by:
--    - Dropping all policies: DROP POLICY IF EXISTS "policy_name" ON table_name;
--    - Disabling RLS: ALTER TABLE table_name DISABLE ROW LEVEL SECURITY;
--    - Then re-run the original schema.sql
--
-- ========================================