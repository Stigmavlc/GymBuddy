-- ========================================
-- DEPLOYMENT VALIDATION QUERIES
-- ========================================
-- 
-- Run these queries after deploying the partner coordination system
-- to verify everything was installed correctly.
-- 
-- You can run these one by one in the Supabase SQL Editor to check
-- that your deployment was successful.
-- 
-- ========================================

-- ========================================
-- 1. CHECK THAT ALL TABLES WERE CREATED
-- ========================================

SELECT 
    'Tables Check:' as check_type,
    'SUCCESS - All partner coordination tables exist' as status
WHERE (
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states')
) = 4

UNION ALL

SELECT 
    'Tables Check:' as check_type,
    'ERROR - Missing tables: ' || string_agg(missing_table, ', ') as status
FROM (
    SELECT unnest(ARRAY['partner_requests', 'session_proposals', 'notifications', 'coordination_states']) as missing_table
    EXCEPT
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
) missing
WHERE EXISTS (SELECT 1 FROM missing);

-- ========================================
-- 2. CHECK THAT SESSIONS TABLE WAS ENHANCED
-- ========================================

SELECT 
    'Sessions Enhancement:' as check_type,
    'SUCCESS - Sessions table has new partner coordination columns' as status
WHERE (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sessions'
    AND column_name IN ('proposal_id', 'coordination_state_id', 'both_partners_confirmed')
) = 3

UNION ALL

SELECT 
    'Sessions Enhancement:' as check_type,
    'ERROR - Missing columns in sessions table' as status
WHERE (
    SELECT COUNT(*) 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'sessions'
    AND column_name IN ('proposal_id', 'coordination_state_id', 'both_partners_confirmed')
) < 3;

-- ========================================
-- 3. CHECK THAT RLS IS ENABLED
-- ========================================

SELECT 
    'RLS Check:' as check_type,
    'SUCCESS - Row Level Security enabled on all new tables' as status
WHERE (
    SELECT COUNT(*) 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states')
    AND c.relrowsecurity = true
) = 4

UNION ALL

SELECT 
    'RLS Check:' as check_type,
    'ERROR - RLS not enabled on some tables' as status
WHERE (
    SELECT COUNT(*) 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
    AND c.relname IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states')
    AND c.relrowsecurity = true
) < 4;

-- ========================================
-- 4. CHECK THAT POLICIES WERE CREATED
-- ========================================

SELECT 
    'Policies Check:' as check_type,
    'SUCCESS - ' || COUNT(*) || ' RLS policies created for partner coordination' as status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states')
HAVING COUNT(*) >= 16  -- Minimum expected number of policies

UNION ALL

SELECT 
    'Policies Check:' as check_type,
    'WARNING - Only ' || COUNT(*) || ' policies found (expected at least 16)' as status
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states')
HAVING COUNT(*) < 16;

-- ========================================
-- 5. CHECK THAT FUNCTIONS WERE CREATED
-- ========================================

SELECT 
    'Functions Check:' as check_type,
    'SUCCESS - All helper functions created' as status
WHERE (
    SELECT COUNT(*) 
    FROM information_schema.routines 
    WHERE routine_schema = 'public' 
    AND routine_name IN (
        'get_partner_relationship_status', 
        'ensure_coordination_state', 
        'verify_partner_relationship', 
        'can_coordinate_with_user',
        'update_coordination_proposals_count'
    )
) = 5

UNION ALL

SELECT 
    'Functions Check:' as check_type,
    'ERROR - Missing functions: ' || string_agg(missing_function, ', ') as status
FROM (
    SELECT unnest(ARRAY[
        'get_partner_relationship_status', 
        'ensure_coordination_state', 
        'verify_partner_relationship', 
        'can_coordinate_with_user',
        'update_coordination_proposals_count'
    ]) as missing_function
    EXCEPT
    SELECT routine_name 
    FROM information_schema.routines 
    WHERE routine_schema = 'public'
) missing
WHERE EXISTS (SELECT 1 FROM missing);

-- ========================================
-- 6. CHECK THAT INDEXES WERE CREATED
-- ========================================

SELECT 
    'Indexes Check:' as check_type,
    'SUCCESS - Performance indexes created' as status
