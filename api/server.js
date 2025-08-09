const express = require('express');
const { createClient } = require('@supabase/supabase-js');
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

// CORS middleware for n8n
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
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
            common_availability: 'GET /availability/common/:user1/:user2',
            
            // Sessions
            upcoming_sessions: 'GET /sessions/upcoming',
            book_session: 'POST /sessions/book',
            cancel_session: 'POST /sessions/cancel',
            
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

// Get both users' availability and find common slots
app.get('/availability/common/:user1/:user2', async (req, res) => {
    try {
        const { user1, user2 } = req.params;
        
        // Get both users' availability
        const [user1Data, user2Data] = await Promise.all([
            fetch(`http://localhost:${PORT}/availability/${user1}`).then(r => r.json()),
            fetch(`http://localhost:${PORT}/availability/${user2}`).then(r => r.json())
        ]);

        // Find overlapping slots
        const commonSlots = [];
        
        // Logic to find 2-hour overlapping slots
        // This is simplified - you'd need more complex logic for real overlap detection
        
        res.json({
            user1: user1Data,
            user2: user2Data,
            commonSlots: commonSlots,
            suggestedSessions: [] // Add logic to suggest 2 optimal sessions
        });
    } catch (error) {
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

app.listen(PORT, () => {
    console.log(`🏋️ GymBuddy API running on port ${PORT}`);
});