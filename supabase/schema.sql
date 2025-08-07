-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    avatar TEXT,
    phone_number TEXT,
    partner_id UUID REFERENCES public.users(id),
    preferences JSONB DEFAULT '{
        "notifications": {
            "sms": true,
            "push": true,
            "reminder_time": 30
        }
    }'::jsonb,
    stats JSONB DEFAULT '{
        "total_sessions": 0,
        "current_streak": 0,
        "badges": []
    }'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Availability table
CREATE TABLE public.availability (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    day TEXT NOT NULL CHECK (day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
    start_time INTEGER NOT NULL CHECK (start_time >= 0 AND start_time <= 47),
    end_time INTEGER NOT NULL CHECK (end_time >= 0 AND end_time <= 47 AND end_time > start_time),
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table
CREATE TABLE public.sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    participants UUID[] NOT NULL CHECK (array_length(participants, 1) = 2),
    date DATE NOT NULL,
    start_time INTEGER NOT NULL CHECK (start_time >= 0 AND start_time <= 47),
    end_time INTEGER NOT NULL CHECK (end_time >= 0 AND end_time <= 47 AND end_time > start_time),
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Badges table (for tracking available badges)
CREATE TABLE public.badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    criteria TEXT NOT NULL,
    icon TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User badges junction table
CREATE TABLE public.user_badges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    badge_id TEXT REFERENCES public.badges(id) NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, badge_id)
);

-- Challenges table
CREATE TABLE public.challenges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('weekly', 'monthly')),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User challenges progress table
CREATE TABLE public.user_challenges (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    challenge_id UUID REFERENCES public.challenges(id) ON DELETE CASCADE NOT NULL,
    current_value INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, challenge_id)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users: Users can read their own data and their partner's data
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Availability: Users can manage their own availability
CREATE POLICY "Users can manage their own availability" ON public.availability
    FOR ALL USING (auth.uid() = user_id);

-- Sessions: Users can view sessions they participate in
CREATE POLICY "Users can view their own sessions" ON public.sessions
    FOR SELECT USING (auth.uid() = ANY(participants));

CREATE POLICY "Users can create sessions they participate in" ON public.sessions
    FOR INSERT WITH CHECK (auth.uid() = ANY(participants));

CREATE POLICY "Users can update sessions they participate in" ON public.sessions
    FOR UPDATE USING (auth.uid() = ANY(participants));

-- Badges: All users can read badges
CREATE POLICY "Anyone can read badges" ON public.badges
    FOR SELECT USING (true);

-- User badges: Users can view their own badges
CREATE POLICY "Users can view their own badges" ON public.user_badges
    FOR SELECT USING (auth.uid() = user_id);

-- Challenges: All users can read challenges
CREATE POLICY "Anyone can read challenges" ON public.challenges
    FOR SELECT USING (true);

-- User challenges: Users can manage their own challenge progress
CREATE POLICY "Users can manage their own challenge progress" ON public.user_challenges
    FOR ALL USING (auth.uid() = user_id);

-- Functions

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON public.sessions
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Insert default badges
INSERT INTO public.badges (id, name, description, criteria, icon, category) VALUES
('first-week', 'Getting Started', 'Complete your first week', 'Complete first week with 2 sessions', '🎯', 'progress'),
('consistency-5', 'Steady Gains', 'Maintain consistency', '5 consecutive weeks with 2+ sessions', '📈', 'consistency'),
('consistency-10', 'Iron Will', 'Show dedication', '10 consecutive weeks with 2+ sessions', '🔥', 'consistency'),
('sessions-10', 'Double Digits', 'Reach milestone', 'Complete 10 total sessions', '🎲', 'milestone'),
('sessions-50', 'Half Century', 'Major achievement', 'Complete 50 total sessions', '💯', 'milestone'),
('perfect-month', 'Monthly Master', 'Excel in a month', 'Complete 8+ sessions in a month', '📅', 'achievement'),
('early-bird', 'Early Bird', 'Morning warrior', 'Complete 5 sessions before 8 AM', '🌅', 'time'),
('night-owl', 'Night Owl', 'Evening athlete', 'Complete 5 sessions after 8 PM', '🌙', 'time');