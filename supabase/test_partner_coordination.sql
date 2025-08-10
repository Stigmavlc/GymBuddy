-- ========================================
-- PARTNER COORDINATION SYSTEM - TEST DATA
-- ========================================
-- 
-- This script creates sample test data to verify that the partner
-- coordination system is working properly.
-- 
-- IMPORTANT: Only run this AFTER you have deployed the main schema
-- and it has passed the validation tests.
-- 
-- This will create test data for Ivan and Youssef to test partner coordination.
-- 
-- ========================================

-- ========================================
-- STEP 1: VERIFY USERS EXIST
-- ========================================

-- Check if Ivan and Youssef exist in the database
SELECT 
    'User Check:' as test_type,
    CASE 
        WHEN COUNT(*) >= 1 THEN 'SUCCESS - Ivan found in database'
        ELSE 'ERROR - Ivan not found. Make sure he has signed up.'
    END as ivan_status
FROM public.users 
WHERE email = 'ivanaguilarmari@gmail.com';

SELECT 
    'User Check:' as test_type,
    CASE 
        WHEN COUNT(*) >= 1 THEN 'SUCCESS - Youssef found in database'  
        ELSE 'WARNING - Youssef not found. He may need to sign up first.'
    END as youssef_status
FROM public.users 
WHERE email LIKE '%youssef%' OR name ILIKE '%youssef%';

-- Show all users to help identify Youssef's email
SELECT 
    'All Users:' as info,
    id, name, email, partner_id
FROM public.users 
ORDER BY created_at DESC;

-- ========================================
-- STEP 2: CREATE PARTNER RELATIONSHIP (IVAN + YOUSSEF)
-- ========================================

-- First, let's get Ivan's user ID
DO $$
DECLARE
    ivan_id UUID;
    youssef_id UUID;
    existing_request UUID;
BEGIN
    -- Get Ivan's ID
    SELECT id INTO ivan_id 
    FROM public.users 
    WHERE email = 'ivanaguilarmari@gmail.com';
    
    IF ivan_id IS NULL THEN
        RAISE NOTICE 'ERROR: Ivan not found in database. Make sure he has signed up.';
        RETURN;
    END IF;
    
    -- Try to find Youssef (you may need to update this email)
    -- For now, we'll create a placeholder partner request
    
    RAISE NOTICE 'Ivan ID found: %', ivan_id;
    RAISE NOTICE 'To create partner relationship, you need to:';
    RAISE NOTICE '1. Get Youssefs exact email from the users table above';
    RAISE NOTICE '2. Update this script with the correct email';
    RAISE NOTICE '3. Re-run this section';
END $$;

-- ========================================  
-- STEP 3: CREATE SAMPLE AVAILABILITY DATA
-- ========================================

-- Create some sample availability for Ivan (if it doesn't exist)
INSERT INTO public.availability (user_id, day, start_time, end_time)
SELECT 
    u.id,
    day_name,
    start_slot,
    end_slot
FROM public.users u
CROSS JOIN (
    VALUES 
    ('monday', 16, 20),    -- 8 AM - 10 AM  
    ('monday', 32, 36),    -- 4 PM - 6 PM
    ('tuesday', 18, 22),   -- 9 AM - 11 AM
    ('wednesday', 16, 20), -- 8 AM - 10 AM
    ('wednesday', 32, 36), -- 4 PM - 6 PM  
    ('thursday', 18, 22),  -- 9 AM - 11 AM
    ('friday', 16, 20),    -- 8 AM - 10 AM
    ('saturday', 20, 24),  -- 10 AM - 12 PM
    ('sunday', 22, 26)     -- 11 AM - 1 PM
) AS sample_times(day_name, start_slot, end_slot)
WHERE u.email = 'ivanaguilarmari@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM public.availability a 
    WHERE a.user_id = u.id 
    AND a.day = day_name 
    AND a.start_time = start_slot
);

-- Show Ivan's availability
SELECT 
    'Ivans Availability:' as info,
    day,
    CASE 
        WHEN start_time < 24 THEN (start_time / 2) || ':' || CASE WHEN start_time % 2 = 0 THEN '00' ELSE '30' END
        ELSE ((start_time - 24) / 2) || ':' || CASE WHEN start_time % 2 = 0 THEN '00' ELSE '30' END || ' PM'
    END as start_time_formatted,
    CASE 
        WHEN end_time < 24 THEN (end_time / 2) || ':' || CASE WHEN end_time % 2 = 0 THEN '00' ELSE '30' END
        ELSE ((end_time - 24) / 2) || ':' || CASE WHEN end_time % 2 = 0 THEN '00' ELSE '30' END || ' PM'
    END as end_time_formatted
