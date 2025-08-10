/**
 * GymBuddy API Service for Telegram Bot Integration
 * 
 * This service replaces direct Supabase database calls with HTTP API requests
 * to ensure proper synchronization between bot operations and website.
 * 
 * Key Features:
 * - Email-based user identification (maps Telegram ID to email)
 * - Structured logging for debugging bot operations
 * - Error handling for HTTP requests vs database errors
 * - Real-time sync verification
 */

const fetch = require('node-fetch');

class GymBuddyAPIService {
    constructor() {
        this.baseURL = process.env.GYMBUDDY_API_URL || 'https://gymbuddy-api-ivan-9969a58fc7f4.herokuapp.com';
        this.userMapping = {
            // Map Telegram IDs to email addresses for user identification
            '1195143765': 'ivanaguilarmari@gmail.com',  // Ivan
            // Add Youssef's Telegram ID when available
            // 'YOUSSEF_TELEGRAM_ID': 'youssef@domain.com'
        };
        
        // Debug logging toggle
        this.debugMode = process.env.BOT_DEBUG_MODE === 'true';
        
        console.log(`[API Service] Initialized with base URL: ${this.baseURL}`);
        console.log(`[API Service] Debug mode: ${this.debugMode ? 'ON' : 'OFF'}`);
    }

    /**
     * Convert Telegram user ID to email address for API operations
     */
    getTelegramUserEmail(telegramId) {
        const email = this.userMapping[telegramId];
        this.debugLog(`User identification: Telegram ID ${telegramId} → Email ${email || 'NOT FOUND'}`);
        return email;
    }

    /**
     * Debug logging helper
     */
    debugLog(message, data = null) {
        if (this.debugMode) {
            const timestamp = new Date().toISOString();
            console.log(`[API Service Debug ${timestamp}] ${message}`);
            if (data) {
                console.log(`[API Service Debug ${timestamp}] Data:`, JSON.stringify(data, null, 2));
            }
        }
    }