WHERE (
    SELECT COUNT(*) 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%'
    AND (
        indexname LIKE 'idx_partner_requests_%' OR
        indexname LIKE 'idx_session_proposals_%' OR
        indexname LIKE 'idx_notifications_%' OR
        indexname LIKE 'idx_coordination_states_%'
    )
) >= 10  -- Minimum expected indexes

UNION ALL

SELECT 
    'Indexes Check:' as check_type,
    'WARNING - Only ' || COUNT(*) || ' partner coordination indexes found' as status
FROM pg_indexes 
WHERE schemaname = 'public' 
AND indexname LIKE 'idx_%'
AND (
    indexname LIKE 'idx_partner_requests_%' OR
    indexname LIKE 'idx_session_proposals_%' OR
    indexname LIKE 'idx_notifications_%' OR
    indexname LIKE 'idx_coordination_states_%'
)
HAVING COUNT(*) < 10;

-- ========================================
-- 7. CHECK TRIGGERS WERE CREATED
-- ========================================

SELECT 
    'Triggers Check:' as check_type,
    'SUCCESS - Automation triggers created' as status
WHERE EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_schema = 'public'
    AND trigger_name = 'update_coordination_states_updated_at'
) AND EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_schema = 'public'
    AND trigger_name = 'update_coordination_proposals_count_trigger'
)

UNION ALL

SELECT 
    'Triggers Check:' as check_type,
    'ERROR - Missing automation triggers' as status
WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_schema = 'public'
    AND trigger_name = 'update_coordination_states_updated_at'
) OR NOT EXISTS (
    SELECT 1 FROM information_schema.triggers 
    WHERE trigger_schema = 'public'
    AND trigger_name = 'update_coordination_proposals_count_trigger'
);

-- ========================================
-- 8. SUMMARY OF ALL TABLES AND COLUMNS
-- ========================================

SELECT 
    'Database Schema Summary:' as info_type,
    t.table_name,
    string_agg(c.column_name, ', ' ORDER BY c.ordinal_position) as columns
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name AND c.table_schema = t.table_schema
WHERE t.table_schema = 'public' 
AND t.table_name IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states')
GROUP BY t.table_name
ORDER BY t.table_name;

-- ========================================
-- 9. TEST BASIC FUNCTIONALITY
-- ========================================

-- Test that functions work (basic call)
SELECT 
    'Function Test:' as test_type,
    'get_partner_relationship_status() works' as test_name,
    CASE 
        WHEN public.get_partner_relationship_status(
            '00000000-0000-0000-0000-000000000000'::uuid, 
            '00000000-0000-0000-0000-000000000001'::uuid
        ) IS NOT NULL THEN 'SUCCESS'
        ELSE 'ERROR'
    END as result;

-- ========================================
-- 10. OVERALL DEPLOYMENT STATUS
-- ========================================

SELECT 
    'OVERALL STATUS:' as final_check,
    CASE 
        WHEN (
            -- All tables exist
            (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states')) = 4
            AND
            -- Sessions table enhanced
            (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name IN ('proposal_id', 'coordination_state_id', 'both_partners_confirmed')) = 3
            AND
            -- RLS enabled
            (SELECT COUNT(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relname IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states') AND c.relrowsecurity = true) = 4
            AND
            -- Functions exist
            (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public' AND routine_name IN ('get_partner_relationship_status', 'ensure_coordination_state', 'verify_partner_relationship', 'can_coordinate_with_user', 'update_coordination_proposals_count')) = 5
        ) THEN '🎉 DEPLOYMENT SUCCESSFUL! Partner coordination system is ready to use.'
        ELSE '⚠️  DEPLOYMENT INCOMPLETE - Some components may be missing. Check individual test results above.'
    END as status;

-- ========================================
-- QUICK REFERENCE: WHAT WAS CREATED
-- ========================================

SELECT 'Quick Reference:' as info;

SELECT 'New Tables Created:' as category, string_agg(table_name, ', ') as items
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states');

SELECT 'New Functions Created:' as category, string_agg(routine_name, ', ') as items
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('get_partner_relationship_status', 'ensure_coordination_state', 'verify_partner_relationship', 'can_coordinate_with_user', 'update_coordination_proposals_count');

SELECT 'Security Policies Created:' as category, COUNT(*) || ' policies across ' || COUNT(DISTINCT tablename) || ' tables' as items
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('partner_requests', 'session_proposals', 'notifications', 'coordination_states');