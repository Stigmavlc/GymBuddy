-- ============================================================================
-- RESTORE USER BADGES SCRIPT
-- ============================================================================
-- This script restores badges that users should have earned based on their
-- session history. Run this for specific users who lost their badges.
-- ============================================================================

-- Replace this with the actual user's email or ID
-- You can find this in the Supabase dashboard under Authentication > Users
DO $$
DECLARE
    v_user_id UUID;
    v_user_email TEXT := 'ivanaguilarmari@gmail.com'; -- CHANGE THIS TO TARGET USER
    v_total_sessions INTEGER;
    v_badge_count INTEGER := 0;
    v_restored_count INTEGER := 0;
BEGIN
    -- Get user ID from email
    SELECT id INTO v_user_id 
    FROM public.users 
    WHERE email = v_user_email;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE '❌ User not found with email: %', v_user_email;
        RETURN;
    END IF;
    
    RAISE NOTICE '🔍 Checking badges for user: % (ID: %)', v_user_email, v_user_id;
    
    -- Get user's total completed sessions
    SELECT COUNT(*) INTO v_total_sessions
    FROM public.sessions
    WHERE v_user_id = ANY(participants)
    AND status = 'completed';
    
    RAISE NOTICE '📊 User has % completed sessions', v_total_sessions;
    
    -- Check and restore "Getting Started" badge (first-week)
    -- User should have this if they have 2+ completed sessions
    IF v_total_sessions >= 2 THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_badges 
            WHERE user_id = v_user_id AND badge_id = 'first-week'
        ) THEN
            INSERT INTO public.user_badges (user_id, badge_id, unlocked_at)
            VALUES (v_user_id, 'first-week', NOW());
            
            RAISE NOTICE '✅ Restored badge: Getting Started';
            v_restored_count := v_restored_count + 1;
        ELSE
            RAISE NOTICE '✓ Already has: Getting Started';
        END IF;
    END IF;
    
    -- Check and restore "Double Digits" badge (sessions-10)
    IF v_total_sessions >= 10 THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_badges 
            WHERE user_id = v_user_id AND badge_id = 'sessions-10'
        ) THEN
            INSERT INTO public.user_badges (user_id, badge_id, unlocked_at)
            VALUES (v_user_id, 'sessions-10', NOW());
            
            RAISE NOTICE '✅ Restored badge: Double Digits';
            v_restored_count := v_restored_count + 1;
        ELSE
            RAISE NOTICE '✓ Already has: Double Digits';
        END IF;
    END IF;
    
    -- Check and restore "Half Century" badge (sessions-50)
    IF v_total_sessions >= 50 THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_badges 
            WHERE user_id = v_user_id AND badge_id = 'sessions-50'
        ) THEN
            INSERT INTO public.user_badges (user_id, badge_id, unlocked_at)
            VALUES (v_user_id, 'sessions-50', NOW());
            
            RAISE NOTICE '✅ Restored badge: Half Century';
            v_restored_count := v_restored_count + 1;
        ELSE
            RAISE NOTICE '✓ Already has: Half Century';
        END IF;
    END IF;
    
    -- Check and restore "Monthly Master" badge (perfect-month)
    -- User should have this if they had 8+ sessions in any month
    IF EXISTS (
        SELECT 1
        FROM public.sessions
        WHERE v_user_id = ANY(participants)
        AND status = 'completed'
        GROUP BY DATE_TRUNC('month', date)
        HAVING COUNT(*) >= 8
        LIMIT 1
    ) THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_badges 
            WHERE user_id = v_user_id AND badge_id = 'perfect-month'
        ) THEN
            INSERT INTO public.user_badges (user_id, badge_id, unlocked_at)
            VALUES (v_user_id, 'perfect-month', NOW());
            
            RAISE NOTICE '✅ Restored badge: Monthly Master';
            v_restored_count := v_restored_count + 1;
        ELSE
            RAISE NOTICE '✓ Already has: Monthly Master';
        END IF;
    END IF;
    
    -- Check and restore time-based badges
    -- Early Bird (5+ morning sessions before 8 AM)
    IF (
        SELECT COUNT(*) 
        FROM public.sessions
        WHERE v_user_id = ANY(participants)
        AND status = 'completed'
        AND start_time < 8
    ) >= 5 THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_badges 
            WHERE user_id = v_user_id AND badge_id = 'early-bird'
        ) THEN
            INSERT INTO public.user_badges (user_id, badge_id, unlocked_at)
            VALUES (v_user_id, 'early-bird', NOW());
            
            RAISE NOTICE '✅ Restored badge: Early Bird';
            v_restored_count := v_restored_count + 1;
        ELSE
            RAISE NOTICE '✓ Already has: Early Bird';
        END IF;
    END IF;
    
    -- Night Owl (5+ evening sessions after 8 PM)
    IF (
        SELECT COUNT(*) 
        FROM public.sessions
        WHERE v_user_id = ANY(participants)
        AND status = 'completed'
        AND start_time >= 20
    ) >= 5 THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.user_badges 
            WHERE user_id = v_user_id AND badge_id = 'night-owl'
        ) THEN
            INSERT INTO public.user_badges (user_id, badge_id, unlocked_at)
            VALUES (v_user_id, 'night-owl', NOW());
            
            RAISE NOTICE '✅ Restored badge: Night Owl';
            v_restored_count := v_restored_count + 1;
        ELSE
            RAISE NOTICE '✓ Already has: Night Owl';
        END IF;
    END IF;
    
    -- Count total badges user now has
    SELECT COUNT(*) INTO v_badge_count
    FROM public.user_badges
    WHERE user_id = v_user_id;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '📋 RESTORATION SUMMARY';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'User: %', v_user_email;
    RAISE NOTICE 'Badges restored: %', v_restored_count;
    RAISE NOTICE 'Total badges now: %', v_badge_count;
    RAISE NOTICE 'Total sessions: %', v_total_sessions;
    RAISE NOTICE '========================================';
    
END $$;

-- ============================================================================
-- VERIFY RESTORATION
-- ============================================================================

-- Show all badges for the user (change email as needed)
SELECT 
    u.email,
    u.name,
    b.name as badge_name,
    b.description,
    b.icon,
    ub.unlocked_at
FROM public.users u
JOIN public.user_badges ub ON u.id = ub.user_id
JOIN public.badges b ON ub.badge_id = b.id
WHERE u.email = 'ivanaguilarmari@gmail.com' -- CHANGE THIS TO TARGET USER
ORDER BY ub.unlocked_at DESC;

-- ============================================================================
-- ALTERNATIVE: RESTORE ALL USERS' BADGES
-- ============================================================================
-- Uncomment and run this section to restore badges for ALL users
/*
DO $$
DECLARE
    v_user RECORD;
    v_total_restored INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting badge restoration for all users...';
    
    FOR v_user IN SELECT id, email, name FROM public.users LOOP
        RAISE NOTICE 'Processing user: %', v_user.email;
        
        -- Call the restoration function for each user
        -- (You would need to create the function from fix_badge_system_rls.sql first)
        -- PERFORM restore_user_badges(v_user.id);
    END LOOP;
    
    RAISE NOTICE 'Badge restoration complete for all users';
END $$;
*/