    /**
     * Make HTTP request to API with proper error handling
     */
    async makeAPIRequest(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const requestOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'GymBuddy-Bot/1.0'
            },
            timeout: 10000, // 10 second timeout
            ...options
        };

        this.debugLog(`Making API request: ${requestOptions.method} ${url}`, {
            headers: requestOptions.headers,
            body: requestOptions.body
        });

        try {
            const response = await fetch(url, requestOptions);
            const responseData = await response.json();

            this.debugLog(`API response: ${response.status} ${response.statusText}`, responseData);

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText} - ${JSON.stringify(responseData)}`);
            }

            return {
                success: true,
                status: response.status,
                data: responseData
            };
        } catch (error) {
            console.error(`[API Service Error] Request failed: ${error.message}`);
            console.error(`[API Service Error] URL: ${url}`);
            console.error(`[API Service Error] Options:`, requestOptions);
            
            return {
                success: false,
                error: error.message,
                url: url
            };
        }
    }

    /**
     * Get user information by Telegram ID (converted to email)
     */
    async getUserByTelegramId(telegramId) {
        console.log(`[Bot Operation] Looking up user by Telegram ID: ${telegramId}`);
        
        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            console.error(`[Bot Error] No email mapping found for Telegram ID: ${telegramId}`);
            return null;
        }

        const result = await this.makeAPIRequest(`/user/by-email/${encodeURIComponent(email)}`);
        
        if (result.success) {
            console.log(`[Bot Operation] Found user: ${result.data.user.name} (${result.data.user.email})`);
            return {
                id: result.data.user.id,
                name: result.data.user.name,
                email: result.data.user.email,
                telegram_id: telegramId // Add back for bot compatibility
            };
        } else {
            console.error(`[Bot Error] User lookup failed: ${result.error}`);
            return null;
        }
    }

    /**
     * Get user's current availability
     */
    async getUserAvailability(telegramId) {
        console.log(`[Bot Operation] Getting availability for Telegram ID: ${telegramId}`);
        
        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            console.error(`[Bot Error] No email mapping found for Telegram ID: ${telegramId}`);
            return [];
        }

        const result = await this.makeAPIRequest(`/availability/by-email/${encodeURIComponent(email)}`);
        
        if (result.success) {
            const slots = result.data.slots || [];
            console.log(`[Bot Operation] Found ${slots.length} availability slots for ${result.data.user}`);
            
            // Convert API format to bot-expected format
            return slots.map(slot => ({
                id: slot.id,
                user_id: result.data.userId,
                day: slot.day,
                start_time: slot.startTime,
                end_time: slot.endTime,
                created_at: slot.created
            }));
        } else {
            console.error(`[Bot Error] Availability lookup failed: ${result.error}`);
            return [];
        }
    }

    /**
     * Clear user's availability (main bot operation)
     */
    async clearUserAvailability(telegramId) {
        console.log(`[Bot Operation] Clearing availability for Telegram ID: ${telegramId}`);
        
        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            console.error(`[Bot Error] No email mapping found for Telegram ID: ${telegramId}`);
            return { success: false, error: 'User not found' };
        }

        const result = await this.makeAPIRequest(`/availability/by-email/${encodeURIComponent(email)}`, {
            method: 'DELETE'
        });
        
        if (result.success) {
            console.log(`[Bot Operation] Successfully cleared ${result.data.deletedCount} availability slots`);
            return {
                success: true,
                user: result.data.user,
                deletedCount: result.data.deletedCount,
                message: result.data.message
            };
        } else {
            console.error(`[Bot Error] Clear availability failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Set user's availability
     */
    async setUserAvailability(telegramId, availabilitySlots) {
        console.log(`[Bot Operation] Setting availability for Telegram ID: ${telegramId}`);
        this.debugLog('Availability slots to set:', JSON.stringify(availabilitySlots, null, 2));
        
        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            console.error(`[Bot Error] No email mapping found for Telegram ID: ${telegramId}`);
            return { success: false, error: 'User not found' };
        }

        // Log the exact payload being sent
        const payload = { slots: availabilitySlots };
        console.log(`[API Debug] Sending POST to /availability/by-email/${email}`);
        console.log('[API Debug] Payload:', JSON.stringify(payload, null, 2));

        const result = await this.makeAPIRequest(`/availability/by-email/${encodeURIComponent(email)}`, {
            method: 'POST',
            body: JSON.stringify(payload)
        });
        
        if (result.success) {
            console.log(`[Bot Operation] Successfully set ${result.data.slots?.length || 0} availability slots`);
            return {
                success: true,
                user: result.data.user,
                slotsSet: result.data.slots?.length || 0,
                message: result.data.message
            };
        } else {
            console.error(`[Bot Error] Set availability failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Test real-time sync functionality
     */
    async testSync(telegramId) {
        console.log(`[Bot Operation] Testing sync for Telegram ID: ${telegramId}`);
        
        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            console.error(`[Bot Error] No email mapping found for Telegram ID: ${telegramId}`);
            return { success: false, error: 'User not found' };
        }

        const result = await this.makeAPIRequest(`/debug/test-sync/${encodeURIComponent(email)}`, {
            method: 'POST'
        });
        
        if (result.success) {
            console.log(`[Bot Operation] Sync test completed for ${result.data.user}`);
            return {
                success: true,
                message: result.data.message,
                note: result.data.note
            };
        } else {
            console.error(`[Bot Error] Sync test failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Get comprehensive sync status for debugging
     */
    async getSyncStatus(telegramId = null) {
        console.log(`[Bot Operation] Getting sync status${telegramId ? ` for Telegram ID: ${telegramId}` : ' for all users'}`);
        
        let endpoint = '/debug/sync-status';
        
        if (telegramId) {
            const email = this.getTelegramUserEmail(telegramId);
            if (!email) {
                console.error(`[Bot Error] No email mapping found for Telegram ID: ${telegramId}`);
                return { success: false, error: 'User not found' };
            }
            endpoint += `/${encodeURIComponent(email)}`;
        }

        const result = await this.makeAPIRequest(endpoint);
        
        if (result.success) {
            console.log(`[Bot Operation] Sync status retrieved successfully`);
            return {
                success: true,
                stats: result.data.stats,
                users: result.data.users,
                availability: result.data.availability
            };
        } else {
            console.error(`[Bot Error] Sync status failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Get user's confirmed sessions
     */
    async getUserSessions(telegramId) {
        console.log(`[Bot Operation] Getting sessions for Telegram ID: ${telegramId}`);
        
        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            console.error(`[Bot Error] No email mapping found for Telegram ID: ${telegramId}`);
            console.error('[SESSIONS DEBUG] Available user mappings:', Object.keys(this.userMapping));
            return [];
        }

        console.log('[SESSIONS DEBUG] User email resolved:', email);
        console.log('[SESSIONS DEBUG] About to make API request to:', `/sessions/by-email/${encodeURIComponent(email)}`);
        console.log('[SESSIONS DEBUG] Full URL will be:', `${this.baseURL}/sessions/by-email/${encodeURIComponent(email)}`);

        const result = await this.makeAPIRequest(`/sessions/by-email/${encodeURIComponent(email)}`);
        
        console.log('[SESSIONS DEBUG] API request result:', {
            success: result.success,
            status: result.status,
            error: result.error,
            dataKeys: result.data ? Object.keys(result.data) : null
        });
        
        if (result.success) {
            const sessions = result.data.sessions || [];
            console.log(`[Bot Operation] Found ${sessions.length} sessions for ${result.data.user}`);
            console.log('[SESSIONS DEBUG] Raw sessions data:', JSON.stringify(sessions, null, 2));
            
            // Convert API format to bot-expected format
            // API uses: { date, start_time, end_time }
            // Bot expects: { day, start_time, end_time }
            const convertedSessions = sessions.map(session => {
                // Convert date (YYYY-MM-DD) to day name
                let dayName = 'unknown';
                if (session.date) {
                    try {
                        const dateObj = new Date(session.date + 'T00:00:00Z'); // Add time to avoid timezone issues
                        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                        dayName = days[dateObj.getUTCDay()];
                    } catch (e) {
                        console.error('[SESSIONS DEBUG] Error converting date to day name:', session.date, e.message);
                        dayName = session.date; // fallback to the date string
                    }
                }
                
                return {
                    id: session.id,
                    user_id: result.data.userId,
                    day: dayName,                    // ← Fixed: convert date to day name
                    start_time: session.start_time,  // ← Fixed: API already uses start_time
                    end_time: session.end_time,      // ← Fixed: API already uses end_time
                    status: session.status || 'confirmed',
                    date: session.date,              // Keep original date for reference
                    created_at: session.created_at
                };
            });
            
            console.log('[SESSIONS DEBUG] Converted sessions:', JSON.stringify(convertedSessions, null, 2));
            return convertedSessions;
        } else {
            console.error(`[Bot Error] Sessions lookup failed: ${result.error}`);
            console.error('[SESSIONS DEBUG] Full error details:', {
                success: result.success,
                error: result.error,
                url: result.url,
                status: result.status
            });
            
            // Check if this is a 404 (endpoint doesn't exist) vs other error
            if (result.error && result.error.includes('404')) {
                console.error('[SESSIONS DEBUG] 404 Error - Sessions endpoint may not exist on API server');
            } else if (result.error && result.error.includes('500')) {
                console.error('[SESSIONS DEBUG] 500 Error - Server error in sessions endpoint');
            }
            
            return [];
        }
    }

    /**
     * Cancel a specific user session
     */
    async cancelUserSession(telegramId, sessionId) {
        console.log(`[Bot Operation] Canceling session ${sessionId} for Telegram ID: ${telegramId}`);
        
        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            console.error(`[Bot Error] No email mapping found for Telegram ID: ${telegramId}`);
            return { success: false, error: 'User not found' };
        }

        const result = await this.makeAPIRequest(`/sessions/${sessionId}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ userEmail: email })
        });
        
        if (result.success) {
            console.log(`[Bot Operation] Successfully canceled session ${sessionId}`);
            return {
                success: true,
                sessionId: sessionId,
                message: result.data.message
            };
        } else {
            console.error(`[Bot Error] Session cancellation failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Delete a specific user session
     */
    async deleteUserSession(telegramId, sessionId) {
        console.log(`[Bot Operation] Deleting session ${sessionId} for Telegram ID: ${telegramId}`);
        
        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            console.error(`[Bot Error] No email mapping found for Telegram ID: ${telegramId}`);
            return { success: false, error: 'User not found' };
        }

        const result = await this.makeAPIRequest(`/sessions/${sessionId}/by-email/${encodeURIComponent(email)}`, {
            method: 'DELETE'
        });
        
        if (result.success) {
            console.log(`[Bot Operation] Successfully deleted session ${sessionId}`);
            return {
                success: true,
                sessionId: sessionId,
                message: result.data.message
            };
        } else {
            console.error(`[Bot Error] Session deletion failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Health check for API connectivity
     */
    async healthCheck() {
        console.log(`[Bot Operation] Performing API health check`);
        
        const result = await this.makeAPIRequest('/');
        
        if (result.success) {
            console.log(`[Bot Operation] API health check passed - Version: ${result.data.version}`);
            return {
                success: true,
                status: result.data.status,
                version: result.data.version,
                endpoints: result.data.endpoints
            };
        } else {
            console.error(`[Bot Error] API health check failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Get user by email (for partner coordination)
     */
    async getUserByEmail(email) {
        console.log(`[Bot Operation] Getting user by email: ${email}`);
        
        const result = await this.makeAPIRequest(`/user/by-email/${encodeURIComponent(email)}`);
        
        if (result.success) {
            console.log(`[Bot Operation] Found user: ${result.data.user.name} (${result.data.user.email})`);
            return {
                success: true,
                user: result.data.user
            };
        } else {
            console.error(`[Bot Error] User lookup by email failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Find partner by email or Telegram ID
     */
    async findPartner(identifier) {
        console.log(`[Bot Operation] Finding partner: ${identifier}`);
        
        const result = await this.makeAPIRequest(`/partners/find/${encodeURIComponent(identifier)}`);
        
        if (result.success) {
            console.log(`[Bot Operation] Found partner: ${result.data.partner.name}`);
            return {
                success: true,
                partner: result.data.partner
            };
        } else {
            console.error(`[Bot Error] Partner search failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Get partner status for user
     */
    async getPartnerStatus(email) {
        console.log(`[Bot Operation] Getting partner status for: ${email}`);
        
        const result = await this.makeAPIRequest(`/partners/status/${encodeURIComponent(email)}`);
        
        if (result.success) {
            console.log(`[Bot Operation] Partner status: ${result.data.relationshipStatus}`);
            return {
                success: true,
                ...result.data
            };
        } else {
            console.error(`[Bot Error] Partner status check failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Send partner request
     */
    async sendPartnerRequest(requesterEmail, targetIdentifier, message = '') {
        console.log(`[Bot Operation] Sending partner request from ${requesterEmail} to ${targetIdentifier}`);
        
        const result = await this.makeAPIRequest('/partners/request', {
            method: 'POST',
            body: JSON.stringify({
                requesterIdentifier: requesterEmail,
                targetIdentifier: targetIdentifier,
                message: message
            })
        });
        
        if (result.success) {
            console.log(`[Bot Operation] Partner request sent successfully`);
            return {
                success: true,
                request: result.data.request,
                message: result.data.message
            };
        } else {
            console.error(`[Bot Error] Partner request failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Respond to partner request
     */
    async respondToPartnerRequest(requestId, userEmail, response, message = '') {
        console.log(`[Bot Operation] Responding to partner request ${requestId}: ${response}`);
        
        const result = await this.makeAPIRequest(`/partners/requests/${requestId}/respond`, {
            method: 'PUT',
            body: JSON.stringify({
                userEmail: userEmail,
                response: response,
                message: message
            })
        });
        
        if (result.success) {
            console.log(`[Bot Operation] Partner request response sent successfully`);
            return {
                success: true,
                message: result.data.message,
                partnersLinked: result.data.partnersLinked
            };
        } else {
            console.error(`[Bot Error] Partner request response failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Get common availability between two users (for session suggestions)
     */
    async getCommonAvailability(email1, email2) {
        console.log(`[Bot Operation] Getting common availability between ${email1} and ${email2}`);
        
        const result = await this.makeAPIRequest(`/availability/common/${encodeURIComponent(email1)}/${encodeURIComponent(email2)}`);
        
        if (result.success) {
            console.log(`[Bot Operation] Found ${result.data.overlappingSlots?.length || 0} overlapping slots`);
            return {
                success: true,
                ...result.data
            };
        } else {
            console.error(`[Bot Error] Common availability lookup failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Get session suggestions between two users
     */
    async getSessionSuggestions(email1, email2) {
        console.log(`[Bot Operation] Getting session suggestions between ${email1} and ${email2}`);
        
        const result = await this.makeAPIRequest(`/sessions/suggestions/${encodeURIComponent(email1)}/${encodeURIComponent(email2)}`);
        
        if (result.success) {
            console.log(`[Bot Operation] Found ${result.data.suggestions?.length || 0} session suggestions`);
            return {
                success: true,
                user1: result.data.user1,
                user2: result.data.user2,
                suggestions: result.data.suggestions,
                overlappingSlots: result.data.overlappingSlots
            };
        } else {
            console.error(`[Bot Error] Session suggestions failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Book a session
     */
    async bookSession(user1Email, user2Email, date, startTime, endTime) {
        console.log(`[Bot Operation] Booking session between ${user1Email} and ${user2Email}`);
        
        const result = await this.makeAPIRequest('/sessions/book', {
            method: 'POST',
            body: JSON.stringify({
                user1: user1Email,
                user2: user2Email,
                date: date,
                startTime: startTime,
                endTime: endTime
            })
        });
        
        if (result.success) {
            console.log(`[Bot Operation] Session booked successfully`);
            return {
                success: true,
                session: result.data.session,
                message: result.data.message
            };
        } else {
            console.error(`[Bot Error] Session booking failed: ${result.error}`);
            return { success: false, error: result.error };
        }
    }

    /**
     * Check if both users have availability (coordination trigger check)
     */
    async checkCoordinationTrigger(email1, email2) {
        console.log(`[Bot Operation] Checking coordination trigger for ${email1} and ${email2}`);
        
        try {
            // Get both users' availability
            const [user1Availability, user2Availability] = await Promise.all([
                this.getUserAvailability(this.getTelegramIdByEmail(email1)),
                this.getUserAvailability(this.getTelegramIdByEmail(email2))
            ]);
            
            const bothHaveAvailability = user1Availability.length > 0 && user2Availability.length > 0;
            
            console.log(`[Bot Operation] Coordination trigger: ${bothHaveAvailability ? 'YES' : 'NO'}`);
            console.log(`[Bot Operation] ${email1}: ${user1Availability.length} slots, ${email2}: ${user2Availability.length} slots`);
            
            return {
                success: true,
                shouldTrigger: bothHaveAvailability,
                user1Slots: user1Availability.length,
                user2Slots: user2Availability.length
            };
        } catch (error) {
            console.error(`[Bot Error] Coordination trigger check failed: ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get Telegram ID by email (helper method)
     */
    getTelegramIdByEmail(email) {
        // Reverse mapping
        const emailToTelegram = {};
        Object.entries(this.userMapping).forEach(([telegramId, userEmail]) => {
            emailToTelegram[userEmail] = telegramId;
        });
        
        return emailToTelegram[email];
    }
}

module.exports = GymBuddyAPIService;