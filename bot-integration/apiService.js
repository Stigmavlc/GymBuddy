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
            // TODO: Add Youssef's Telegram ID when provided by user
            // Note: This is the primary issue causing "Delete Monday session" to fail
            // as the bot cannot identify the user without proper mapping
            // 'YOUSSEF_TELEGRAM_ID': 'youssef@email.com'
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
     * Debug logging helper with structured logging levels
     */
    debugLog(message, data = null, level = 'DEBUG') {
        if (this.debugMode) {
            const timestamp = new Date().toISOString();
            const logPrefix = `[API Service ${level} ${timestamp}]`;
            console.log(`${logPrefix} ${message}`);
            if (data) {
                console.log(`${logPrefix} Data:`, JSON.stringify(data, null, 2));
            }
        }
    }

    /**
     * Error logging with stack traces
     */
    errorLog(message, error = null, context = {}) {
        const timestamp = new Date().toISOString();
        console.error(`[API Service ERROR ${timestamp}] ${message}`);
        if (error) {
            console.error(`[API Service ERROR ${timestamp}] Error:`, error.message);
            if (error.stack && this.debugMode) {
                console.error(`[API Service ERROR ${timestamp}] Stack:`, error.stack);
            }
        }
        if (Object.keys(context).length > 0) {
            console.error(`[API Service ERROR ${timestamp}] Context:`, JSON.stringify(context, null, 2));
        }
    }

    /**
     * API operation logging with structured data flow tracking
     */
    operationLog(operation, telegramId, details = {}) {
        const timestamp = new Date().toISOString();
        const email = this.getTelegramUserEmail(telegramId);
        console.log(`[API OPERATION ${timestamp}] ${operation}`);
        console.log(`[API OPERATION ${timestamp}] User: Telegram ID ${telegramId} → Email ${email || 'NOT MAPPED'}`);
        if (Object.keys(details).length > 0) {
            console.log(`[API OPERATION ${timestamp}] Details:`, JSON.stringify(details, null, 2));
        }
    }

    /**
     * Make HTTP request to API with comprehensive error handling and debugging
     */
    async makeAPIRequest(endpoint, options = {}) {
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const url = `${this.baseURL}${endpoint}`;
        const requestOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'GymBuddy-Bot/1.0',
                'X-Request-ID': requestId,
                // Add cache-busting headers to ensure fresh data
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'X-Timestamp': Date.now().toString()
            },
            timeout: 10000, // 10 second timeout
            ...options
        };

        const startTime = Date.now();
        
        // Enhanced request logging
        this.debugLog(`🚀 API REQUEST [${requestId}]: ${requestOptions.method} ${url}`, {
            headers: requestOptions.headers,
            body: requestOptions.body ? JSON.parse(requestOptions.body) : undefined,
            timeout: requestOptions.timeout
        }, 'REQUEST');

        try {
            const response = await fetch(url, requestOptions);
            const duration = Date.now() - startTime;
            
            // Log response headers and status
            this.debugLog(`📥 API RESPONSE [${requestId}]: ${response.status} ${response.statusText} (${duration}ms)`, {
                headers: Object.fromEntries(response.headers.entries()),
                statusCode: response.status,
                duration: duration
            }, 'RESPONSE');

            let responseData;
            try {
                responseData = await response.json();
            } catch (parseError) {
                this.errorLog(`Failed to parse JSON response from ${url}`, parseError, {
                    requestId,
                    status: response.status,
                    contentType: response.headers.get('content-type')
                });
                throw new Error(`Invalid JSON response from API: ${parseError.message}`);
            }

            this.debugLog(`📄 API DATA [${requestId}]:`, responseData, 'DATA');

            if (!response.ok) {
                const errorMessage = `API request failed: ${response.status} ${response.statusText}`;
                this.errorLog(errorMessage, null, {
                    requestId,
                    url,
                    method: requestOptions.method,
                    status: response.status,
                    responseData,
                    duration
                });
                
                throw new Error(`${errorMessage} - ${JSON.stringify(responseData)}`);
            }

            // Log successful operation
            console.log(`✅ [API SUCCESS] ${requestOptions.method} ${endpoint} completed in ${duration}ms`);

            return {
                success: true,
                status: response.status,
                data: responseData,
                requestId,
                duration
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Comprehensive error logging
            this.errorLog(`❌ API request failed [${requestId}]`, error, {
                url,
                method: requestOptions.method,
                endpoint,
                duration,
                timeout: requestOptions.timeout,
                errorType: error.name,
                isNetworkError: error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND',
                isTimeoutError: error.message.includes('timeout')
            });
            
            return {
                success: false,
                error: error.message,
                url,
                requestId,
                duration,
                errorType: error.name
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
     * Get user's current availability with comprehensive debugging
     */
    async getUserAvailability(telegramId) {
        this.operationLog('GET_AVAILABILITY_START', telegramId);
        
        // Step 1: Validate Telegram ID mapping
        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            this.errorLog('No email mapping found for Telegram ID', null, {
                telegramId,
                availableMappings: Object.keys(this.userMapping)
            });
            return [];
        }

        this.debugLog(`📋 Availability request for: ${email}`, { telegramId, email });

        // Step 2: Make API request with enhanced tracking
        const endpoint = `/availability/by-email/${encodeURIComponent(email)}`;
        const result = await this.makeAPIRequest(endpoint);
        
        // Step 3: Process and validate response
        if (result.success) {
            const responseData = result.data;
            const slots = responseData.slots || [];
            
            // Detailed response validation and logging
            this.debugLog(`📊 API Response Analysis:`, {
                hasUser: !!responseData.user,
                hasUserId: !!responseData.userId,
                hasSlots: !!responseData.slots,
                slotsCount: slots.length,
                slotsArray: Array.isArray(slots),
                responseKeys: Object.keys(responseData)
            });

            if (slots.length > 0) {
                console.log(`✅ [AVAILABILITY SUCCESS] Found ${slots.length} slots for ${responseData.user || email}`);
                
                // Log each slot for debugging
                slots.forEach((slot, index) => {
                    this.debugLog(`📅 Slot ${index + 1}:`, {
                        id: slot.id,
                        day: slot.day,
                        startTime: slot.startTime,
                        endTime: slot.endTime,
                        created: slot.created,
                        hasAllRequiredFields: !!(slot.day && slot.startTime && slot.endTime)
                    });
                });
            } else {
                console.log(`ℹ️  [AVAILABILITY INFO] No availability slots found for ${responseData.user || email}`);
                this.debugLog('Empty availability analysis:', {
                    responseUser: responseData.user,
                    responseUserId: responseData.userId,
                    slotsProperty: responseData.slots,
                    slotsType: typeof responseData.slots,
                    fullResponse: responseData
                });
            }
            
            // Convert API format to bot-expected format with validation
            const convertedSlots = slots.map((slot, index) => {
                // Validate required fields
                if (!slot.day || !slot.startTime || !slot.endTime) {
                    this.errorLog(`Invalid slot data at index ${index}`, null, { slot });
                    return null;
                }
                
                return {
                    id: slot.id,
                    user_id: responseData.userId,
                    day: slot.day.toLowerCase(),
                    start_time: parseInt(slot.startTime),
                    end_time: parseInt(slot.endTime),
                    created_at: slot.created
                };
            }).filter(slot => slot !== null); // Remove invalid slots
            
            this.operationLog('GET_AVAILABILITY_SUCCESS', telegramId, {
                originalSlots: slots.length,
                validSlots: convertedSlots.length,
                requestDuration: result.duration
            });
            
            return convertedSlots;
        } else {
            // Enhanced error logging
            this.errorLog('Availability lookup failed', null, {
                telegramId,
                email,
                endpoint,
                apiError: result.error,
                requestId: result.requestId,
                duration: result.duration,
                errorType: result.errorType
            });
            
            this.operationLog('GET_AVAILABILITY_FAILED', telegramId, {
                error: result.error,
                duration: result.duration
            });
            
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
     * Delete specific availability slots based on criteria (day, time range)
     * This handles requests like "Delete the Monday session booked from 6-9am"
     */
    async deleteSpecificAvailability(telegramId, criteria) {
        this.operationLog('DELETE_SPECIFIC_AVAILABILITY_START', telegramId, criteria);
        
        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            this.errorLog('No email mapping found for specific deletion', null, {
                telegramId,
                criteria,
                availableMappings: Object.keys(this.userMapping)
            });
            return { success: false, error: 'User not found' };
        }

        try {
            // First, get current availability to find matching slots
            console.log('[DELETE SPECIFIC] Getting current availability...');
            const currentAvailability = await this.getUserAvailability(telegramId);
            
            if (!currentAvailability || currentAvailability.length === 0) {
                return { 
                    success: false, 
                    error: 'No availability slots found to delete',
                    slotsFound: 0 
                };
            }

            // Find matching slots based on criteria
            const matchingSlots = currentAvailability.filter(slot => {
                let matches = true;
                
                // Check day match (if specified)
                if (criteria.day) {
                    matches = matches && slot.day.toLowerCase() === criteria.day.toLowerCase();
                }
                
                // Check time range match (if specified)
                if (criteria.startTime !== undefined) {
                    matches = matches && slot.start_time === parseInt(criteria.startTime);
                }
                
                if (criteria.endTime !== undefined) {
                    matches = matches && slot.end_time === parseInt(criteria.endTime);
                }
                
                return matches;
            });

            console.log(`[DELETE SPECIFIC] Found ${matchingSlots.length} matching slots out of ${currentAvailability.length} total`);
            this.debugLog('Matching slots:', matchingSlots);

            if (matchingSlots.length === 0) {
                return {
                    success: false,
                    error: 'No slots match the specified criteria',
                    criteria,
                    totalSlots: currentAvailability.length,
                    matchingSlots: 0
                };
            }

            // Calculate remaining slots (all slots except matching ones)
            const remainingSlots = currentAvailability.filter(slot => {
                return !matchingSlots.find(match => 
                    match.day === slot.day && 
                    match.start_time === slot.start_time && 
                    match.end_time === slot.end_time
                );
            });

            console.log(`[DELETE SPECIFIC] Will keep ${remainingSlots.length} slots, delete ${matchingSlots.length} slots`);

            // If all slots would be deleted, use clearUserAvailability
            if (remainingSlots.length === 0) {
                console.log('[DELETE SPECIFIC] All slots match criteria, clearing all availability');
                return await this.clearUserAvailability(telegramId);
            }

            // Set availability to the remaining slots (effectively deleting the matching ones)
            const updateResult = await this.setUserAvailability(telegramId, remainingSlots.map(slot => ({
                day: slot.day,
                startTime: slot.start_time,
                endTime: slot.end_time
            })));

            if (updateResult.success) {
                this.operationLog('DELETE_SPECIFIC_AVAILABILITY_SUCCESS', telegramId, {
                    deletedSlots: matchingSlots.length,
                    remainingSlots: remainingSlots.length,
                    criteria
                });

                return {
                    success: true,
                    deletedSlots: matchingSlots,
                    deletedCount: matchingSlots.length,
                    remainingCount: remainingSlots.length,
                    message: `Successfully deleted ${matchingSlots.length} availability slot(s)`
                };
            } else {
                this.errorLog('Failed to update availability after specific deletion', null, {
                    updateResult,
                    criteria,
                    matchingSlots: matchingSlots.length
                });
                return { success: false, error: updateResult.error };
            }

        } catch (error) {
            this.errorLog('Delete specific availability failed', error, {
                telegramId,
                email,
                criteria
            });
            return { success: false, error: error.message };
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

    /**
     * Real-time data sync verification and testing mechanisms
     */
    async verifySyncStatus(telegramId) {
        const syncTestId = `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        this.operationLog('SYNC_VERIFICATION_START', telegramId, { syncTestId });
        
        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            return {
                success: false,
                error: 'No email mapping found',
                syncTestId
            };
        }

        const syncResults = {
            syncTestId,
            email,
            timestamp: new Date().toISOString(),
            tests: {},
            overall: { success: false, issues: [] }
        };

        try {
            // Test 1: API Connectivity
            this.debugLog('🔄 Test 1: API Connectivity', { syncTestId });
            const startTime = Date.now();
            const healthCheck = await this.makeAPIRequest('/health');
            syncResults.tests.apiConnectivity = {
                success: healthCheck.success,
                duration: Date.now() - startTime,
                status: healthCheck.status,
                error: healthCheck.error
            };

            // Test 2: User Lookup
            this.debugLog('🔄 Test 2: User Lookup', { syncTestId, email });
            const userLookupStart = Date.now();
            const userResult = await this.getUserByTelegramId(telegramId);
            syncResults.tests.userLookup = {
                success: !!userResult,
                duration: Date.now() - userLookupStart,
                foundUser: !!userResult,
                userName: userResult?.name,
                userEmail: userResult?.email
            };

            // Test 3: Availability Data Access
            this.debugLog('🔄 Test 3: Availability Data Access', { syncTestId });
            const availabilityStart = Date.now();
            const availabilityResult = await this.getUserAvailability(telegramId);
            syncResults.tests.availabilityAccess = {
                success: Array.isArray(availabilityResult),
                duration: Date.now() - availabilityStart,
                slotsFound: availabilityResult.length,
                isArray: Array.isArray(availabilityResult),
                hasData: availabilityResult.length > 0
            };

            // Test 4: Real-time Data Freshness (make two requests and compare timestamps)
            this.debugLog('🔄 Test 4: Data Freshness Check', { syncTestId });
            const freshnessStart = Date.now();
            const firstFetch = await this.makeAPIRequest(`/availability/by-email/${encodeURIComponent(email)}`);
            await new Promise(resolve => setTimeout(resolve, 100)); // Small delay
            const secondFetch = await this.makeAPIRequest(`/availability/by-email/${encodeURIComponent(email)}`);
            
            syncResults.tests.dataFreshness = {
                success: firstFetch.success && secondFetch.success,
                duration: Date.now() - freshnessStart,
                firstRequest: {
                    success: firstFetch.success,
                    slotsCount: firstFetch.data?.slots?.length || 0
                },
                secondRequest: {
                    success: secondFetch.success,
                    slotsCount: secondFetch.data?.slots?.length || 0
                },
                dataConsistent: JSON.stringify(firstFetch.data) === JSON.stringify(secondFetch.data)
            };

            // Analyze overall sync status
            const allTestsPassed = Object.values(syncResults.tests).every(test => test.success);
            const issues = [];
            
            if (!syncResults.tests.apiConnectivity.success) {
                issues.push('API connectivity failed');
            }
            if (!syncResults.tests.userLookup.success) {
                issues.push('User lookup failed - check Telegram ID mapping');
            }
            if (!syncResults.tests.availabilityAccess.success) {
                issues.push('Availability data access failed');
            }
            if (!syncResults.tests.dataFreshness.success) {
                issues.push('Data freshness check failed');
            }
            if (syncResults.tests.dataFreshness.success && !syncResults.tests.dataFreshness.dataConsistent) {
                issues.push('Data inconsistency detected between requests');
            }

            syncResults.overall = {
                success: allTestsPassed && issues.length === 0,
                issues,
                totalDuration: Date.now() - startTime
            };

            this.operationLog('SYNC_VERIFICATION_COMPLETE', telegramId, {
                syncTestId,
                success: syncResults.overall.success,
                issueCount: issues.length,
                totalDuration: syncResults.overall.totalDuration
            });

            return syncResults;

        } catch (error) {
            this.errorLog('Sync verification failed', error, { syncTestId, email });
            syncResults.overall = {
                success: false,
                issues: [`Sync verification failed: ${error.message}`],
                error: error.message
            };
            return syncResults;
        }
    }

    /**
     * Comprehensive data integrity check
     */
    async performDataIntegrityCheck(telegramId) {
        const checkId = `integrity_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        this.operationLog('DATA_INTEGRITY_CHECK_START', telegramId, { checkId });

        const email = this.getTelegramUserEmail(telegramId);
        if (!email) {
            return {
                success: false,
                error: 'No email mapping found',
                checkId
            };
        }

        const integrityResults = {
            checkId,
            email,
            timestamp: new Date().toISOString(),
            checks: {},
            recommendations: []
        };

        try {
            // Check 1: Data Structure Validation
            const availabilityData = await this.getUserAvailability(telegramId);
            const structureValidation = this.validateDataStructure(availabilityData);
            integrityResults.checks.dataStructure = structureValidation;

            // Check 2: Cross-reference with direct API call
            const directApiResult = await this.makeAPIRequest(`/availability/by-email/${encodeURIComponent(email)}`);
            integrityResults.checks.directApiComparison = {
                apiCallSuccess: directApiResult.success,
                dataMatches: this.compareDataStructures(availabilityData, directApiResult.data?.slots),
                processedSlots: availabilityData.length,
                rawSlots: directApiResult.data?.slots?.length || 0
            };

            // Generate recommendations
            if (!structureValidation.isValid) {
                integrityResults.recommendations.push('Data structure validation failed - check API response format');
            }
            if (!integrityResults.checks.directApiComparison.dataMatches) {
                integrityResults.recommendations.push('Processed data differs from raw API response - check data transformation logic');
            }
            if (directApiResult.success && (!directApiResult.data?.slots || directApiResult.data.slots.length === 0)) {
                integrityResults.recommendations.push('No availability data found - user may need to set availability');
            }

            this.operationLog('DATA_INTEGRITY_CHECK_COMPLETE', telegramId, {
                checkId,
                validationPassed: structureValidation.isValid,
                dataMatches: integrityResults.checks.directApiComparison.dataMatches,
                recommendationCount: integrityResults.recommendations.length
            });

            return integrityResults;

        } catch (error) {
            this.errorLog('Data integrity check failed', error, { checkId, email });
            return {
                checkId,
                error: error.message,
                success: false
            };
        }
    }

    /**
     * Validate availability data structure
     */
    validateDataStructure(data) {
        const validation = {
            isValid: true,
            issues: [],
            summary: {
                isArray: Array.isArray(data),
                length: data ? data.length : 0,
                validSlots: 0,
                invalidSlots: 0
            }
        };

        if (!Array.isArray(data)) {
            validation.isValid = false;
            validation.issues.push('Data is not an array');
            return validation;
        }

        data.forEach((slot, index) => {
            const slotIssues = [];
            
            if (!slot.day) slotIssues.push('Missing day');
            if (slot.start_time === undefined || slot.start_time === null) slotIssues.push('Missing start_time');
            if (slot.end_time === undefined || slot.end_time === null) slotIssues.push('Missing end_time');
            if (slot.start_time >= slot.end_time) slotIssues.push('Invalid time range');

            if (slotIssues.length > 0) {
                validation.isValid = false;
                validation.issues.push(`Slot ${index}: ${slotIssues.join(', ')}`);
                validation.summary.invalidSlots++;
            } else {
                validation.summary.validSlots++;
            }
        });

        return validation;
    }

    /**
     * Compare processed data with raw API data
     */
    compareDataStructures(processedData, rawData) {
        if (!Array.isArray(processedData) || !Array.isArray(rawData)) {
            return false;
        }

        if (processedData.length !== rawData.length) {
            return false;
        }

        // Compare each slot
        for (let i = 0; i < processedData.length; i++) {
            const processed = processedData[i];
            const raw = rawData[i];

            if (processed.day !== raw.day ||
                processed.start_time !== parseInt(raw.startTime) ||
                processed.end_time !== parseInt(raw.endTime)) {
                return false;
            }
        }

        return true;
    }
}

module.exports = GymBuddyAPIService;