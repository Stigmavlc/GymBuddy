-- ============================================================================
-- FIX BADGE SYSTEM RLS POLICIES
-- ============================================================================
-- This script fixes the badge system that stopped working after RLS changes
-- 
-- PROBLEMS IDENTIFIED:
-- 1. Badges table needs public read access (authenticated users)
-- 2. User_badges policies may be too restrictive
-- 3. Badge initialization from app fails due to INSERT restrictions
-- 4. Missing service role policies for badge management
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: CLEAN UP EXISTING BADGE-RELATED POLICIES
-- ============================================================================

-- Drop all existing policies for badges table
DROP POLICY IF EXISTS "Anyone can read badges" ON public.badges;
DROP POLICY IF EXISTS "authenticated_users_can_read_badges" ON public.badges;
DROP POLICY IF EXISTS "service_role_full_access_badges" ON public.badges;
DROP POLICY IF EXISTS "Public can read badges" ON public.badges;
DROP POLICY IF EXISTS "Authenticated can read badges" ON public.badges;

-- Drop all existing policies for user_badges table
DROP POLICY IF EXISTS "Users can view their own badges" ON public.user_badges;
DROP POLICY IF EXISTS "users_can_view_own_badges" ON public.user_badges;
DROP POLICY IF EXISTS "System can award badges" ON public.user_badges;
DROP POLICY IF EXISTS "authenticated_users_can_insert_badges" ON public.user_badges;
DROP POLICY IF EXISTS "service_role_full_access_user_badges" ON public.user_badges;
DROP POLICY IF EXISTS "Users can manage own badges" ON public.user_badges;

-- ============================================================================
-- STEP 2: CREATE PROPER POLICIES FOR BADGES TABLE
-- ============================================================================

-- Service role needs full access for backend operations
CREATE POLICY "service_role_badges_all" ON public.badges
    FOR ALL 
    USING (auth.role() = 'service_role');

-- ALL authenticated users should be able to read available badges
-- This is critical for the badge system to work!
CREATE POLICY "authenticated_read_badges" ON public.badges
    FOR SELECT 
    USING (true);  -- No restriction - all badges are public information

-- Allow authenticated users to check if badges exist (for initialization)
CREATE POLICY "authenticated_insert_badges" ON public.badges
    FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================================================
-- STEP 3: CREATE PROPER POLICIES FOR USER_BADGES TABLE
-- ============================================================================

-- Service role needs full access
CREATE POLICY "service_role_user_badges_all" ON public.user_badges
    FOR ALL 
    USING (auth.role() = 'service_role');

-- Users can view their own badges
CREATE POLICY "users_select_own_badges" ON public.user_badges
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Users can be awarded badges (INSERT only their own)
CREATE POLICY "users_insert_own_badges" ON public.user_badges
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Users cannot update or delete badges once earned
-- (No UPDATE or DELETE policies for regular users)

-- ============================================================================
-- STEP 4: ENSURE BADGES ARE PROPERLY INITIALIZED
-- ============================================================================

-- Check if badges exist, if not, insert them
DO $$
BEGIN
    -- Check if we have badges
    IF NOT EXISTS (SELECT 1 FROM public.badges LIMIT 1) THEN
        RAISE NOTICE 'No badges found, initializing default badges...';
        
        -- Insert all default badges
        INSERT INTO public.badges (id, name, description, criteria, icon, category) VALUES
        -- Progress badges
        ('first-week', 'Getting Started', 'Complete your first week of workouts', 'Complete first week with 2 sessions', '🎯', 'progress'),
        
        -- Consistency badges
        ('consistency-5', 'Steady Gains', 'Maintain consistency for 5 weeks', '5 consecutive weeks with 2+ sessions each', '📈', 'consistency'),
        ('consistency-10', 'Iron Will', 'Show dedication for 10 weeks', '10 consecutive weeks with 2+ sessions each', '🔥', 'consistency'),
        ('unstoppable', 'Unstoppable Force', 'Amazing consistency streak', '20 consecutive weeks with 2+ sessions each', '⚡', 'consistency'),
        ('quarter-master', 'Quarter Master', 'Three months of dedication', '12 consecutive weeks with 2+ sessions each', '🏆', 'consistency'),
        ('half-year-hero', 'Half Year Hero', 'Six months of commitment', '25 consecutive weeks with 2+ sessions each', '🌟', 'consistency'),
        ('yearly-legend', 'Yearly Legend', 'A full year of dedication', '50 consecutive weeks with 2+ sessions each', '👑', 'consistency'),
        
        -- Milestone badges
        ('sessions-10', 'Double Digits', 'Reach your first milestone', 'Complete 10 total gym sessions', '🎲', 'milestone'),
        ('sessions-50', 'Half Century', 'Major achievement unlocked', 'Complete 50 total gym sessions', '💯', 'milestone'),
        ('century-club', 'Century Club', 'Join the elite 100 club', 'Complete 100 total gym sessions', '💎', 'milestone'),
        ('double-century', 'Double Century', 'Elite performer status', 'Complete 200 total gym sessions', '🚀', 'milestone'),
        ('triple-digits', 'Triple Digits Champion', 'Ultimate dedication', 'Complete 300 total gym sessions', '🏅', 'milestone'),
        
        -- Time-based badges
        ('early-bird', 'Early Bird', 'Morning warrior dedication', 'Complete 5 sessions before 8 AM', '🌅', 'time'),
        ('morning-champion', 'Morning Champion', 'Master of morning workouts', 'Complete 25 sessions before 8 AM', '☀️', 'time'),
        ('night-owl', 'Night Owl', 'Evening athlete dedication', 'Complete 5 sessions after 8 PM', '🌙', 'time'),
        ('night-champion', 'Night Champion', 'Master of evening workouts', 'Complete 25 sessions after 8 PM', '🌃', 'time'),
        
        -- Achievement badges
        ('perfect-month', 'Monthly Master', 'Excel in a single month', 'Complete 8+ sessions in any month', '📅', 'achievement'),
        ('perfect-quarter', 'Quarterly Champion', 'Three months of excellence', '3 consecutive months with 8+ sessions each', '📊', 'achievement')
        
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Default badges initialized successfully';
    ELSE
        RAISE NOTICE 'Badges already exist in database';
    END IF;
