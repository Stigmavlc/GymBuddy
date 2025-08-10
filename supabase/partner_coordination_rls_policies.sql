-- ========================================
-- PARTNER COORDINATION RLS POLICIES
-- ========================================
-- 
-- Row Level Security policies for the partner coordination system tables.
-- These policies ensure proper data access while enabling partner coordination.
--
-- Security Principles:
-- 1. Service role has full access (for bot operations)  
-- 2. Users can manage their own requests/proposals
-- 3. Partners can view each other's coordination data
-- 4. Users can only see their own notifications
-- 5. Coordination states are accessible by both partners
--
-- ========================================

-- Enable Row Level Security on new tables
ALTER TABLE public.partner_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordination_states ENABLE ROW LEVEL SECURITY;

-- ========================================
-- PARTNER REQUESTS TABLE POLICIES
-- ========================================

-- Service role full access
CREATE POLICY "service_role_full_access_partner_requests" ON public.partner_requests
    FOR ALL 
    USING (auth.role() = 'service_role');

-- Users can view requests they sent or received
CREATE POLICY "users_can_view_own_partner_requests" ON public.partner_requests
    FOR SELECT 
    USING (
        auth.uid()::text = requester_id::text 
        OR auth.uid()::text = requested_user_id::text
    );

-- Users can create partner requests
CREATE POLICY "users_can_create_partner_requests" ON public.partner_requests
    FOR INSERT 
    WITH CHECK (auth.uid()::text = requester_id::text);

-- Users can update requests they sent (to cancel) or received (to respond)
CREATE POLICY "users_can_update_own_partner_requests" ON public.partner_requests
    FOR UPDATE 
    USING (
        auth.uid()::text = requester_id::text 
        OR auth.uid()::text = requested_user_id::text
    );

-- ========================================
-- SESSION PROPOSALS TABLE POLICIES  
-- ========================================

-- Service role full access
CREATE POLICY "service_role_full_access_session_proposals" ON public.session_proposals
    FOR ALL 
    USING (auth.role() = 'service_role');

-- Partners can view proposals they created or received
CREATE POLICY "partners_can_view_session_proposals" ON public.session_proposals
    FOR SELECT 
    USING (
        auth.uid()::text = proposer_id::text 
        OR auth.uid()::text = partner_id::text
    );

-- Partners can create proposals for each other (if they are partners)
CREATE POLICY "partners_can_create_session_proposals" ON public.session_proposals
    FOR INSERT 
    WITH CHECK (
        auth.uid()::text = proposer_id::text
        AND EXISTS (
            SELECT 1 FROM public.users 
            WHERE id::text = auth.uid()::text 
            AND partner_id::text = session_proposals.partner_id::text
        )
    );

-- Partners can update proposals they created or received
CREATE POLICY "partners_can_update_session_proposals" ON public.session_proposals
    FOR UPDATE 
    USING (
        auth.uid()::text = proposer_id::text 
        OR auth.uid()::text = partner_id::text
    );

-- ========================================
-- NOTIFICATIONS TABLE POLICIES
-- ========================================

-- Service role full access (for sending notifications)
CREATE POLICY "service_role_full_access_notifications" ON public.notifications
    FOR ALL 
    USING (auth.role() = 'service_role');

-- Users can only view their own notifications
CREATE POLICY "users_can_view_own_notifications" ON public.notifications
    FOR SELECT 
    USING (auth.uid()::text = user_id::text);

-- Users can update their own notifications (mark as read)
CREATE POLICY "users_can_update_own_notifications" ON public.notifications
    FOR UPDATE 
    USING (auth.uid()::text = user_id::text);

-- System can insert notifications for users
CREATE POLICY "system_can_insert_notifications" ON public.notifications
    FOR INSERT 
    WITH CHECK (auth.role() = 'service_role');

-- ========================================
-- COORDINATION STATES TABLE POLICIES
-- ========================================

-- Service role full access
CREATE POLICY "service_role_full_access_coordination_states" ON public.coordination_states
    FOR ALL 
    USING (auth.role() = 'service_role');

-- Partners can view their coordination state
CREATE POLICY "partners_can_view_coordination_states" ON public.coordination_states
    FOR SELECT 
    USING (
        auth.uid()::text = partner_1_id::text 
        OR auth.uid()::text = partner_2_id::text
    );

