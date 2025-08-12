-- ============================================================================
-- BADGE SYSTEM DIAGNOSTIC SCRIPT
-- ============================================================================
-- Run this script to diagnose badge system issues
-- Execute each section separately to identify problems
-- ============================================================================

-- ============================================================================
-- SECTION 1: CHECK RLS STATUS
-- ============================================================================
SELECT 
    'RLS Status Check' as diagnostic_section,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS Disabled'
    END as status
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('badges', 'user_badges')
ORDER BY tablename;

-- ============================================================================
-- SECTION 2: CHECK EXISTING POLICIES
-- ============================================================================
SELECT 
    'Current Policies' as diagnostic_section,
    tablename,
    policyname,
    cmd as operation,
    qual as using_expression,
    with_check as check_expression
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('badges', 'user_badges')
ORDER BY tablename, policyname;

-- ============================================================================
-- SECTION 3: CHECK BADGE DATA
-- ============================================================================
SELECT 
    'Badge Data Check' as diagnostic_section,
    COUNT(*) as total_badges,
    COUNT(DISTINCT category) as categories,
    STRING_AGG(DISTINCT category, ', ') as category_list
FROM public.badges;

-- List all badges
SELECT 
    'Available Badges' as diagnostic_section,
    id,
    name,
    category,
    icon
FROM public.badges
ORDER BY category, name;

-- ============================================================================
-- SECTION 4: CHECK USER BADGES
-- ============================================================================
-- Replace 'YOUR_USER_ID' with actual user UUID to check specific user
SELECT 
    'User Badge Check' as diagnostic_section,
    u.email,
    u.name,
    COUNT(ub.badge_id) as badges_earned,
    STRING_AGG(b.name, ', ' ORDER BY ub.unlocked_at) as badge_names
FROM public.users u
LEFT JOIN public.user_badges ub ON u.id = ub.user_id
LEFT JOIN public.badges b ON ub.badge_id = b.id
GROUP BY u.id, u.email, u.name
ORDER BY badges_earned DESC;

-- ============================================================================
-- SECTION 5: CHECK PERMISSIONS
-- ============================================================================
SELECT 
    'Permission Check' as diagnostic_section,
    grantee,
    table_name,
    privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
AND table_name IN ('badges', 'user_badges')
AND grantee IN ('anon', 'authenticated', 'service_role')
ORDER BY table_name, grantee, privilege_type;

-- ============================================================================
-- SECTION 6: TEST BADGE QUERIES AS AUTHENTICATED USER
-- ============================================================================
-- These queries simulate what the application tries to do

-- Test 1: Can we read badges? (Should work for authenticated users)
DO $$
BEGIN
    PERFORM * FROM public.badges LIMIT 1;
    RAISE NOTICE '✅ Badge read test PASSED';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Badge read test FAILED: %', SQLERRM;
END $$;

-- Test 2: Can we count badges? (Used by initialization check)
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM public.badges;
    RAISE NOTICE '✅ Badge count test PASSED: % badges found', v_count;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ Badge count test FAILED: %', SQLERRM;
END $$;

-- ============================================================================
-- SECTION 7: CHECK FOR COMMON ISSUES
-- ============================================================================
WITH diagnostics AS (
    SELECT 
        (SELECT COUNT(*) FROM public.badges) as badge_count,
        (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'badges' AND schemaname = 'public') as badge_policies,
        (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'user_badges' AND schemaname = 'public') as user_badge_policies,
        (SELECT rowsecurity FROM pg_tables WHERE tablename = 'badges' AND schemaname = 'public') as badges_rls,
        (SELECT rowsecurity FROM pg_tables WHERE tablename = 'user_badges' AND schemaname = 'public') as user_badges_rls
)
SELECT 
    'Issue Analysis' as diagnostic_section,
    CASE 
        WHEN badge_count = 0 THEN '❌ CRITICAL: No badges in database'
        WHEN badge_count < 10 THEN '⚠️ WARNING: Only ' || badge_count || ' badges (expected 18+)'
        ELSE '✅ Badge count OK: ' || badge_count
    END as badge_status,
    CASE 
        WHEN NOT badges_rls THEN '❌ CRITICAL: RLS disabled on badges table'
        WHEN badge_policies = 0 THEN '❌ CRITICAL: No policies on badges table'
        WHEN badge_policies < 2 THEN '⚠️ WARNING: Only ' || badge_policies || ' policies on badges'
        ELSE '✅ Badge policies OK: ' || badge_policies
    END as badge_policy_status,
    CASE 
        WHEN NOT user_badges_rls THEN '❌ CRITICAL: RLS disabled on user_badges table'
        WHEN user_badge_policies = 0 THEN '❌ CRITICAL: No policies on user_badges table'
        WHEN user_badge_policies < 2 THEN '⚠️ WARNING: Only ' || user_badge_policies || ' policies on user_badges'
        ELSE '✅ User badge policies OK: ' || user_badge_policies
    END as user_badge_policy_status
FROM diagnostics;

-- ============================================================================
-- SECTION 8: CHECK SESSION DATA FOR BADGE ELIGIBILITY
-- ============================================================================
-- Check if users should have earned badges based on their sessions
WITH user_stats AS (
    SELECT 
        u.id,
        u.email,
        u.name,
        COUNT(DISTINCT s.id) FILTER (WHERE s.status = 'completed') as completed_sessions,
        COUNT(DISTINCT DATE_TRUNC('week', s.date)) FILTER (WHERE s.status = 'completed') as weeks_with_sessions,
        MAX(DATE_TRUNC('month', s.date)) FILTER (WHERE s.status = 'completed') as last_session_month
    FROM public.users u
    LEFT JOIN public.sessions s ON u.id = ANY(s.participants)
    GROUP BY u.id, u.email, u.name
)
SELECT 
    'Badge Eligibility Check' as diagnostic_section,
    email,
    name,
    completed_sessions,
    weeks_with_sessions,
    CASE 
        WHEN completed_sessions >= 2 THEN '✅ Eligible for: Getting Started'
        ELSE '❌ Not eligible for Getting Started (need 2 sessions)'
    END as getting_started_status,
    CASE 
        WHEN completed_sessions >= 10 THEN '✅ Eligible for: Double Digits'
        WHEN completed_sessions >= 2 THEN '⏳ Progress: ' || completed_sessions || '/10 sessions'
        ELSE '❌ Not started'
    END as double_digits_status
FROM user_stats
WHERE completed_sessions > 0
ORDER BY completed_sessions DESC;

-- ============================================================================
-- SUMMARY RECOMMENDATIONS
-- ============================================================================
SELECT 
    'Recommended Actions' as diagnostic_section,
    '1. Run fix_badge_system_rls.sql to fix RLS policies' as action_1,
    '2. Clear browser cache and localStorage' as action_2,
    '3. Check browser console for specific errors' as action_3,
    '4. Verify VITE_SUPABASE_ANON_KEY is correct' as action_4,
    '5. Test with a fresh login session' as action_5;