FROM public.availability a
JOIN public.users u ON a.user_id = u.id
WHERE u.email = 'ivanaguilarmari@gmail.com'
ORDER BY 
    CASE day 
        WHEN 'monday' THEN 1 
        WHEN 'tuesday' THEN 2 
        WHEN 'wednesday' THEN 3 
        WHEN 'thursday' THEN 4 
        WHEN 'friday' THEN 5 
        WHEN 'saturday' THEN 6 
        WHEN 'sunday' THEN 7 
    END,
    start_time;

-- ========================================
-- STEP 4: TEST PARTNER REQUEST WORKFLOW
-- ========================================

-- Create a sample partner request (Ivan to Youssef)
-- NOTE: Update with Youssef's actual user ID once you find it
/*
DO $$
DECLARE
    ivan_id UUID;
    youssef_id UUID;
    request_id UUID;
BEGIN
    -- Get user IDs
    SELECT id INTO ivan_id FROM public.users WHERE email = 'ivanaguilarmari@gmail.com';
    SELECT id INTO youssef_id FROM public.users WHERE email = 'YOUSSEF_EMAIL_HERE'; -- UPDATE THIS
    
    IF ivan_id IS NULL OR youssef_id IS NULL THEN
        RAISE NOTICE 'Both users must exist before creating partner request';
        RETURN;
    END IF;
    
    -- Create partner request
    INSERT INTO public.partner_requests (requester_id, requested_user_id, message)
    VALUES (ivan_id, youssef_id, 'Hey! Want to be gym partners and coordinate our workouts?')
    RETURNING id INTO request_id;
    
    RAISE NOTICE 'Partner request created with ID: %', request_id;
    
    -- Auto-accept the request for testing
    UPDATE public.partner_requests 
    SET status = 'accepted', responded_at = NOW()
    WHERE id = request_id;
    
    -- Update user partner relationships
    UPDATE public.users SET partner_id = youssef_id WHERE id = ivan_id;
    UPDATE public.users SET partner_id = ivan_id WHERE id = youssef_id;
    
    -- Create coordination state
    INSERT INTO public.coordination_states (partner_1_id, partner_2_id, state)
    VALUES (LEAST(ivan_id, youssef_id), GREATEST(ivan_id, youssef_id), 'waiting_availability');
    
    RAISE NOTICE 'Partner relationship established and coordination state created';
END $$;
*/

-- ========================================
-- STEP 5: TEST SESSION PROPOSAL WORKFLOW
-- ========================================

-- Create a sample session proposal
-- NOTE: This will only work after partner relationship is established
/*
DO $$
DECLARE
    ivan_id UUID;
    youssef_id UUID;
    proposal_id UUID;
BEGIN
    SELECT id INTO ivan_id FROM public.users WHERE email = 'ivanaguilarmari@gmail.com';
    SELECT partner_id INTO youssef_id FROM public.users WHERE email = 'ivanaguilarmari@gmail.com';
    
    IF ivan_id IS NULL OR youssef_id IS NULL THEN
        RAISE NOTICE 'Partner relationship must be established first';
        RETURN;
    END IF;
    
    -- Create session proposal for next Monday 8-10 AM
    INSERT INTO public.session_proposals (
        proposer_id, 
        partner_id, 
        proposed_date, 
        proposed_start_time, 
        proposed_end_time
    ) VALUES (
        ivan_id,
        youssef_id,
        CURRENT_DATE + (7 - EXTRACT(dow FROM CURRENT_DATE) + 1)::integer, -- Next Monday
        16, -- 8 AM
        20  -- 10 AM
    ) RETURNING id INTO proposal_id;
    
    RAISE NOTICE 'Session proposal created with ID: %', proposal_id;
END $$;
*/

-- ========================================
-- STEP 6: TEST NOTIFICATION SYSTEM
-- ========================================

-- Create sample notifications for Ivan
INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    data
)
SELECT 
    u.id,
    'availability_coordination_ready',
    'Ready for Coordination!',
    'You and your partner both have availability set. The system can now suggest optimal workout sessions.',
    '{"partner_name": "Youssef", "coordination_ready": true}'::jsonb
FROM public.users u
WHERE u.email = 'ivanaguilarmari@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM public.notifications n 
    WHERE n.user_id = u.id 
    AND n.type = 'availability_coordination_ready'
);

-- ========================================
-- STEP 7: TEST HELPER FUNCTIONS
-- ========================================

