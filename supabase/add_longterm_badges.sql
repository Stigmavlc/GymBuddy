-- Add long-term achievement badges to complement existing short-term badges
-- Run this after the initial schema.sql

INSERT INTO public.badges (id, name, description, criteria, icon, category) VALUES
-- Long-term consistency badges
('quarter-master', 'Quarter Master', '3 months of dedication', '12+ consecutive weeks with 2+ sessions', '🏆', 'long-term'),
('half-year-hero', 'Half Year Hero', '6 months of consistency', '25+ consecutive weeks with 2+ sessions', '👑', 'long-term'),
('yearly-legend', 'Yearly Legend', 'A full year of training', '50+ consecutive weeks with 2+ sessions', '🎖️', 'long-term'),

-- High session count milestones
('century-club', 'Century Club', 'Join the 100 club', 'Complete 100 total sessions', '💪', 'milestone'),
('double-century', 'Double Century', 'Incredible dedication', 'Complete 200 total sessions', '🚀', 'milestone'),
('triple-digits', 'Triple Digits', 'Legendary commitment', 'Complete 300 total sessions', '⚡', 'milestone'),

-- Perfect attendance achievements
('workout-warrior', 'Workout Warrior', '6 months without missing a week', '25+ weeks with perfect attendance', '🛡️', 'achievement'),
('dedication-diamond', 'Dedication Diamond', 'Diamond-level commitment', '1 year with 90%+ attendance rate', '💎', 'achievement'),

-- Enhanced time-based achievements
('morning-champion', 'Morning Champion', 'Master of early workouts', 'Complete 25 sessions before 8 AM', '☀️', 'time'),
('night-champion', 'Night Champion', 'Evening workout master', 'Complete 25 sessions after 8 PM', '🌟', 'time'),

-- Perfect month achievements
('perfect-quarter', 'Perfect Quarter', '3 months of excellence', '3 consecutive months with 8+ sessions each', '🎯', 'achievement'),
('unstoppable', 'Unstoppable', 'Incredible consistency', '20+ consecutive weeks with 2+ sessions', '🔥', 'consistency');

-- Note: This complements the existing badges from schema.sql:
-- 'first-week', 'consistency-5', 'consistency-10', 'sessions-10', 'sessions-50', 
-- 'perfect-month', 'early-bird', 'night-owl'