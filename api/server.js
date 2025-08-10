const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const PartnerCoordinationAPI = require('./partner_coordination_endpoints');
const RealtimeSyncService = require('./realtime_sync_service');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// Initialize Partner Coordination API
const partnerCoordination = new PartnerCoordinationAPI(supabase);

// Initialize Realtime Sync Service
const realtimeSync = new RealtimeSyncService(supabase);

// CORS middleware for n8n and realtime connections
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
});

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'GymBuddy API is running! 💪',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            // User identification
            user_lookup: 'GET /user/by-email/:email',
            
            // Availability management
            get_availability: 'GET /availability/:username',
            get_availability_by_email: 'GET /availability/by-email/:email',
            clear_availability: 'DELETE /availability/:username',
            clear_availability_by_email: 'DELETE /availability/by-email/:email',
            set_availability_by_email: 'POST /availability/by-email/:email',
            common_availability: 'GET /availability/common/:email1/:email2',
            
            // Partner coordination (NEW)
            find_partner: 'GET /partners/find/:identifier',
            partner_status: 'GET /partners/status/:email',
            session_suggestions: 'GET /sessions/suggestions/:email1/:email2',
            partner_request: 'POST /partners/request',
            partner_response: 'PUT /partners/requests/:requestId/respond',
            partner_requests_for_user: 'GET /partners/requests/:email',
            
            // Session management
            upcoming_sessions: 'GET /sessions/upcoming',
            book_session: 'POST /sessions/book',
            cancel_session: 'POST /sessions/cancel',
            
            // Session proposals (NEW)
            create_proposal: 'POST /sessions/propose',
            respond_to_proposal: 'PUT /sessions/proposals/:proposalId/respond',
            get_pending_proposals: 'GET /sessions/proposals/pending/:email',
            get_all_proposals: 'GET /sessions/proposals/:email',
            cancel_proposal: 'DELETE /sessions/proposals/:proposalId',
            counter_propose: 'POST /sessions/proposals/:proposalId/counter',
            
            // Real-time synchronization (NEW)
            realtime_connect: 'GET /realtime/connect/:userEmail',
            realtime_status: 'GET /realtime/status',
            get_notifications: 'GET /notifications/:email',
            mark_notification_read: 'PUT /notifications/:notificationId/read',
            
            // Debug and sync verification
            debug_sync_status: 'GET /debug/sync-status/:email?',
            test_realtime_sync: 'POST /debug/test-sync/:email'
        },
        bot_operations: {
            description: 'Use email-based endpoints for Telegram bot operations',
            clear_user_availability: 'DELETE /availability/by-email/ivanaguilarmari@gmail.com',
            check_user_availability: 'GET /availability/by-email/ivanaguilarmari@gmail.com',
            set_user_availability: 'POST /availability/by-email/ivanaguilarmari@gmail.com'
        }
    });
});