-- Test the partner relationship function
SELECT 
    'Function Test:' as test_type,
    'get_partner_relationship_status',
    public.get_partner_relationship_status(
        (SELECT id FROM public.users WHERE email = 'ivanaguilarmari@gmail.com'),
        (SELECT id FROM public.users WHERE email = 'ivanaguilarmari@gmail.com') -- Same user should return 'none'
    ) as result;

-- Test coordination state function
SELECT 
    'Function Test:' as test_type,
    'ensure_coordination_state works' as test_name,
    CASE 
        WHEN public.ensure_coordination_state(
            '00000000-0000-0000-0000-000000000000'::uuid,
            '00000000-0000-0000-0000-000000000001'::uuid
        ) IS NOT NULL THEN 'SUCCESS'
        ELSE 'ERROR'
    END as result;

-- ========================================
-- STEP 8: SHOW TEST DATA SUMMARY
-- ========================================

-- Show all partner requests
SELECT 
    'Partner Requests:' as info,
    pr.*,
    u1.name as requester_name,
    u2.name as requested_user_name
FROM public.partner_requests pr
LEFT JOIN public.users u1 ON pr.requester_id = u1.id
LEFT JOIN public.users u2 ON pr.requested_user_id = u2.id
ORDER BY pr.created_at DESC;

-- Show all coordination states
SELECT 
    'Coordination States:' as info,
    cs.*,
    u1.name as partner_1_name,
    u2.name as partner_2_name
FROM public.coordination_states cs
LEFT JOIN public.users u1 ON cs.partner_1_id = u1.id
LEFT JOIN public.users u2 ON cs.partner_2_id = u2.id
ORDER BY cs.created_at DESC;

-- Show all session proposals
SELECT 
    'Session Proposals:' as info,
    sp.*,
    u1.name as proposer_name,
    u2.name as partner_name
FROM public.session_proposals sp
LEFT JOIN public.users u1 ON sp.proposer_id = u1.id
LEFT JOIN public.users u2 ON sp.partner_id = u2.id
ORDER BY sp.created_at DESC;

-- Show notifications for Ivan
SELECT 
    'Ivan Notifications:' as info,
    n.*
FROM public.notifications n
JOIN public.users u ON n.user_id = u.id
WHERE u.email = 'ivanaguilarmari@gmail.com'
ORDER BY n.created_at DESC;

-- Show partner relationships
SELECT 
    'Partner Relationships:' as info,
    u1.name as user_name,
    u1.email as user_email,
    u2.name as partner_name,
    u2.email as partner_email,
    CASE 
        WHEN u1.partner_id IS NOT NULL AND u2.partner_id = u1.id THEN 'MUTUAL PARTNERS'
        WHEN u1.partner_id IS NOT NULL THEN 'ONE-WAY PARTNER LINK'
        ELSE 'NO PARTNER'
    END as relationship_status
FROM public.users u1
LEFT JOIN public.users u2 ON u1.partner_id = u2.id
ORDER BY u1.created_at DESC;

-- ========================================
-- STEP 9: CLEANUP (OPTIONAL)
-- ========================================

-- Uncomment these to clean up test data:
-- DELETE FROM public.notifications WHERE type = 'availability_coordination_ready';
-- DELETE FROM public.session_proposals WHERE proposer_id IN (SELECT id FROM public.users WHERE email = 'ivanaguilarmari@gmail.com');
-- DELETE FROM public.partner_requests WHERE requester_id IN (SELECT id FROM public.users WHERE email = 'ivanaguilarmari@gmail.com');
-- DELETE FROM public.coordination_states WHERE partner_1_id IN (SELECT id FROM public.users WHERE email = 'ivanaguilarmari@gmail.com') OR partner_2_id IN (SELECT id FROM public.users WHERE email = 'ivanaguilarmari@gmail.com');
-- UPDATE public.users SET partner_id = NULL WHERE email = 'ivanaguilarmari@gmail.com';

-- ========================================
-- TEST COMPLETE
-- ========================================

SELECT 
    '🧪 TEST DATA CREATED' as status,
    'Partner coordination system test data has been created successfully!' as message;

SELECT 
    'Next Steps:' as info,
    'To complete the partner coordination setup:' as step_1,
    '1. Find Youssefs exact email in the users table above' as step_2,
    '2. Update the commented sections in this script with his email' as step_3,
    '3. Uncomment and run those sections to create the full partner relationship' as step_4,
    '4. Test the API endpoints with the new data' as step_5,
    '5. Deploy the enhanced Telegram bot to use these features' as step_6;