/**
 * Real-time Synchronization Service
 * 
 * Provides instant updates to both partners when coordination state changes.
 * Uses Supabase Realtime subscriptions and Server-Sent Events for immediate sync.
 */

class RealtimeSyncService {
    constructor(supabase) {
        this.supabase = supabase;
        this.activeConnections = new Map(); // Store SSE connections
        this.subscriptions = new Map(); // Store Supabase subscriptions
        
        // Initialize realtime subscriptions
        this.setupRealtimeSubscriptions();
    }

    // ========================================
    // SUPABASE REALTIME SUBSCRIPTIONS
    // ========================================

    setupRealtimeSubscriptions() {
        console.log('Setting up Supabase realtime subscriptions...');

        // Subscribe to partner requests changes
        this.subscriptions.set('partner_requests', 
            this.supabase
                .channel('partner_requests_changes')
                .on('postgres_changes', 
                    { event: '*', schema: 'public', table: 'partner_requests' },
                    (payload) => this.handlePartnerRequestChange(payload)
                )
                .subscribe()
        );

        // Subscribe to session proposals changes
        this.subscriptions.set('session_proposals',
            this.supabase
                .channel('session_proposals_changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'session_proposals' },
                    (payload) => this.handleSessionProposalChange(payload)
                )
                .subscribe()
        );

        // Subscribe to sessions changes (confirmations, cancellations)
        this.subscriptions.set('sessions',
            this.supabase
                .channel('sessions_changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'sessions' },
                    (payload) => this.handleSessionChange(payload)
                )
                .subscribe()
        );

        // Subscribe to coordination states changes
        this.subscriptions.set('coordination_states',
            this.supabase
                .channel('coordination_states_changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'coordination_states' },
                    (payload) => this.handleCoordinationStateChange(payload)
                )
                .subscribe()
        );

        // Subscribe to availability changes (impacts partner matching)
        this.subscriptions.set('availability',
            this.supabase
                .channel('availability_changes')
                .on('postgres_changes',
                    { event: '*', schema: 'public', table: 'availability' },
                    (payload) => this.handleAvailabilityChange(payload)
                )
                .subscribe()
        );

        console.log('✅ Realtime subscriptions established');
    }

    // ========================================
    // REALTIME EVENT HANDLERS
    // ========================================

    async handlePartnerRequestChange(payload) {
        try {
            console.log('Partner request change detected:', payload.eventType);
            
            const { new: newRecord, old: oldRecord, eventType } = payload;
            const record = newRecord || oldRecord;

            if (!record) return;

            // Get both users involved
            const [requester, requestedUser] = await this.getUsersByIds([
                record.requester_id, 
                record.requested_user_id
            ]);

            const eventData = {
                type: 'partner_request_update',
                event: eventType,
                request: record,
                requester,
                requestedUser,
                timestamp: new Date().toISOString()
            };

            // Notify both users
            await this.notifyUsers([record.requester_id, record.requested_user_id], eventData);

            // Send Telegram notifications if status changed
            if (eventType === 'UPDATE' && newRecord.status !== oldRecord?.status) {
                await this.sendTelegramNotification(eventData);
            }

        } catch (error) {
            console.error('Error handling partner request change:', error);
        }
    }

    async handleSessionProposalChange(payload) {
        try {
            console.log('Session proposal change detected:', payload.eventType);
            
            const { new: newRecord, old: oldRecord, eventType } = payload;
            const record = newRecord || oldRecord;

            if (!record) return;

            // Get both partners
            const [proposer, partner] = await this.getUsersByIds([
                record.proposer_id,
                record.partner_id
            ]);

            const eventData = {
                type: 'session_proposal_update',
                event: eventType,
                proposal: record,
                proposer,
                partner,
                timestamp: new Date().toISOString()
            };

            // Notify both partners instantly
            await this.notifyUsers([record.proposer_id, record.partner_id], eventData);

            // Send Telegram notifications for status changes
            if (eventType === 'UPDATE' && newRecord.status !== oldRecord?.status) {
                await this.sendTelegramNotification(eventData);
            }

            // Update coordination state if proposal accepted
            if (newRecord?.status === 'accepted') {
                await this.updateCoordinationProgress(record.proposer_id, record.partner_id);
            }

        } catch (error) {
            console.error('Error handling session proposal change:', error);
        }
    }

