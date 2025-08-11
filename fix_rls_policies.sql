-- GymBuddy RLS Policy Fix Script
-- This script addresses the 400 errors by fixing restrictive RLS policies
-- Focus: Allow basic functionality while maintaining reasonable security

-- First, drop existing restrictive policies on users table
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.users;

-- Create more permissive but still secure policies for users table

-- 1. SELECT Policy: Allow users to read their own profile AND their partner's profile
-- This is critical for gym coordination features
CREATE POLICY "Users can view profiles they need access to" ON public.users
    FOR SELECT USING (
        auth.uid() = id OR                                    -- Own profile
        auth.uid() = partner_id OR                           -- Partner can see user's profile  
        id = (SELECT partner_id FROM public.users WHERE id = auth.uid()) -- User can see partner's profile
    );

-- 2. INSERT Policy: Allow authenticated users to create their own profile
CREATE POLICY "Users can create their own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. UPDATE Policy: Allow users to update their own profile only
CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 4. DELETE Policy: Prevent deletions (profiles should be deactivated, not deleted)
-- Note: No DELETE policy means no one can delete rows, which is what we want

-- Fix availability table policies to ensure partner coordination works
DROP POLICY IF EXISTS "Users can manage their own availability" ON public.availability;

-- Allow users to see their own availability and their partner's availability (read-only for partner)
CREATE POLICY "Users can view relevant availability" ON public.availability
    FOR SELECT USING (
        auth.uid() = user_id OR                              -- Own availability
        user_id = (SELECT partner_id FROM public.users WHERE id = auth.uid()) -- Partner's availability
    );

-- Users can only modify their own availability
CREATE POLICY "Users can manage their own availability" ON public.availability
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own availability" ON public.availability
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own availability" ON public.availability
    FOR DELETE USING (auth.uid() = user_id);

-- Ensure sessions table allows partner coordination
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;
DROP POLICY IF EXISTS "Users can create sessions they participate in" ON public.sessions;
DROP POLICY IF EXISTS "Users can update sessions they participate in" ON public.sessions;

-- Sessions: Allow users to see sessions they participate in
CREATE POLICY "Users can view their sessions" ON public.sessions
    FOR SELECT USING (auth.uid() = ANY(participants));

-- Allow creating sessions where user is a participant
CREATE POLICY "Users can create their sessions" ON public.sessions
    FOR INSERT WITH CHECK (auth.uid() = ANY(participants));

-- Allow updating sessions where user is a participant
CREATE POLICY "Users can update their sessions" ON public.sessions
    FOR UPDATE USING (auth.uid() = ANY(participants))
    WITH CHECK (auth.uid() = ANY(participants));

-- Optional: Allow deleting sessions (for cancellations)
CREATE POLICY "Users can delete their sessions" ON public.sessions
    FOR DELETE USING (auth.uid() = ANY(participants));

-- Add debugging function to test RLS policies
CREATE OR REPLACE FUNCTION debug_user_access(target_user_id uuid DEFAULT NULL)
RETURNS TABLE (
    check_type text,
    can_access boolean,
    current_user_id uuid,
    target_id uuid,
    explanation text
) 
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
    -- If no target specified, use current user
    IF target_user_id IS NULL THEN
        target_user_id := auth.uid();
    END IF;
    
    -- Test own profile access
    RETURN QUERY SELECT 
        'own_profile'::text,
        (auth.uid() = target_user_id),
        auth.uid(),
        target_user_id,
        'Can user access their own profile?'::text;
    
    -- Test partner profile access
    RETURN QUERY SELECT 
        'partner_profile'::text,
        EXISTS(
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND partner_id = target_user_id
        ),
        auth.uid(),
        target_user_id,
        'Can user access their partner profile?'::text;
    
    -- Test if target can access current user
    RETURN QUERY SELECT 
        'reverse_partner_access'::text,
        EXISTS(
            SELECT 1 FROM public.users 
            WHERE id = target_user_id 
            AND partner_id = auth.uid()
        ),
        auth.uid(),
        target_user_id,
        'Can target user access current user as partner?'::text;
        
    -- Test basic count query access
    RETURN QUERY SELECT 
        'count_query'::text,
        (
            SELECT COUNT(*) > 0 
            FROM public.users 
            WHERE auth.uid() = id OR auth.uid() = partner_id OR id = (
                SELECT partner_id FROM public.users WHERE id = auth.uid()
            )
        ),
        auth.uid(),
        target_user_id,
        'Can user perform count queries?'::text;
END;
$$;

-- Grant execute permission on debug function
GRANT EXECUTE ON FUNCTION debug_user_access TO authenticated;

-- Create a simple health check function that bypasses RLS for system checks
CREATE OR REPLACE FUNCTION system_health_check()
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    result json;
BEGIN
    SELECT json_build_object(
        'users_count', (SELECT COUNT(*) FROM public.users),
        'availability_count', (SELECT COUNT(*) FROM public.availability),
        'sessions_count', (SELECT COUNT(*) FROM public.sessions),
        'timestamp', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION system_health_check TO authenticated;

-- Add helpful comment for future reference
COMMENT ON POLICY "Users can view profiles they need access to" ON public.users IS 
'Allows users to see their own profile and their gym partner profile for coordination features';

COMMENT ON POLICY "Users can view relevant availability" ON public.availability IS 
'Allows users to see their own and their partner availability for gym session coordination';

-- Display success message
DO $$
BEGIN
    RAISE NOTICE '✅ RLS policies have been updated successfully!';
    RAISE NOTICE '🔧 Key improvements:';
    RAISE NOTICE '   • Users can now see their partner profiles';
    RAISE NOTICE '   • Count queries and health checks will work';
    RAISE NOTICE '   • Partner availability is visible for coordination';
    RAISE NOTICE '   • Added debug function: SELECT * FROM debug_user_access()';
    RAISE NOTICE '   • Added health check: SELECT system_health_check()';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  Test the application now - 400 errors should be resolved!';
END;
$$;