// Get user by email (for bot identification)
app.get('/user/by-email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        console.log(`Looking up user with email: ${email}`);
        
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', email)
            .single();
            
        if (userError || !user) {
            console.log('User not found:', userError);
            return res.status(404).json({ error: 'User not found', email });
        }

        console.log('Found user:', user);
        res.json({ user });
    } catch (error) {
        console.error('Error looking up user:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user availability (fixed to match database schema)
app.get('/availability/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        // Get user ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .ilike('name', username)
            .single();
            
        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        console.log(`Getting availability for user: ${user.name} (${user.email})`);

        // Get availability (note: using day-based schema, not date-based)
        const { data: availability, error } = await supabase
            .from('availability')
            .select('*')
            .eq('user_id', user.id)
            .order('day', { ascending: true })
            .order('start_time', { ascending: true });

        if (error) {
            console.error('Error fetching availability:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`Found ${availability.length} availability slots for ${user.name}`);

        res.json({
            user: user.name,
            email: user.email,
            userId: user.id,
            hasAvailability: availability.length > 0,
            totalSlots: availability.length,
            slots: availability.map(slot => ({
                id: slot.id,
                day: slot.day,
                startTime: slot.start_time,
                endTime: slot.end_time,
                created: slot.created_at,
                // Convert to readable format for display
                display: {
                    day: slot.day.charAt(0).toUpperCase() + slot.day.slice(1),
                    start: `${slot.start_time}:00`,
                    end: `${slot.end_time}:00`,
                    duration: slot.end_time - slot.start_time
                }
            }))
        });
    } catch (error) {
        console.error('Error in availability endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get user availability by email (for bot operations)
app.get('/availability/by-email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        console.log(`Getting availability for email: ${email}`);
        
        // Get user ID by email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', email)
            .single();
            
        if (userError || !user) {
            console.log('User not found for email:', email, userError);
            return res.status(404).json({ error: 'User not found', email });
        }

        // Get availability
        const { data: availability, error } = await supabase
            .from('availability')
            .select('*')
            .eq('user_id', user.id)
            .order('day', { ascending: true })
            .order('start_time', { ascending: true });

        if (error) {
            console.error('Error fetching availability:', error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`Found ${availability.length} availability slots for ${user.email}`);

        res.json({
            user: user.name,
            email: user.email,
            userId: user.id,
            hasAvailability: availability.length > 0,
            totalSlots: availability.length,
            slots: availability.map(slot => ({
                id: slot.id,
                day: slot.day,
                startTime: slot.start_time,
                endTime: slot.end_time,
                created: slot.created_at
            }))
        });
    } catch (error) {
        console.error('Error in availability by email endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get both users' availability and find common slots (ENHANCED)
app.get('/availability/common/:email1/:email2', async (req, res) => {
    try {
        const { email1, email2 } = req.params;
        
        console.log(`Getting common availability between ${email1} and ${email2}`);
        
        const result = await partnerCoordination.findCommonAvailability(email1, email2);
        
        if (!result.success) {
            return res.status(400).json({ 
                error: result.error,
                email1,
                email2 
            });
        }
        
        res.json({
            success: true,
            ...result.data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in common availability endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate session suggestions from common availability
app.get('/sessions/suggestions/:email1/:email2', async (req, res) => {
    try {
        const { email1, email2 } = req.params;
        
        console.log(`Generating session suggestions for ${email1} and ${email2}`);
        
        // First get common availability
        const commonResult = await partnerCoordination.findCommonAvailability(email1, email2);
        
        if (!commonResult.success) {
            return res.status(400).json({ 
                error: commonResult.error,
                email1,
                email2 
            });
        }
        
        // Generate suggestions from overlapping slots
        const partnerIds = [commonResult.data.user1.id, commonResult.data.user2.id];
        const suggestions = partnerCoordination.generateSessionSuggestions(
            commonResult.data.overlappingSlots, 
            partnerIds
        );
        
        res.json({
            success: true,
            user1: commonResult.data.user1,
            user2: commonResult.data.user2,
            overlappingSlots: commonResult.data.overlappingSlots,
            ...suggestions,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in session suggestions endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// PARTNER MANAGEMENT ENDPOINTS
// ========================================

// Send partner request
app.post('/partners/request', async (req, res) => {
    try {
        const { requesterEmail, targetEmail, message = '' } = req.body;
        
        if (!requesterEmail || !targetEmail) {
            return res.status(400).json({ 
                error: 'requesterEmail and targetEmail are required' 
            });
        }
        
        console.log(`Partner request from ${requesterEmail} to ${targetEmail}`);
        
        const result = await partnerCoordination.sendPartnerRequest(
            requesterEmail, 
            targetEmail, 
            message
        );
        
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        
        res.json({
            success: true,
            request: result.data,
            message: result.message,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in partner request endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Enhanced partner request response with real-time sync
app.put('/partners/requests/:requestId/respond', async (req, res) => {
    try {
        const { requestId } = req.params;
        const { userEmail, response, message = '' } = req.body;
        
        if (!userEmail || !response) {
            return res.status(400).json({ 
                error: 'userEmail and response are required' 
            });
        }
        
        if (!['accepted', 'rejected'].includes(response)) {
            return res.status(400).json({ 
                error: 'response must be "accepted" or "rejected"' 
            });
        }
        
        console.log(`Partner request ${requestId} ${response} by ${userEmail}`);
        
        const result = await partnerCoordination.respondToPartnerRequest(
            requestId, 
            userEmail, 
            response, 
            message
        );
        
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        
        // Real-time sync will be triggered automatically by database change
        console.log('✅ Partner request response processed, real-time notifications will be sent automatically');
        
        res.json({
            success: true,
            message: result.message,
            partnersLinked: result.partnersLinked,
            realtimeSync: 'enabled',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in partner response endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// SESSION PROPOSAL ENDPOINTS
// ========================================

// Enhanced session proposal with real-time sync
app.post('/sessions/propose', async (req, res) => {
    try {
        const { 
            proposerEmail, 
            proposedDate, 
            startTime, 
            endTime, 
            message = '' 
        } = req.body;
        
        if (!proposerEmail || !proposedDate || startTime === undefined || endTime === undefined) {
            return res.status(400).json({ 
                error: 'proposerEmail, proposedDate, startTime, and endTime are required' 
            });
        }
        
        console.log(`Session proposal from ${proposerEmail} for ${proposedDate}`);
        
        const result = await partnerCoordination.createSessionProposal(
            proposerEmail,
            proposedDate,
            startTime,
            endTime,
            message
        );
        
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        
        // Real-time sync will be triggered automatically by database change
        console.log('✅ Session proposal created, real-time notifications will be sent automatically');
        
        res.json({
            success: true,
            proposal: result.data,
            message: result.message,
            realtimeSync: 'enabled',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in session proposal endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Enhanced session proposal response with real-time sync
app.put('/sessions/proposals/:proposalId/respond', async (req, res) => {
    try {
        const { proposalId } = req.params;
        const { userEmail, response, message = '' } = req.body;
        
        if (!userEmail || !response) {
            return res.status(400).json({ 
                error: 'userEmail and response are required' 
            });
        }
        
        if (!['accepted', 'rejected', 'counter_proposed'].includes(response)) {
            return res.status(400).json({ 
                error: 'response must be "accepted", "rejected", or "counter_proposed"' 
            });
        }
        
        console.log(`Session proposal ${proposalId} ${response} by ${userEmail}`);
        
        const result = await partnerCoordination.respondToSessionProposal(
            proposalId,
            userEmail,
            response,
            message
        );
        
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        
        // Real-time sync will be triggered automatically by database change
        console.log('✅ Session proposal response processed, real-time notifications will be sent automatically');
        
        res.json({
            success: true,
            message: result.message,
            session: result.session,
            realtimeSync: 'enabled',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in session proposal response endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get pending proposals for user
app.get('/sessions/proposals/pending/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        console.log(`Getting pending proposals for ${email}`);
        
        // Get user
        const userResult = await partnerCoordination.getUserWithAvailability(email);
        if (!userResult.success) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get pending proposals where user is involved
        const { data: proposals, error } = await supabase
            .from('session_proposals')
            .select(`
                *,
                proposer:proposer_id(name, email),
                partner:partner_id(name, email)
            `)
            .or(`proposer_id.eq.${userResult.data.id},partner_id.eq.${userResult.data.id}`)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
            
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        res.json({
            success: true,
            user: userResult.data,
            proposals: proposals || [],
            count: proposals?.length || 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in pending proposals endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Book a session
app.post('/sessions/book', async (req, res) => {
    try {
        const { user1, user2, date, startTime, endTime } = req.body;
        
        // Get user IDs
        const { data: users } = await supabase
            .from('users')
            .select('id, name')
            .in('name', [user1, user2]);
            
        if (!users || users.length !== 2) {
            return res.status(404).json({ error: 'Users not found' });
        }

        // Create session
        const { data: session, error } = await supabase
            .from('sessions')
            .insert({
                title: `Gym Session - ${user1} & ${user2}`,
                start_time: new Date(`${date} ${startTime}`).toISOString(),
                end_time: new Date(`${date} ${endTime}`).toISOString(),
                participants: users.map(u => u.id),
                status: 'confirmed'
            })
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({
            success: true,
            session: session,
            message: `Session booked for ${date} at ${startTime}! 💪`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel a session
app.post('/sessions/cancel', async (req, res) => {
    try {
        const { sessionId, cancelledBy } = req.body;
        
        const { data, error } = await supabase
            .from('sessions')
            .update({ 
                status: 'cancelled',
                cancelled_by: cancelledBy,
                cancelled_at: new Date().toISOString()
            })
            .eq('id', sessionId)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({
            success: true,
            message: 'Session cancelled successfully'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Clear user availability (for bot operations)
app.delete('/availability/by-email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        console.log(`Bot operation: Clearing availability for email: ${email}`);
        
        // Get user ID by email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', email)
            .single();
            
        if (userError || !user) {
            console.log('User not found for email:', email, userError);
            return res.status(404).json({ error: 'User not found', email });
        }

        // First, get current availability count for logging
        const { data: currentAvailability, error: countError } = await supabase
            .from('availability')
            .select('id')
            .eq('user_id', user.id);

        if (countError) {
            console.error('Error counting current availability:', countError);
        } else {
            console.log(`Current availability slots for ${user.email}: ${currentAvailability.length}`);
        }

        // Delete all availability for this user
        const { data: deletedData, error: deleteError, count } = await supabase
            .from('availability')
            .delete({ count: 'exact' })
            .eq('user_id', user.id);

        if (deleteError) {
            console.error('Error clearing availability:', deleteError);
            return res.status(500).json({ error: deleteError.message });
        }

        console.log(`Successfully cleared ${count} availability slots for ${user.email}`);

        res.json({
            success: true,
            user: user.name,
            email: user.email,
            userId: user.id,
            message: `Cleared ${count} availability slots`,
            deletedCount: count,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in clear availability endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Clear user availability by username (alternative endpoint)
app.delete('/availability/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        console.log(`Bot operation: Clearing availability for username: ${username}`);
        
        // Get user ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .ilike('name', username)
            .single();
            
        if (userError || !user) {
            console.log('User not found for username:', username, userError);
            return res.status(404).json({ error: 'User not found', username });
        }

        // Delete all availability for this user
        const { data: deletedData, error: deleteError, count } = await supabase
            .from('availability')
            .delete({ count: 'exact' })
            .eq('user_id', user.id);

        if (deleteError) {
            console.error('Error clearing availability:', deleteError);
            return res.status(500).json({ error: deleteError.message });
        }

        console.log(`Successfully cleared ${count} availability slots for ${user.name}`);

        res.json({
            success: true,
            user: user.name,
            email: user.email,
            userId: user.id,
            message: `Cleared ${count} availability slots`,
            deletedCount: count,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in clear availability by username endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Add or update user availability (for bot operations)
app.post('/availability/by-email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { slots } = req.body; // Array of { day, start_time, end_time }
        
        console.log(`Bot operation: Setting availability for email: ${email}`, slots);
        
        // Get user ID by email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', email)
            .single();
            
        if (userError || !user) {
            console.log('User not found for email:', email, userError);
            return res.status(404).json({ error: 'User not found', email });
        }

        // Clear existing availability first
        const { error: deleteError } = await supabase
            .from('availability')
            .delete()
            .eq('user_id', user.id);

        if (deleteError) {
            console.error('Error clearing existing availability:', deleteError);
            return res.status(500).json({ error: deleteError.message });
        }

        // Insert new availability slots if provided
        let insertedSlots = [];
        if (slots && Array.isArray(slots) && slots.length > 0) {
            const slotsToInsert = slots.map(slot => ({
                user_id: user.id,
                day: slot.day.toLowerCase(),
                start_time: slot.start_time,
                end_time: slot.end_time
            }));

            const { data: insertedData, error: insertError } = await supabase
                .from('availability')
                .insert(slotsToInsert)
                .select();

            if (insertError) {
                console.error('Error inserting new availability:', insertError);
                return res.status(500).json({ error: insertError.message });
            }

            insertedSlots = insertedData;
        }

        console.log(`Successfully set ${insertedSlots.length} availability slots for ${user.email}`);

        res.json({
            success: true,
            user: user.name,
            email: user.email,
            userId: user.id,
            message: `Set ${insertedSlots.length} availability slots`,
            slots: insertedSlots,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in set availability endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Debug endpoint - get comprehensive sync status
app.get('/debug/sync-status/:email?', async (req, res) => {
    try {
        const { email } = req.params;
        
        console.log(`Debug: Getting sync status for email: ${email || 'all users'}`);
        
        let users, availability, sessions;
        
        if (email) {
            // Get specific user info
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('email', email)
                .single();
                
            if (userError || !userData) {
                return res.status(404).json({ error: 'User not found', email });
            }
            
            users = [userData];
            
            // Get availability for this user
            const { data: availData, error: availError } = await supabase
                .from('availability')
                .select('*')
                .eq('user_id', userData.id)
                .order('day', { ascending: true });
                
            availability = availError ? [] : availData;
            
            // Get sessions for this user
            const { data: sessionsData, error: sessionsError } = await supabase
                .from('sessions')
                .select('*')
                .eq('participants', `{${userData.id}}`)
                .order('created_at', { ascending: false });
                
            sessions = sessionsError ? [] : sessionsData;
        } else {
            // Get all users
            const { data: usersData, error: usersError } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: true });
                
            users = usersError ? [] : usersData;
            
            // Get all availability
            const { data: availData, error: availError } = await supabase
                .from('availability')
                .select('*, users!inner(name, email)')
                .order('created_at', { ascending: false });
                
            availability = availError ? [] : availData;
            
            // Get all sessions
            const { data: sessionsData, error: sessionsError } = await supabase
                .from('sessions')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);
                
            sessions = sessionsError ? [] : sessionsData;
        }
        
        // Calculate summary statistics
        const stats = {
            total_users: users.length,
            users_with_availability: availability.reduce((acc, slot) => {
                if (!acc.includes(slot.user_id)) acc.push(slot.user_id);
                return acc;
            }, []).length,
            total_availability_slots: availability.length,
            total_sessions: sessions.length,
            last_availability_update: availability.length > 0 ? 
                availability[0].created_at : null
        };
        
        res.json({
            timestamp: new Date().toISOString(),
            debug_request: email ? `specific user: ${email}` : 'all users',
            stats,
            users: users.map(user => ({
                id: user.id,
                name: user.name,
                email: user.email,
                created_at: user.created_at
            })),
            availability: availability.map(slot => ({
                id: slot.id,
                user_id: slot.user_id,
                user_name: slot.users?.name || 'Unknown',
                user_email: slot.users?.email || 'Unknown',
                day: slot.day,
                start_time: slot.start_time,
                end_time: slot.end_time,
                created_at: slot.created_at
            })),
            sessions: sessions.map(session => ({
                id: session.id,
                participants: session.participants,
                date: session.date,
                start_time: session.start_time,
                end_time: session.end_time,
                status: session.status,
                created_at: session.created_at
            }))
        });
        
    } catch (error) {
        console.error('Error in debug sync status endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Test real-time sync by triggering a change
app.post('/debug/test-sync/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        console.log(`Debug: Testing real-time sync for email: ${email}`);
        
        // Get user ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', email)
            .single();
            
        if (userError || !user) {
            return res.status(404).json({ error: 'User not found', email });
        }

        // Add a test availability slot that will trigger real-time updates
        const testSlot = {
            user_id: user.id,
            day: 'monday',
            start_time: 9,
            end_time: 10
        };
        
        const { data: insertedSlot, error: insertError } = await supabase
            .from('availability')
            .insert([testSlot])
            .select()
            .single();

        if (insertError) {
            console.error('Error inserting test slot:', insertError);
            return res.status(500).json({ error: insertError.message });
        }

        console.log('Inserted test slot:', insertedSlot);

        // Wait a moment then delete it
        setTimeout(async () => {
            try {
                const { error: deleteError } = await supabase
                    .from('availability')
                    .delete()
                    .eq('id', insertedSlot.id);
                    
                if (deleteError) {
                    console.error('Error deleting test slot:', deleteError);
                } else {
                    console.log('Deleted test slot:', insertedSlot.id);
                }
            } catch (error) {
                console.error('Error in delayed deletion:', error);
            }
        }, 2000);

        res.json({
            success: true,
            message: 'Real-time sync test triggered',
            user: user.name,
            email: user.email,
            test_slot: insertedSlot,
            note: 'Test slot will be automatically deleted in 2 seconds'
        });

    } catch (error) {
        console.error('Error in test sync endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get upcoming sessions
app.get('/sessions/upcoming', async (req, res) => {
    try {
        const { data: sessions, error } = await supabase
            .from('sessions')
            .select('*, users!inner(*)')
            .eq('status', 'confirmed')
            .gte('start_time', new Date().toISOString())
            .order('start_time', { ascending: true })
            .limit(10);

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({ sessions });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user sessions by email (for bot)
app.get('/sessions/by-email/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        console.log(`Bot operation: Getting sessions for email: ${email}`);
        
        // Get user ID by email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', email)
            .single();
            
        if (userError || !user) {
            console.log('User not found for email:', email, userError);
            return res.status(404).json({ error: 'User not found', email });
        }

        // Get current date for filtering future sessions only
        const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        
        // Get user sessions where they are a participant
        // CRITICAL FIX: Add proper filtering like website does
        const { data: sessions, error: sessionsError } = await supabase
            .from('sessions')
            .select('*')
            .contains('participants', [user.id])
            .eq('status', 'confirmed')                    // Only confirmed sessions
            .gte('date', currentDate)                     // Only future/current dates
            .order('date', { ascending: true })
            .order('start_time', { ascending: true });

        if (sessionsError) {
            console.error('Error fetching sessions:', sessionsError);
            return res.status(500).json({ error: sessionsError.message });
        }

        // Additional filtering to exclude sessions that have already ended today
        const now = new Date();
        const currentHour = now.getHours();
        const todayString = now.toISOString().split('T')[0];
        
        const upcomingSessions = sessions.filter(session => {
            // If session is today, check if it hasn't ended yet
            if (session.date === todayString) {
                return session.end_time > currentHour;
            }
            // If session is in the future, include it
            return true;
        });

        console.log(`Found ${sessions.length} confirmed sessions, ${upcomingSessions.length} upcoming for user ${user.name}`);

        res.json({
            success: true,
            user: user.name,
            email: user.email,
            userId: user.id,
            sessions: upcomingSessions || [],
            count: upcomingSessions ? upcomingSessions.length : 0,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in get sessions by email endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Delete/cancel a specific session by ID and email (for bot)
app.delete('/sessions/:sessionId/by-email/:email', async (req, res) => {
    try {
        const { sessionId, email } = req.params;
        
        console.log(`Bot operation: Canceling session ${sessionId} for email: ${email}`);
        
        // Get user ID by email
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', email)
            .single();
            
        if (userError || !user) {
            console.log('User not found for email:', email, userError);
            return res.status(404).json({ error: 'User not found', email });
        }

        // Get the session to verify user is a participant
        const { data: session, error: sessionError } = await supabase
            .from('sessions')
            .select('*')
            .eq('id', sessionId)
            .single();

        if (sessionError || !session) {
            console.log('Session not found:', sessionId, sessionError);
            return res.status(404).json({ error: 'Session not found', sessionId });
        }

        // Check if user is a participant
        if (!session.participants || !session.participants.includes(user.id)) {
            console.log('User not authorized to cancel session:', user.id, session.participants);
            return res.status(403).json({ error: 'Not authorized to cancel this session' });
        }

        // Update session status to cancelled
        const { data: updatedSession, error: updateError } = await supabase
            .from('sessions')
            .update({ 
                status: 'cancelled',
                updated_at: new Date().toISOString()
            })
            .eq('id', sessionId)
            .select()
            .single();

        if (updateError) {
            console.error('Error cancelling session:', updateError);
            return res.status(500).json({ error: updateError.message });
        }

        console.log(`Successfully cancelled session ${sessionId} for user ${user.name}`);

        res.json({
            success: true,
            message: `Session cancelled successfully`,
            user: user.name,
            email: user.email,
            session: updatedSession,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error in cancel session endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// REAL-TIME SYNCHRONIZATION ENDPOINTS
// ========================================

// Server-Sent Events endpoint for real-time updates
app.get('/realtime/connect/:userEmail', (req, res) => {
    try {
        console.log(`Real-time connection request from: ${req.params.userEmail}`);
        realtimeSync.setupSSEConnection(req, res);
    } catch (error) {
        console.error('Error setting up SSE connection:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get real-time service status
app.get('/realtime/status', (req, res) => {
    try {
        const status = {
            service: 'active',
            activeConnections: realtimeSync.getActiveConnectionsCount(),
            connectedUsers: realtimeSync.getActiveConnections(),
            subscriptions: {
                partner_requests: 'active',
                session_proposals: 'active',
                sessions: 'active',
                coordination_states: 'active',
                availability: 'active'
            },
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            status,
            message: `Real-time sync service operational with ${status.activeConnections} active connections`
        });
    } catch (error) {
        console.error('Error getting realtime status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get notifications for user
app.get('/notifications/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { unreadOnly = 'false', limit = '20' } = req.query;
        
        console.log(`Getting notifications for ${email}`);
        
        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', email)
            .single();
            
        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Build query
        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));

        // Filter unread only if requested
        if (unreadOnly === 'true') {
            query = query.is('read_at', null);
        }

        const { data: notifications, error } = await query;

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({
            success: true,
            user: { name: user.name, email: user.email },
            notifications: notifications || [],
            count: notifications?.length || 0,
            unreadCount: notifications?.filter(n => !n.read_at).length || 0,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error getting notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

// Mark notification as read
app.put('/notifications/:notificationId/read', async (req, res) => {
    try {
        const { notificationId } = req.params;
        const { userEmail } = req.body;
        
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required in request body' });
        }

        // Get user to verify ownership
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('email', userEmail)
            .single();
            
        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Update notification
        const { data, error } = await supabase
            .from('notifications')
            .update({ read_at: new Date().toISOString() })
            .eq('id', notificationId)
            .eq('user_id', user.id)
            .select()
            .single();

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        if (!data) {
            return res.status(404).json({ error: 'Notification not found or access denied' });
        }

        res.json({
            success: true,
            message: 'Notification marked as read',
            notification: data
        });

    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ error: error.message });
    }
});

// ========================================
// ENHANCED PARTNER COORDINATION ENDPOINTS
// ========================================

// Find partner by email or Telegram ID
app.get('/partners/find/:identifier', async (req, res) => {
    try {
        const { identifier } = req.params;
        
        console.log(`Partner search for: ${identifier}`);
        
        const result = await partnerCoordination.findPartnerByIdentifier(identifier);
        
        if (!result.success) {
            return res.status(404).json({ error: result.error });
        }
        
        res.json({
            success: true,
            partner: result.data,
            searchedBy: identifier.includes('@') ? 'email' : 'telegram_id',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in partner search:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get partner relationship status
app.get('/partners/status/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email, partner_id')
            .eq('email', email)
            .single();
            
        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        let partnerInfo = null;
        let relationshipStatus = 'no_partner';
        
        if (user.partner_id) {
            // Get partner details
            const { data: partner } = await supabase
                .from('users')
                .select('id, name, email, telegram_id')
                .eq('id', user.partner_id)
                .single();
                
            if (partner) {
                partnerInfo = {
                    id: partner.id,
                    name: partner.name,
                    email: partner.email,
                    telegramId: partner.telegram_id
                };
                relationshipStatus = 'has_partner';
            }
        }
        
        // Check for pending requests
        const { data: pendingRequests } = await supabase
            .from('partner_requests')
            .select(`
                *,
                requester:requester_id(name, email, telegram_id),
                requested:requested_user_id(name, email, telegram_id)
            `)
            .or(`requester_id.eq.${user.id},requested_user_id.eq.${user.id}`)
            .eq('status', 'pending');
            
        res.json({
            success: true,
            user: { name: user.name, email: user.email },
            relationshipStatus,
            partner: partnerInfo,
            pendingRequests: pendingRequests || [],
            hasCoordination: !!user.partner_id,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error getting partner status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get partner requests for user
app.get('/partners/requests/:email', async (req, res) => {
    try {
        const { email } = req.params;
        
        // Get user
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id, name, email')
            .eq('email', email)
            .single();
            
        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get all partner requests (sent and received)
        const { data: requests, error } = await supabase
            .from('partner_requests')
            .select(`
                *,
                requester:requester_id(name, email, telegram_id),
                requested:requested_user_id(name, email, telegram_id)
            `)
            .or(`requester_id.eq.${user.id},requested_user_id.eq.${user.id}`)
            .order('created_at', { ascending: false });
            
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        const categorized = {
            received: requests?.filter(r => r.requested_user_id === user.id) || [],
            sent: requests?.filter(r => r.requester_id === user.id) || [],
            pending: requests?.filter(r => r.status === 'pending') || []
        };
        
        res.json({
            success: true,
            user: { name: user.name, email: user.email },
            requests: categorized,
            total: requests?.length || 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error getting partner requests:', error);
        res.status(500).json({ error: error.message });
    }
});

// Enhanced partner request endpoint with real-time sync
app.post('/partners/request', async (req, res) => {
    try {
        const { requesterIdentifier, targetIdentifier, message = '' } = req.body;
        
        if (!requesterIdentifier || !targetIdentifier) {
            return res.status(400).json({ 
                error: 'requesterIdentifier and targetIdentifier are required (email or Telegram ID)' 
            });
        }
        
        console.log(`Partner request from ${requesterIdentifier} to ${targetIdentifier}`);
        
        const result = await partnerCoordination.sendPartnerRequest(
            requesterIdentifier, 
            targetIdentifier, 
            message
        );
        
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        
        // Real-time sync will be triggered automatically by database change
        console.log('✅ Partner request created, real-time notifications will be sent automatically');
        
        res.json({
            success: true,
            request: result.data,
            message: result.message,
            requester: result.requester,
            target: result.target,
            realtimeSync: 'enabled',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in partner request endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get all proposals for user (sent and received)
app.get('/sessions/proposals/:email', async (req, res) => {
    try {
        const { email } = req.params;
        const { status = 'all', limit = '20' } = req.query;
        
        console.log(`Getting proposals for ${email}`);
        
        // Get user
        const userResult = await partnerCoordination.getUserWithAvailability(email);
        if (!userResult.success) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Build query
        let query = supabase
            .from('session_proposals')
            .select(`
                *,
                proposer:proposer_id(name, email, telegram_id),
                partner:partner_id(name, email, telegram_id),
                session:session_id(*)
            `)
            .or(`proposer_id.eq.${userResult.data.id},partner_id.eq.${userResult.data.id}`)
            .order('created_at', { ascending: false })
            .limit(parseInt(limit));
            
        // Filter by status if specified
        if (status !== 'all') {
            query = query.eq('status', status);
        }
            
        const { data: proposals, error } = await query;
            
        if (error) {
            return res.status(500).json({ error: error.message });
        }
        
        // Categorize proposals
        const categorized = {
            sent: proposals?.filter(p => p.proposer_id === userResult.data.id) || [],
            received: proposals?.filter(p => p.partner_id === userResult.data.id) || [],
            pending: proposals?.filter(p => p.status === 'pending') || [],
            accepted: proposals?.filter(p => p.status === 'accepted') || [],
            rejected: proposals?.filter(p => p.status === 'rejected') || []
        };
        
        res.json({
            success: true,
            user: userResult.data,
            proposals: categorized,
            total: proposals?.length || 0,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in get all proposals endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Cancel a session proposal
app.delete('/sessions/proposals/:proposalId', async (req, res) => {
    try {
        const { proposalId } = req.params;
        const { userEmail } = req.body;
        
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail required in request body' });
        }
        
        console.log(`Cancelling proposal ${proposalId} by ${userEmail}`);
        
        // Get user
        const userResult = await partnerCoordination.getUserWithAvailability(userEmail);
        if (!userResult.success) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get and validate proposal
        const { data: proposal, error: proposalError } = await supabase
            .from('session_proposals')
            .select('*')
            .eq('id', proposalId)
            .single();
            
        if (proposalError || !proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }
        
        // Check if user can cancel (must be proposer and status must be pending)
        if (proposal.proposer_id !== userResult.data.id) {
            return res.status(403).json({ error: 'Only the proposer can cancel a proposal' });
        }
        
        if (proposal.status !== 'pending') {
            return res.status(400).json({ error: 'Can only cancel pending proposals' });
        }
        
        // Update proposal status
        const { data: updatedProposal, error: updateError } = await supabase
            .from('session_proposals')
            .update({ 
                status: 'cancelled',
                responded_at: new Date().toISOString()
            })
            .eq('id', proposalId)
            .select()
            .single();
            
        if (updateError) {
            return res.status(500).json({ error: updateError.message });
        }
        
        console.log('✅ Proposal cancelled, real-time notifications will be sent automatically');
        
        res.json({
            success: true,
            message: 'Proposal cancelled',
            proposal: updatedProposal,
            realtimeSync: 'enabled',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in cancel proposal endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

// Counter-propose to a session proposal
app.post('/sessions/proposals/:proposalId/counter', async (req, res) => {
    try {
        const { proposalId } = req.params;
        const { 
            userEmail, 
            counterDate, 
            counterStartTime, 
            counterEndTime, 
            message = '' 
        } = req.body;
        
        if (!userEmail || !counterDate || counterStartTime === undefined || counterEndTime === undefined) {
            return res.status(400).json({ 
                error: 'userEmail, counterDate, counterStartTime, and counterEndTime are required' 
            });
        }
        
        console.log(`Counter-proposal for ${proposalId} by ${userEmail}`);
        
        // Get user
        const userResult = await partnerCoordination.getUserWithAvailability(userEmail);
        if (!userResult.success) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        // Get original proposal
        const { data: originalProposal, error: proposalError } = await supabase
            .from('session_proposals')
            .select('*')
            .eq('id', proposalId)
            .single();
            
        if (proposalError || !originalProposal) {
            return res.status(404).json({ error: 'Original proposal not found' });
        }
        
        // Verify user can counter-propose (must be the partner)
        if (originalProposal.partner_id !== userResult.data.id) {
            return res.status(403).json({ error: 'Only the proposal recipient can counter-propose' });
        }
        
        if (originalProposal.status !== 'pending') {
            return res.status(400).json({ error: 'Can only counter-propose to pending proposals' });
        }
        
        // Validate session duration (minimum 2 hours)
        if (counterEndTime - counterStartTime < 4) {
            return res.status(400).json({ error: 'Counter-proposal must be at least 2 hours long' });
        }
        
        // Update original proposal status
        await supabase
            .from('session_proposals')
            .update({ 
                status: 'counter_proposed',
                responded_at: new Date().toISOString(),
                response_message: `Counter-proposed: ${message}`
            })
            .eq('id', proposalId);
        
        // Create counter-proposal
        const { data: counterProposal, error: counterError } = await supabase
            .from('session_proposals')
            .insert({
                proposer_id: userResult.data.id,
                partner_id: originalProposal.proposer_id,
                proposed_date: counterDate,
                proposed_start_time: counterStartTime,
                proposed_end_time: counterEndTime,
                response_message: message,
                parent_proposal_id: proposalId
            })
            .select()
            .single();
            
        if (counterError) {
            return res.status(500).json({ error: counterError.message });
        }
        
        console.log('✅ Counter-proposal created, real-time notifications will be sent automatically');
        
        res.json({
            success: true,
            message: 'Counter-proposal created',
            originalProposal: originalProposal,
            counterProposal: counterProposal,
            realtimeSync: 'enabled',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in counter-proposal endpoint:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`🏋️ GymBuddy API running on port ${PORT}`);
    console.log('📡 Real-time synchronization service active');
    console.log(`🔗 SSE endpoint: http://localhost:${PORT}/realtime/connect/:userEmail`);
    console.log(`📊 Real-time status: http://localhost:${PORT}/realtime/status`);
    console.log(`🤝 Partner coordination: http://localhost:${PORT}/partners/find/:identifier`);
    console.log(`📅 Session proposals: http://localhost:${PORT}/sessions/propose`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await realtimeSync.cleanup();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await realtimeSync.cleanup();
    process.exit(0);
});