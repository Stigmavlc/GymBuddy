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
        endpoints: {
            availability: '/availability/:username',
            sessions: '/sessions',
            book: '/sessions/book',
            cancel: '/sessions/cancel'
        }
    });
});

// Get user availability for the week
app.get('/availability/:username', async (req, res) => {
    try {
        const { username } = req.params;
        
        // Get user ID
        const { data: user, error: userError } = await supabase
            .from('users')
            .select('id')
            .ilike('name', username)
            .single();
            
        if (userError || !user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Get availability for current week
        const startOfWeek = new Date();
        startOfWeek.setHours(0, 0, 0, 0);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
        
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 7);

        const { data: availability, error } = await supabase
            .from('availability')
            .select('*')
            .eq('user_id', user.id)
            .gte('start_time', startOfWeek.toISOString())
            .lt('start_time', endOfWeek.toISOString());

        if (error) {
            return res.status(500).json({ error: error.message });
        }

        res.json({
            user: username,
            hasAvailability: availability.length > 0,
            slots: availability.map(slot => ({
                day: new Date(slot.start_time).toLocaleDateString('en-US', { weekday: 'long' }),
                start: new Date(slot.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                end: new Date(slot.end_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
            }))
        });
    } catch (error) {
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