    async handleSessionChange(payload) {
        try {
            console.log('Session change detected:', payload.eventType);
            
            const { new: newRecord, old: oldRecord, eventType } = payload;
            const record = newRecord || oldRecord;

            if (!record?.participants) return;

            // Get participating users
            const users = await this.getUsersByIds(record.participants);

            const eventData = {
                type: 'session_update',
                event: eventType,
                session: record,
                participants: users,
                timestamp: new Date().toISOString()
            };

            // Notify all participants instantly
            await this.notifyUsers(record.participants, eventData);

            // Send Telegram notifications for important changes
            if (eventType === 'INSERT' || 
                (eventType === 'UPDATE' && newRecord.status !== oldRecord?.status)) {
                await this.sendTelegramNotification(eventData);
            }

        } catch (error) {
            console.error('Error handling session change:', error);
        }
    }

    async handleCoordinationStateChange(payload) {
        try {
            console.log('Coordination state change detected:', payload.eventType);
            
            const { new: newRecord, old: oldRecord } = payload;
            const record = newRecord || oldRecord;

            if (!record) return;

            // Get both partners
            const [partner1, partner2] = await this.getUsersByIds([
                record.partner_1_id,
                record.partner_2_id
            ]);

            const eventData = {
                type: 'coordination_state_update',
                state: record,
                partner1,
                partner2,
                previousState: oldRecord?.state,
                currentState: newRecord?.state,
                timestamp: new Date().toISOString()
            };

            // Notify both partners
            await this.notifyUsers([record.partner_1_id, record.partner_2_id], eventData);

        } catch (error) {
            console.error('Error handling coordination state change:', error);
        }
    }

    async handleAvailabilityChange(payload) {
        try {
            console.log('Availability change detected:', payload.eventType);
            
            const { new: newRecord, old: oldRecord } = payload;
            const record = newRecord || oldRecord;

            if (!record?.user_id) return;

            // Get user and their partner
            const user = await this.getUserById(record.user_id);
            if (!user?.partner_id) return;

            const partner = await this.getUserById(user.partner_id);

            const eventData = {
                type: 'availability_update',
                event: payload.eventType,
                user,
                partner,
                availabilityChange: record,
                timestamp: new Date().toISOString()
            };

            // Notify both user and partner
            await this.notifyUsers([user.id, partner.id], eventData);

            // Trigger re-calculation of session suggestions
            await this.recalculateSessionSuggestions(user.id, partner.id);

        } catch (error) {
            console.error('Error handling availability change:', error);
        }
    }

    // ========================================
    // SERVER-SENT EVENTS (SSE) IMPLEMENTATION
    // ========================================

