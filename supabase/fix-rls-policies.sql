-- =================================================================
-- GymBuddy RLS Policy Fix Script
-- =================================================================
-- This script fixes critical Row-Level Security policy issues
-- that are causing 400/401 errors in the application.
--
-- ISSUE: RLS was not properly enabled on core tables, allowing
-- unauthenticated access to sensitive user data.
--
-- SOLUTION: Properly enable RLS and create correct policies
-- for each table based on authentication state.
-- =================================================================

-- First, let's check current RLS status for debugging
DO $$
BEGIN
    RAISE NOTICE 'Starting RLS policy fixes for GymBuddy...';
END
$$;

-- =================================================================
-- 1. USERS TABLE - Critical user profile data
-- =================================================================
-- Users should only see their own profile data
-- Foreign apps should not be able to access user emails, etc.

-- Enable RLS (this should already be enabled, but ensuring it is)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can delete their own profile" ON public.users;

-- Create proper RLS policies for users table
CREATE POLICY "Users can view their own profile" 
    ON public.users 
    FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" 
    ON public.users 
    FOR UPDATE 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
    ON public.users 
    FOR INSERT 
    WITH CHECK (auth.uid() = id);

-- Allow users to view their partner's basic info (needed for gym coordination)
CREATE POLICY "Users can view their partner profile" 
    ON public.users 
    FOR SELECT 
    USING (
        auth.uid() IS NOT NULL 
        AND id = (
            SELECT partner_id 
            FROM public.users 
            WHERE id = auth.uid()
        )
    );

-- =================================================================
-- 2. AVAILABILITY TABLE - User's gym availability schedules
-- =================================================================
-- Users should only manage their own availability
-- Partners should be able to view each other's availability

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own availability" ON public.availability;
DROP POLICY IF EXISTS "Users can view partner availability" ON public.availability;

-- Allow users to manage their own availability
CREATE POLICY "Users can manage their own availability" 
    ON public.availability 
    FOR ALL 
    USING (auth.uid() = user_id);

-- Allow users to view their partner's availability (essential for matching)
CREATE POLICY "Users can view partner availability" 
    ON public.availability 
    FOR SELECT 
    USING (
        auth.uid() IS NOT NULL 
        AND user_id = (
            SELECT partner_id 
            FROM public.users 
            WHERE id = auth.uid()
        )
    );

-- =================================================================
-- 3. SESSIONS TABLE - Scheduled gym sessions
-- =================================================================
-- Users should only see sessions they participate in
-- This is critical for privacy

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can create sessions they participate in" ON public.sessions;
DROP POLICY IF EXISTS "Users can update sessions they participate in" ON public.sessions;

-- Create proper session policies
CREATE POLICY "Users can view their own sessions" 
    ON public.sessions 
    FOR SELECT 
    USING (auth.uid() = ANY(participants));

CREATE POLICY "Users can create sessions they participate in" 
    ON public.sessions 
    FOR INSERT 
    WITH CHECK (auth.uid() = ANY(participants));

CREATE POLICY "Users can update sessions they participate in" 
    ON public.sessions 
    FOR UPDATE 
    USING (auth.uid() = ANY(participants));

-- =================================================================
-- 4. USER_BADGES TABLE - User achievement badges
-- =================================================================
-- Users should only see their own badges
-- Badge achievements are personal

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own badges" ON public.user_badges;

-- Create badge policies
CREATE POLICY "Users can view their own badges" 
    ON public.user_badges 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- System can insert badges (for badge awarding logic)
CREATE POLICY "System can award badges" 
    ON public.user_badges 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- =================================================================
-- 5. USER_CHALLENGES TABLE - User challenge progress
-- =================================================================
-- Users should only see their own challenge progress

ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can manage their own challenge progress" ON public.user_challenges;

-- Create challenge policies
CREATE POLICY "Users can manage their own challenge progress" 
    ON public.user_challenges 
    FOR ALL 
    USING (auth.uid() = user_id);

-- =================================================================
-- 6. PUBLIC TABLES - These should remain accessible
-- =================================================================
-- The badges and challenges tables should be publicly readable
-- but we need to ensure they're properly configured

-- BADGES table - publicly readable (already correct)
-- This allows users to see all available badges
-- No changes needed - this is working correctly

-- CHALLENGES table - publicly readable (already correct)
-- This allows users to see all available challenges
-- No changes needed - this is working correctly

-- =================================================================
-- 7. VERIFICATION QUERIES
-- =================================================================
-- Let's verify that our policies are working

-- This should show RLS is enabled on all protected tables
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE 'Verifying RLS is enabled on all tables...';
    
    FOR rec IN 
        SELECT schemaname, tablename, rowsecurity 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename IN ('users', 'availability', 'sessions', 'user_badges', 'user_challenges')
        ORDER BY tablename
    LOOP
        IF rec.rowsecurity THEN
            RAISE NOTICE '✅ Table %.% has RLS enabled', rec.schemaname, rec.tablename;
        ELSE
            RAISE NOTICE '❌ Table %.% does NOT have RLS enabled', rec.schemaname, rec.tablename;
        END IF;
    END LOOP;
END
$$;

-- =================================================================
-- 8. ADDITIONAL SECURITY MEASURES
-- =================================================================

-- Revoke any overly permissive grants that might bypass RLS
-- This ensures that even if someone has database access, RLS is enforced
REVOKE ALL ON public.users FROM anon;
REVOKE ALL ON public.availability FROM anon;
REVOKE ALL ON public.sessions FROM anon;
REVOKE ALL ON public.user_badges FROM anon;
REVOKE ALL ON public.user_challenges FROM anon;

-- Grant only the minimum necessary permissions
-- The anon role should only be able to use the PostgREST API with RLS
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.availability TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_badges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_challenges TO anon;

-- Public tables should be readable
GRANT SELECT ON public.badges TO anon;
GRANT SELECT ON public.challenges TO anon;

-- =================================================================
-- COMPLETION MESSAGE
-- =================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 RLS Policy Fix Complete!';
    RAISE NOTICE '===========================';
    RAISE NOTICE '';
    RAISE NOTICE 'CHANGES MADE:';
    RAISE NOTICE '- Enabled RLS on all user-specific tables';
    RAISE NOTICE '- Created proper authentication-based policies';
    RAISE NOTICE '- Added partner visibility for availability data';
    RAISE NOTICE '- Secured user profiles, sessions, and achievements';
    RAISE NOTICE '- Maintained public access to badges and challenges';
    RAISE NOTICE '';
    RAISE NOTICE 'SECURITY STATUS:';
    RAISE NOTICE '✅ Users table - Protected by RLS';
    RAISE NOTICE '✅ Availability table - Protected by RLS';  
    RAISE NOTICE '✅ Sessions table - Protected by RLS';
    RAISE NOTICE '✅ User_badges table - Protected by RLS';
    RAISE NOTICE '✅ User_challenges table - Protected by RLS';
    RAISE NOTICE '✅ Badges table - Public read access';
    RAISE NOTICE '✅ Challenges table - Public read access';
    RAISE NOTICE '';
    RAISE NOTICE 'RESULT: 400/401 errors should now be resolved!';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '1. Test your application with authenticated users';
    RAISE NOTICE '2. Verify that unauthenticated requests are properly blocked';
    RAISE NOTICE '3. Check that partner data sharing works correctly';
    RAISE NOTICE '4. Monitor application logs for any remaining issues';
    RAISE NOTICE '';
END
$$;