-- ========================================
-- PARTNER COORDINATION SYSTEM SCHEMA
-- ========================================
-- 
-- This schema extends the existing GymBuddy database to support
-- comprehensive partner coordination including:
-- 1. Partner invitations and management
-- 2. Session proposals and negotiations  
-- 3. Dual notifications
-- 4. Coordination state tracking
--
-- ========================================

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- PARTNER REQUESTS TABLE
-- ========================================
-- Handles partner invitations, acceptance, and rejection

CREATE TABLE public.partner_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    requester_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    requested_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
    message TEXT, -- Optional invitation message
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(requester_id, requested_user_id), -- Prevent duplicate requests
    CHECK (requester_id != requested_user_id) -- Can't invite yourself
);

-- ========================================
-- SESSION PROPOSALS TABLE  
-- ========================================
-- Handles session suggestions and negotiations between partners

CREATE TABLE public.session_proposals (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    proposer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    partner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    proposed_date DATE NOT NULL,
    proposed_start_time INTEGER NOT NULL CHECK (proposed_start_time >= 0 AND proposed_start_time <= 47),
    proposed_end_time INTEGER NOT NULL CHECK (proposed_end_time >= 0 AND proposed_end_time <= 47 AND proposed_end_time > proposed_start_time),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'counter_proposed', 'cancelled')),
    response_message TEXT, -- Partner's response message
    session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL, -- Link to actual session when accepted
    parent_proposal_id UUID REFERENCES public.session_proposals(id) ON DELETE CASCADE, -- For counter-proposals
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'), -- Proposals expire
    CHECK (proposer_id != partner_id), -- Can't propose to yourself
    CHECK (proposed_end_time - proposed_start_time >= 4) -- Minimum 2-hour sessions (4 half-hour slots)
);

-- ========================================
-- NOTIFICATIONS TABLE
-- ========================================
-- Tracks notifications sent to users for coordination

CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN (
        'partner_request_received', 'partner_request_accepted', 'partner_request_rejected',
        'session_proposed', 'session_proposal_accepted', 'session_proposal_rejected', 
        'session_confirmed', 'session_cancelled', 'availability_coordination_ready',
        'session_reminder'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- Additional structured data
    read_at TIMESTAMP WITH TIME ZONE,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Reference to related entities
    partner_request_id UUID REFERENCES public.partner_requests(id) ON DELETE CASCADE,
    session_proposal_id UUID REFERENCES public.session_proposals(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ========================================
-- COORDINATION STATES TABLE
-- ========================================  
-- Tracks the state of partner coordination processes

CREATE TABLE public.coordination_states (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    partner_1_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    partner_2_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    state TEXT DEFAULT 'waiting_availability' CHECK (state IN (
        'waiting_availability', 'availability_ready', 'suggestions_generated', 
        'negotiating', 'sessions_confirmed', 'coordination_complete'
    )),
    last_availability_check TIMESTAMP WITH TIME ZONE,
    suggestions_generated_at TIMESTAMP WITH TIME ZONE,
    active_proposals_count INTEGER DEFAULT 0,
    completed_sessions_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(partner_1_id, partner_2_id),
    CHECK (partner_1_id != partner_2_id)
);

-- ========================================
-- ENHANCE EXISTING SESSIONS TABLE
-- ========================================
-- Add fields to support proposal workflow

ALTER TABLE public.sessions 
ADD COLUMN IF NOT EXISTS proposal_id UUID REFERENCES public.session_proposals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS coordination_state_id UUID REFERENCES public.coordination_states(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS both_partners_confirmed BOOLEAN DEFAULT FALSE;

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Partner requests indexes
CREATE INDEX idx_partner_requests_requester ON public.partner_requests(requester_id);
CREATE INDEX idx_partner_requests_requested_user ON public.partner_requests(requested_user_id);  
CREATE INDEX idx_partner_requests_status ON public.partner_requests(status);

-- Session proposals indexes
CREATE INDEX idx_session_proposals_proposer ON public.session_proposals(proposer_id);
CREATE INDEX idx_session_proposals_partner ON public.session_proposals(partner_id);
CREATE INDEX idx_session_proposals_status ON public.session_proposals(status);
CREATE INDEX idx_session_proposals_date ON public.session_proposals(proposed_date);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_type ON public.notifications(type);
CREATE INDEX idx_notifications_read_at ON public.notifications(read_at);
CREATE INDEX idx_notifications_sent_at ON public.notifications(sent_at);

-- Coordination states indexes  
CREATE INDEX idx_coordination_states_partners ON public.coordination_states(partner_1_id, partner_2_id);
CREATE INDEX idx_coordination_states_state ON public.coordination_states(state);

-- ========================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ========================================

-- Update coordination_states.updated_at on changes
CREATE TRIGGER update_coordination_states_updated_at 
BEFORE UPDATE ON public.coordination_states
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Auto-update active_proposals_count in coordination_states
CREATE OR REPLACE FUNCTION update_coordination_proposals_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Update count for the coordination state
    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        UPDATE public.coordination_states 
        SET active_proposals_count = (
            SELECT COUNT(*) 
            FROM public.session_proposals 
            WHERE (proposer_id = coordination_states.partner_1_id AND partner_id = coordination_states.partner_2_id)
               OR (proposer_id = coordination_states.partner_2_id AND partner_id = coordination_states.partner_1_id)
            AND status IN ('pending', 'counter_proposed')
        )
        WHERE (partner_1_id = NEW.proposer_id AND partner_2_id = NEW.partner_id)
           OR (partner_1_id = NEW.partner_id AND partner_2_id = NEW.proposer_id);
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        UPDATE public.coordination_states 
        SET active_proposals_count = (
            SELECT COUNT(*) 
            FROM public.session_proposals 
            WHERE (proposer_id = coordination_states.partner_1_id AND partner_id = coordination_states.partner_2_id)
               OR (proposer_id = coordination_states.partner_2_id AND partner_id = coordination_states.partner_1_id)
            AND status IN ('pending', 'counter_proposed')
        )
        WHERE (partner_1_id = OLD.proposer_id AND partner_2_id = OLD.partner_id)
           OR (partner_1_id = OLD.partner_id AND partner_2_id = OLD.proposer_id);
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_coordination_proposals_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON public.session_proposals
    FOR EACH ROW EXECUTE FUNCTION update_coordination_proposals_count();

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to get partner relationship status
CREATE OR REPLACE FUNCTION public.get_partner_relationship_status(user1_id UUID, user2_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user1_partner UUID;
    user2_partner UUID;
    request_status TEXT;
BEGIN
    -- Check if users are already partners
    SELECT partner_id INTO user1_partner FROM public.users WHERE id = user1_id;
    SELECT partner_id INTO user2_partner FROM public.users WHERE id = user2_id;
    
    IF user1_partner = user2_id AND user2_partner = user1_id THEN
        RETURN 'partners';
    END IF;
    
    -- Check for pending request
    SELECT status INTO request_status 
    FROM public.partner_requests 
    WHERE (requester_id = user1_id AND requested_user_id = user2_id)
       OR (requester_id = user2_id AND requested_user_id = user1_id)
    ORDER BY created_at DESC 
    LIMIT 1;
    
    RETURN COALESCE(request_status, 'none');
END;
$$;

-- Function to create coordination state when partners are linked
CREATE OR REPLACE FUNCTION public.ensure_coordination_state(partner1_id UUID, partner2_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    coordination_id UUID;
    p1_id UUID := LEAST(partner1_id, partner2_id);
    p2_id UUID := GREATEST(partner1_id, partner2_id);
BEGIN
    -- Check if coordination state already exists
    SELECT id INTO coordination_id 
    FROM public.coordination_states 
    WHERE partner_1_id = p1_id AND partner_2_id = p2_id;
    
    -- Create if it doesn't exist
    IF coordination_id IS NULL THEN
        INSERT INTO public.coordination_states (partner_1_id, partner_2_id)
        VALUES (p1_id, p2_id)
        RETURNING id INTO coordination_id;
    END IF;
    
    RETURN coordination_id;
END;
$$;

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON TABLE public.partner_requests IS 'Manages partner invitation workflow';
COMMENT ON TABLE public.session_proposals IS 'Handles session suggestions and negotiations between partners';
COMMENT ON TABLE public.notifications IS 'Tracks all notifications sent to users for coordination';
COMMENT ON TABLE public.coordination_states IS 'Tracks the overall state of partner coordination processes';

COMMENT ON COLUMN public.session_proposals.proposed_start_time IS 'Start time in half-hour slots (0-47, where 0=midnight, 20=10am)';
COMMENT ON COLUMN public.session_proposals.proposed_end_time IS 'End time in half-hour slots (0-47, where 0=midnight, 20=10am)';
COMMENT ON COLUMN public.coordination_states.state IS 'Current state of coordination: waiting_availability -> availability_ready -> suggestions_generated -> negotiating -> sessions_confirmed -> coordination_complete';