    setupSSEConnection(req, res) {
        const { userEmail } = req.params;
        
        if (!userEmail) {
            return res.status(400).json({ error: 'userEmail parameter required' });
        }

        console.log(`Setting up SSE connection for user: ${userEmail}`);

        // Set SSE headers
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Cache-Control'
        });

        // Send initial connection confirmation
        res.write(`data: ${JSON.stringify({
            type: 'connection_established',
            userEmail,
            timestamp: new Date().toISOString(),
            message: 'Real-time sync active'
        })}\n\n`);

        // Store connection
        this.activeConnections.set(userEmail, res);

        // Handle client disconnect
        req.on('close', () => {
            console.log(`SSE connection closed for user: ${userEmail}`);
            this.activeConnections.delete(userEmail);
        });

        // Keep connection alive with heartbeat
        const heartbeat = setInterval(() => {
            if (res.finished) {
                clearInterval(heartbeat);
                this.activeConnections.delete(userEmail);
                return;
            }
            
            res.write(`data: ${JSON.stringify({
                type: 'heartbeat',
                timestamp: new Date().toISOString()
            })}\n\n`);
        }, 30000); // 30 seconds

        return res;
    }

    // ========================================
    // NOTIFICATION DELIVERY
    // ========================================

    async notifyUsers(userIds, eventData) {
        if (!Array.isArray(userIds)) return;

        // Get user emails for notification delivery
        const users = await this.getUsersByIds(userIds);
        
        for (const user of users) {
            // Send via SSE if user has active connection
            if (this.activeConnections.has(user.email)) {
                this.sendSSEMessage(user.email, eventData);
            }

            // Store notification in database for later retrieval
            await this.storeNotification(user.id, eventData);
        }
    }

    sendSSEMessage(userEmail, data) {
        const connection = this.activeConnections.get(userEmail);
        if (connection && !connection.finished) {
            try {
                connection.write(`data: ${JSON.stringify(data)}\n\n`);
            } catch (error) {
                console.error(`Error sending SSE message to ${userEmail}:`, error);
                this.activeConnections.delete(userEmail);
            }
        }
    }

    async storeNotification(userId, eventData) {
        try {
            const notification = this.formatNotificationForStorage(userId, eventData);
            
            const { error } = await this.supabase
                .from('notifications')
                .insert([notification]);

            if (error) {
                console.error('Error storing notification:', error);
            }
        } catch (error) {
            console.error('Error in storeNotification:', error);
        }
    }

    formatNotificationForStorage(userId, eventData) {
        let type, title, message, data = {};
        
        switch (eventData.type) {
            case 'partner_request_update':
                if (eventData.request.status === 'pending') {
                    type = 'partner_request_received';
                    title = 'New Partner Request';
                    message = `${eventData.requester.name} wants to be your gym partner!`;
                } else if (eventData.request.status === 'accepted') {
                    type = 'partner_request_accepted';
                    title = 'Partner Request Accepted';
                    message = `${eventData.requestedUser.name} accepted your partner request!`;
                } else {
                    type = 'partner_request_rejected';
                    title = 'Partner Request Declined';
                    message = `Your partner request was declined.`;
                }
                data = { partner_request_id: eventData.request.id };
                break;

            case 'session_proposal_update':
                if (eventData.proposal.status === 'pending') {
                    type = 'session_proposed';
                    title = 'New Session Proposal';
                    message = `${eventData.proposer.name} proposed a gym session for ${eventData.proposal.proposed_date}`;
                } else if (eventData.proposal.status === 'accepted') {
                    type = 'session_proposal_accepted';
                    title = 'Session Proposal Accepted';
                    message = `Your session proposal was accepted! Session confirmed.`;
                } else {
                    type = 'session_proposal_rejected';
                    title = 'Session Proposal Declined';
                    message = `Your session proposal was declined.`;
                }
                data = { session_proposal_id: eventData.proposal.id };
                break;

            case 'session_update':
                if (eventData.event === 'INSERT') {
                    type = 'session_confirmed';
                    title = 'Session Confirmed';
                    message = `Gym session confirmed for ${eventData.session.date}`;
                } else if (eventData.session.status === 'cancelled') {
                    type = 'session_cancelled';
                    title = 'Session Cancelled';
                    message = `Gym session for ${eventData.session.date} has been cancelled`;
                }
                data = { session_id: eventData.session.id };
                break;

            case 'availability_update':
                type = 'availability_coordination_ready';
                title = 'Availability Updated';
                message = `${eventData.user.name} updated their availability. New session suggestions may be available!`;
                data = { partner_id: eventData.partner.id };
                break;

            default:
                type = 'session_reminder';
                title = 'Coordination Update';
                message = 'There was an update to your gym partner coordination';
                break;
        }

        return {
            user_id: userId,
            type,
            title,
            message,
            data
        };
    }

    // ========================================
    // TELEGRAM NOTIFICATION INTEGRATION
    // ========================================

    async sendTelegramNotification(eventData) {
        try {
            // This would integrate with your existing Telegram bot
            // For now, we'll log the notification
            console.log('📱 Telegram notification:', {
                type: eventData.type,
                users: eventData.requester?.name || eventData.proposer?.name,
                status: eventData.request?.status || eventData.proposal?.status
            });

            // TODO: Integrate with actual Telegram bot service
            // You could call your bot's notification endpoint here
        } catch (error) {
            console.error('Error sending Telegram notification:', error);
        }
    }

    // ========================================
    // UTILITY FUNCTIONS
    // ========================================

    async getUserById(userId) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('id, name, email, partner_id, telegram_id')
                .eq('id', userId)
                .single();

            return error ? null : data;
        } catch (error) {
            console.error('Error getting user by ID:', error);
            return null;
        }
    }

    async getUsersByIds(userIds) {
        try {
            const { data, error } = await this.supabase
                .from('users')
                .select('id, name, email, partner_id, telegram_id')
                .in('id', userIds);

            return error ? [] : data;
        } catch (error) {
            console.error('Error getting users by IDs:', error);
            return [];
        }
    }

    async updateCoordinationProgress(partner1Id, partner2Id) {
        try {
            // Get coordination state
            const { data: coordination, error } = await this.supabase
                .from('coordination_states')
                .select('*')
                .or(`and(partner_1_id.eq.${partner1Id},partner_2_id.eq.${partner2Id}),and(partner_1_id.eq.${partner2Id},partner_2_id.eq.${partner1Id})`)
                .single();

            if (error || !coordination) {
                console.log('No coordination state found, creating...');
                await this.supabase
                    .from('coordination_states')
                    .insert({
                        partner_1_id: Math.min(partner1Id, partner2Id),
                        partner_2_id: Math.max(partner1Id, partner2Id),
                        state: 'sessions_confirmed'
                    });
            } else {
                // Update state to reflect progress
                await this.supabase
                    .from('coordination_states')
                    .update({ 
                        state: 'sessions_confirmed',
                        completed_sessions_count: (coordination.completed_sessions_count || 0) + 1
                    })
                    .eq('id', coordination.id);
            }
        } catch (error) {
            console.error('Error updating coordination progress:', error);
        }
    }

    async recalculateSessionSuggestions(userId1, userId2) {
        try {
            // Trigger recalculation of session suggestions
            // This would typically call your session matching algorithm
            console.log(`🔄 Recalculating session suggestions for users ${userId1} and ${userId2}`);
            
            // Update coordination state to indicate suggestions need refresh
            const { error } = await this.supabase
                .from('coordination_states')
                .update({ 
                    state: 'availability_ready',
                    last_availability_check: new Date().toISOString()
                })
                .or(`and(partner_1_id.eq.${userId1},partner_2_id.eq.${userId2}),and(partner_1_id.eq.${userId2},partner_2_id.eq.${userId1})`);

            if (error) {
                console.error('Error updating coordination state:', error);
            }
        } catch (error) {
            console.error('Error in recalculateSessionSuggestions:', error);
        }
    }

    // ========================================
    // CONNECTION MANAGEMENT
    // ========================================

    getActiveConnectionsCount() {
        return this.activeConnections.size;
    }

    getActiveConnections() {
        return Array.from(this.activeConnections.keys());
    }

    async cleanup() {
        console.log('Cleaning up realtime sync service...');
        
        // Close all SSE connections
        for (const [email, connection] of this.activeConnections) {
            if (!connection.finished) {
                connection.end();
            }
        }
        this.activeConnections.clear();

        // Unsubscribe from all Supabase subscriptions
        for (const [name, subscription] of this.subscriptions) {
            await subscription.unsubscribe();
        }
        this.subscriptions.clear();

        console.log('✅ Realtime sync service cleaned up');
    }
}

module.exports = RealtimeSyncService;