-- System can create coordination states when partners are linked
CREATE POLICY "system_can_create_coordination_states" ON public.coordination_states
    FOR INSERT 
    WITH CHECK (auth.role() = 'service_role');

-- System can update coordination states
CREATE POLICY "system_can_update_coordination_states" ON public.coordination_states
    FOR UPDATE 
    USING (auth.role() = 'service_role');

-- ========================================
-- ENHANCED POLICIES FOR EXISTING TABLES
-- ========================================

-- Add policy for users to view partner profiles for coordination
-- (This may already exist, but ensuring it's comprehensive)
CREATE POLICY "users_can_view_coordination_partner_profiles" ON public.users
    FOR SELECT 
    USING (
        -- Users involved in coordination can see each other's profiles
        EXISTS (
            SELECT 1 FROM public.coordination_states cs
            WHERE (cs.partner_1_id::text = auth.uid()::text AND cs.partner_2_id::text = users.id::text)
               OR (cs.partner_2_id::text = auth.uid()::text AND cs.partner_1_id::text = users.id::text)
        )
        OR
        -- Users in partner requests can see each other's profiles  
        EXISTS (
            SELECT 1 FROM public.partner_requests pr
            WHERE (pr.requester_id::text = auth.uid()::text AND pr.requested_user_id::text = users.id::text)
               OR (pr.requested_user_id::text = auth.uid()::text AND pr.requester_id::text = users.id::text)
        )
    );

-- Enhanced session policies for proposal-based sessions
CREATE POLICY "users_can_view_proposal_based_sessions" ON public.sessions
    FOR SELECT 
    USING (
        auth.uid()::text = ANY(participants::text[])
        OR 
        -- Users can see sessions created from their proposals
        EXISTS (
            SELECT 1 FROM public.session_proposals sp
            WHERE sp.session_id = sessions.id
            AND (sp.proposer_id::text = auth.uid()::text OR sp.partner_id::text = auth.uid()::text)
        )
    );

-- ========================================
-- SECURITY FUNCTIONS
-- ========================================

-- Function to verify partner relationship for coordination operations
CREATE OR REPLACE FUNCTION public.verify_partner_relationship(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user1_partner UUID;
    user2_partner UUID;
BEGIN
    -- Get partner relationships
    SELECT partner_id INTO user1_partner FROM public.users WHERE id = user1_id;
    SELECT partner_id INTO user2_partner FROM public.users WHERE id = user2_id;
    
    -- Check if they are partners
    RETURN (user1_partner = user2_id AND user2_partner = user1_id);
END;
$$;

-- Function to check if user can coordinate with another user
CREATE OR REPLACE FUNCTION public.can_coordinate_with_user(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Service role can coordinate with anyone
    IF auth.role() = 'service_role' THEN
        RETURN TRUE;
    END IF;
    
    -- Check if users are partners
    RETURN public.verify_partner_relationship(auth.uid(), target_user_id);
END;
$$;

-- ========================================
-- POLICY VALIDATION QUERIES
-- ========================================
-- Run these to verify policies work correctly:

-- Test partner request access
-- SELECT * FROM public.partner_requests; -- Should only show user's requests

-- Test session proposal access  
-- SELECT * FROM public.session_proposals; -- Should only show user's proposals

-- Test notification access
-- SELECT * FROM public.notifications; -- Should only show user's notifications

-- Test coordination state access
-- SELECT * FROM public.coordination_states; -- Should only show user's coordination states

-- ========================================
-- COMMENTS FOR DOCUMENTATION
-- ========================================

COMMENT ON POLICY "service_role_full_access_partner_requests" ON public.partner_requests 
IS 'Allows bot and backend services full access to manage partner requests';

COMMENT ON POLICY "users_can_view_own_partner_requests" ON public.partner_requests 
IS 'Users can see partner requests they sent or received';

COMMENT ON POLICY "partners_can_create_session_proposals" ON public.session_proposals 
IS 'Only verified partners can create session proposals for each other';

COMMENT ON POLICY "users_can_view_own_notifications" ON public.notifications 
IS 'Users can only see notifications intended for them';

COMMENT ON POLICY "partners_can_view_coordination_states" ON public.coordination_states 
IS 'Both partners in a relationship can view their coordination state';