END $$;

-- ============================================================================
-- STEP 5: RESTORE MISSING USER BADGES
-- ============================================================================

-- Function to check and award badges retroactively
CREATE OR REPLACE FUNCTION restore_user_badges(p_user_id UUID)
RETURNS TABLE(badge_id TEXT, badge_name TEXT, newly_awarded BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_sessions INTEGER;
    v_current_streak INTEGER;
    v_badge RECORD;
BEGIN
    -- Get user's session stats
    SELECT COUNT(*) INTO v_total_sessions
    FROM public.sessions
    WHERE p_user_id = ANY(participants)
    AND status = 'completed';
    
    -- For each badge, check if user should have it
    FOR v_badge IN SELECT * FROM public.badges LOOP
        -- Check if user already has this badge
        IF NOT EXISTS (
            SELECT 1 FROM public.user_badges 
            WHERE user_id = p_user_id AND user_badges.badge_id = v_badge.id
        ) THEN
            -- Check if user qualifies for this badge
            -- (Simplified logic - you may need to adjust based on actual criteria)
            
            -- Getting Started badge (first week)
            IF v_badge.id = 'first-week' AND v_total_sessions >= 2 THEN
                INSERT INTO public.user_badges (user_id, badge_id)
                VALUES (p_user_id, v_badge.id)
                ON CONFLICT DO NOTHING;
                
                RETURN QUERY SELECT v_badge.id, v_badge.name, true;
            END IF;
            
            -- Monthly Master (8+ sessions in a month)
            IF v_badge.id = 'perfect-month' THEN
                -- Check if user had 8+ sessions in any month
                IF EXISTS (
                    SELECT 1
                    FROM public.sessions
                    WHERE p_user_id = ANY(participants)
                    AND status = 'completed'
                    GROUP BY DATE_TRUNC('month', date)
                    HAVING COUNT(*) >= 8
                    LIMIT 1
                ) THEN
                    INSERT INTO public.user_badges (user_id, badge_id)
                    VALUES (p_user_id, v_badge.id)
                    ON CONFLICT DO NOTHING;
                    
                    RETURN QUERY SELECT v_badge.id, v_badge.name, true;
                END IF;
            END IF;
            
            -- Double Digits (10 sessions)
            IF v_badge.id = 'sessions-10' AND v_total_sessions >= 10 THEN
                INSERT INTO public.user_badges (user_id, badge_id)
                VALUES (p_user_id, v_badge.id)
                ON CONFLICT DO NOTHING;
                
                RETURN QUERY SELECT v_badge.id, v_badge.name, true;
            END IF;
            
            -- Half Century (50 sessions)
            IF v_badge.id = 'sessions-50' AND v_total_sessions >= 50 THEN
                INSERT INTO public.user_badges (user_id, badge_id)
                VALUES (p_user_id, v_badge.id)
                ON CONFLICT DO NOTHING;
                
                RETURN QUERY SELECT v_badge.id, v_badge.name, true;
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- ============================================================================
-- STEP 6: GRANT PROPER PERMISSIONS
-- ============================================================================

-- Ensure anon and authenticated roles have proper access
GRANT SELECT ON public.badges TO anon, authenticated;
GRANT SELECT ON public.user_badges TO authenticated;
GRANT INSERT ON public.user_badges TO authenticated;

-- ============================================================================
-- STEP 7: VERIFICATION QUERIES
-- ============================================================================

-- Verify policies are in place
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    -- Check badges policies
    SELECT COUNT(*) INTO v_count
    FROM pg_policies 
    WHERE tablename = 'badges' AND schemaname = 'public';
    RAISE NOTICE 'Badges table has % policies', v_count;
    
    -- Check user_badges policies
    SELECT COUNT(*) INTO v_count
    FROM pg_policies 
    WHERE tablename = 'user_badges' AND schemaname = 'public';
    RAISE NOTICE 'User_badges table has % policies', v_count;
    
    -- Check if badges exist
    SELECT COUNT(*) INTO v_count FROM public.badges;
    RAISE NOTICE 'Database contains % badges', v_count;
END $$;

-- Test query to ensure badges can be read
-- This should work for any authenticated user
SELECT 
    'Badge system test' as test_name,
    COUNT(*) as badge_count,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ PASS - Badges are readable'
        ELSE '❌ FAIL - No badges found'
    END as result
FROM public.badges;

COMMIT;

-- ============================================================================
-- POST-DEPLOYMENT VERIFICATION
-- ============================================================================
-- After running this script, test the following:
--
-- 1. As an authenticated user, run:
--    SELECT * FROM badges;
--    -- Should return all badges
--
-- 2. As an authenticated user, run:
--    SELECT * FROM user_badges WHERE user_id = auth.uid();
--    -- Should return user's badges
--
-- 3. Test badge initialization from the app:
--    - Clear browser cache
--    - Reload the dashboard
--    - Check browser console for badge loading logs
--
-- 4. To restore missing badges for a specific user:
--    SELECT * FROM restore_user_badges('user-uuid-here');
--
-- ============================================================================