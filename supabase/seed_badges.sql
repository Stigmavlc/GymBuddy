-- Seed complete badge data for GymBuddy
-- This will ensure all badges referenced in badgeService.ts are available

-- Clear any existing badges first
DELETE FROM public.user_badges;
DELETE FROM public.badges;

-- Insert comprehensive badge definitions
INSERT INTO public.badges (id, name, description, criteria, icon, category) VALUES

-- Progress Badges
('first-week', 'Getting Started', 'Complete your first week of workouts', 'Complete first week with 2 sessions', '🎯', 'progress'),

-- Consistency Badges
('consistency-5', 'Steady Gains', 'Maintain consistency for 5 weeks', '5 consecutive weeks with 2+ sessions each', '📈', 'consistency'),
('consistency-10', 'Iron Will', 'Show dedication for 10 weeks', '10 consecutive weeks with 2+ sessions each', '🔥', 'consistency'),
('unstoppable', 'Unstoppable Force', 'Amazing consistency streak', '20 consecutive weeks with 2+ sessions each', '⚡', 'consistency'),
('quarter-master', 'Quarter Master', 'Three months of dedication', '12 consecutive weeks with 2+ sessions each', '🏆', 'consistency'),
('half-year-hero', 'Half Year Hero', 'Six months of commitment', '25 consecutive weeks with 2+ sessions each', '🌟', 'consistency'),
('yearly-legend', 'Yearly Legend', 'A full year of dedication', '50 consecutive weeks with 2+ sessions each', '👑', 'consistency'),

-- Session Milestone Badges
('sessions-10', 'Double Digits', 'Reach your first milestone', 'Complete 10 total gym sessions', '🎲', 'milestone'),
('sessions-50', 'Half Century', 'Major achievement unlocked', 'Complete 50 total gym sessions', '💯', 'milestone'),
('century-club', 'Century Club', 'Join the elite 100 club', 'Complete 100 total gym sessions', '💎', 'milestone'),
('double-century', 'Double Century', 'Elite performer status', 'Complete 200 total gym sessions', '🚀', 'milestone'),
('triple-digits', 'Triple Digits Champion', 'Ultimate dedication', 'Complete 300 total gym sessions', '🏅', 'milestone'),

-- Time-based Badges
('early-bird', 'Early Bird', 'Morning warrior dedication', 'Complete 5 sessions before 8 AM', '🌅', 'time'),
('morning-champion', 'Morning Champion', 'Master of morning workouts', 'Complete 25 sessions before 8 AM', '☀️', 'time'),
('night-owl', 'Night Owl', 'Evening athlete dedication', 'Complete 5 sessions after 8 PM', '🌙', 'time'),
('night-champion', 'Night Champion', 'Master of evening workouts', 'Complete 25 sessions after 8 PM', '🌃', 'time'),

-- Monthly Achievement Badges
('perfect-month', 'Monthly Master', 'Excel in a single month', 'Complete 8+ sessions in any month', '📅', 'achievement'),
('perfect-quarter', 'Quarterly Champion', 'Three months of excellence', '3 consecutive months with 8+ sessions each', '📊', 'achievement');

-- Log successful seeding
SELECT 
    'Badges seeded successfully!' as message,
    COUNT(*) as total_badges 
FROM public.badges;