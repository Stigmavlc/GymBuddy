-- Cleanup script for stale availability data in GymBuddy
-- Run this to fix phantom slot selections and sync issues

BEGIN;

-- Check current availability data
SELECT 
    'Before cleanup - Availability records:' as status,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users
FROM public.availability;

-- Show current availability by user
SELECT 
    u.name,
    u.email,
    COUNT(a.id) as availability_slots,
    array_agg(DISTINCT a.day ORDER BY a.day) as days_with_availability
FROM public.users u
LEFT JOIN public.availability a ON u.id = a.user_id
GROUP BY u.id, u.name, u.email
ORDER BY u.created_at;

-- Optional: Clean up any malformed or duplicate availability data
-- (Run this if you want to reset all availability data)
-- UNCOMMENT THE LINES BELOW IF YOU WANT TO CLEAR ALL AVAILABILITY:

/*
-- Remove all existing availability data
DELETE FROM public.availability;

-- Reset availability for fresh start
INSERT INTO public.availability (user_id, day, start_time, end_time) VALUES
-- Add any default availability here if needed
-- Example: ('user_id_here', 'monday', 9, 11);
*/

-- Check for any orphaned availability records (users that don't exist)
SELECT 
    'Orphaned availability records:' as status,
    COUNT(*) as count
FROM public.availability a 
WHERE NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = a.user_id
);

-- Clean up orphaned records
DELETE FROM public.availability a 
WHERE NOT EXISTS (
    SELECT 1 FROM public.users u WHERE u.id = a.user_id
);

-- Check for invalid time ranges
SELECT 
    'Invalid time ranges:' as status,
    COUNT(*) as count
FROM public.availability 
WHERE start_time >= end_time OR start_time < 0 OR end_time > 24;

-- Clean up invalid time ranges  
DELETE FROM public.availability 
WHERE start_time >= end_time OR start_time < 0 OR end_time > 24;

-- Final status
SELECT 
    'After cleanup - Availability records:' as status,
    COUNT(*) as total_records,
    COUNT(DISTINCT user_id) as unique_users
FROM public.availability;

COMMIT;

-- Log the cleanup completion
SELECT 'Cleanup completed successfully!' as message;