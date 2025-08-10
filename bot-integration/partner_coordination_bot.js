/**
 * Enhanced Partner Coordination Bot - Complete Integration
 * 
 * This module provides comprehensive partner coordination for the GymBuddy Telegram Bot:
 * 1. Automatic coordination detection when both partners have availability
 * 2. Interactive session selection with Telegram inline keyboards
 * 3. Dual partner messaging and real-time notifications
 * 4. Natural language support for preferences and requests
 * 5. Complete negotiation workflow management
 * 6. Partner request system (send/accept/decline invitations)
 */

class PartnerCoordinationBot {
    constructor(bot, apiService, debugMode = false) {
        this.bot = bot;
        this.apiService = apiService;
        this.debugMode = debugMode;
        this.debugLog = debugMode ? console.log.bind(console, '[PARTNER-BOT]') : () => {};
        
        // Track coordination states and user contexts
        this.coordinationStates = new Map();
        this.partnerRequests = new Map();
        
        console.log('[PartnerBot] Enhanced Partner Coordination Bot initialized');
    }

    // ========================================
    // AUTOMATIC COORDINATION DETECTION
    // ========================================

    /**
     * Check if user's availability update should trigger partner coordination
     * Called automatically when user sets availability
     */
    async checkForCoordinationTrigger(userEmail) {
        try {
            this.debugLog(`Checking coordination trigger for ${userEmail}`);
            
            // Get user's partner status
            const partnerStatus = await this.apiService.getPartnerStatus(userEmail);
            if (!partnerStatus.success || partnerStatus.relationshipStatus !== 'has_partner') {
                this.debugLog('User has no partner - no coordination needed');
                return false;
            }

            const partnerEmail = partnerStatus.partner.email;
            this.debugLog(`Found partner: ${partnerEmail}`);

            // Check if both have availability and trigger coordination
            const triggerCheck = await this.apiService.checkCoordinationTrigger(userEmail, partnerEmail);
            
            if (triggerCheck.success && triggerCheck.shouldTrigger) {
                console.log(`[PartnerBot] 🎯 Coordination triggered: ${userEmail} & ${partnerEmail} both have availability`);
                await this.triggerAutomaticCoordination(userEmail, partnerEmail);
                return true;
            } else {
                this.debugLog(`Coordination not triggered - partner may not have availability yet`);
                return false;
            }

        } catch (error) {
            console.error('[PartnerBot] Error checking coordination trigger:', error);
            return false;
        }
    }

    /**
     * Trigger the full automatic coordination workflow
     */
    async triggerAutomaticCoordination(email1, email2) {
        try {
            console.log(`[PartnerBot] 🚀 Starting automatic coordination between ${email1} and ${email2}`);

            // Get session suggestions
            const suggestions = await this.apiService.getSessionSuggestions(email1, email2);
            
            if (!suggestions.success || !suggestions.suggestions || suggestions.suggestions.length === 0) {
                console.log(`[PartnerBot] No suitable session suggestions found`);
                
                // Notify both partners that no overlapping slots were found
                await this.sendToBothPartners(email1, email2, 
                    "🏋️‍♂️ Both partners have set availability, but no suitable 2-hour overlapping slots were found.\n\n" +
                    "💡 Try adjusting your schedules to have more overlapping time slots! 💪"
                );
                return;
            }

            // Generate coordination ID and store state
            const coordinationId = `coord_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            
            this.coordinationStates.set(coordinationId, {
                user1: suggestions.user1,
                user2: suggestions.user2,
                suggestions: suggestions.suggestions,
                responses: {},
                createdAt: new Date().toISOString()
            });

            // Present interactive session suggestions to both partners
            await this.presentSessionSuggestions(coordinationId, suggestions);

            console.log(`[PartnerBot] ✅ Coordination workflow initiated with ID: ${coordinationId}`);

        } catch (error) {
            console.error('[PartnerBot] Error in automatic coordination:', error);
        }
    }

    // ========================================
    // INTERACTIVE SESSION SELECTION
    // ========================================

    /**
     * Present session suggestions with interactive buttons
     */
    async presentSessionSuggestions(coordinationId, suggestionsData) {
        try {
            const { user1, user2, suggestions } = suggestionsData;
            
            this.debugLog(`Presenting ${suggestions.length} suggestions for coordination ${coordinationId}`);

            // Create the message text
            const messageText = this.formatSuggestionMessage(user1, user2, suggestions);
            
            // Create inline keyboard with session options
            const keyboard = this.createSuggestionKeyboard(coordinationId, suggestions);

            // Send to both partners simultaneously
            await Promise.all([
                this.sendMessageToUser(user1.email, messageText, keyboard),
                this.sendMessageToUser(user2.email, messageText, keyboard)
            ]);

            console.log(`[PartnerBot] 📤 Session suggestions sent to both partners`);

        } catch (error) {
            console.error('[PartnerBot] Error presenting session suggestions:', error);
        }
    }

    /**
     * Format the session suggestion message
     */
    formatSuggestionMessage(user1, user2, suggestions) {
        let message = `🏋️‍♂️ **WORKOUT COORDINATION** 💪\n\n`;
        message += `Both ${user1.name} and ${user2.name} have set availability!\n\n`;
        message += `Here are optimal 2-hour session suggestions:\n\n`;

        suggestions.forEach((suggestion, index) => {
            const dayName = suggestion.day.charAt(0).toUpperCase() + suggestion.day.slice(1);
            message += `**Option ${index + 1}**: ${dayName}, ${suggestion.date}\n`;
            message += `⏰ ${suggestion.displayStart} - ${suggestion.displayEnd}\n`;
            message += `📍 2-hour gym session\n\n`;
        });

        message += `Please select your preferred option. Both partners need to choose the same option to confirm the session! 🤝`;

        return message;
    }

    /**
     * Create inline keyboard for session options
     */
    createSuggestionKeyboard(coordinationId, suggestions) {
        const keyboard = [];

        // Add option buttons (limit to top 3 suggestions for clean UI)
        const maxOptions = Math.min(suggestions.length, 3);
        
        for (let i = 0; i < maxOptions; i++) {
            const suggestion = suggestions[i];
            const dayName = suggestion.day.charAt(0).toUpperCase() + suggestion.day.slice(1);
            
            keyboard.push([{
                text: `✅ Option ${i + 1} (${dayName} ${suggestion.displayStart})`,
                callback_data: `coord_select_${coordinationId}_${i}`
            }]);
        }

        // Add decline option
        keyboard.push([{
            text: `❌ Need different times`,
            callback_data: `coord_decline_${coordinationId}`
        }]);

        return {
            reply_markup: {
                inline_keyboard: keyboard
            },
            parse_mode: 'Markdown'
        };
    }

    // ========================================
    // CALLBACK QUERY HANDLING
    // ========================================

    /**
     * Handle callback queries from inline keyboards
     */
    async handleCallbackQuery(callbackQuery) {
        const data = callbackQuery.data;
        const userId = callbackQuery.from.id;
        const messageId = callbackQuery.message.message_id;
        const chatId = callbackQuery.message.chat.id;

        this.debugLog(`Callback query: ${data} from user ${userId}`);

        try {
            if (data.startsWith('coord_select_')) {
                await this.handleSessionSelection(callbackQuery, data);
            } else if (data.startsWith('coord_decline_')) {
                await this.handleSessionDecline(callbackQuery, data);
            } else if (data.startsWith('partner_accept_')) {
                await this.handlePartnerRequestAccept(callbackQuery, data);
            } else if (data.startsWith('partner_decline_')) {
                await this.handlePartnerRequestDecline(callbackQuery, data);
            } else {
                // Not a partner coordination callback
                return false;
            }

            // Answer the callback query
            await this.bot.answerCallbackQuery(callbackQuery.id);
            return true;

        } catch (error) {
            console.error('[PartnerBot] Error handling callback query:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: "❌ Error processing your response",
                show_alert: true
            });
            return true;
        }
    }

    /**
     * Handle session selection from inline keyboard
     */
    async handleSessionSelection(callbackQuery, data) {
        const parts = data.split('_');
        const coordinationId = parts.slice(2, -1).join('_'); // Reconstruct ID
        const optionIndex = parseInt(parts[parts.length - 1]);

        const userId = callbackQuery.from.id;
        const userEmail = await this.getUserEmail(userId);

        if (!userEmail) {
            throw new Error('User email not found');
        }

        this.debugLog(`User ${userEmail} selected option ${optionIndex} for coordination ${coordinationId}`);

        // Get coordination state
        const coordination = this.coordinationStates.get(coordinationId);
        if (!coordination) {
            await this.bot.editMessageText(
                "❌ This coordination session has expired. Please update your availability to trigger new suggestions.",
                {
                    chat_id: callbackQuery.message.chat.id,
                    message_id: callbackQuery.message.message_id
                }
            );
            return;
        }

        // Record user's choice
        coordination.responses[userEmail] = {
            choice: optionIndex,
            timestamp: new Date().toISOString()
        };

        const user1Email = coordination.user1.email;
        const user2Email = coordination.user2.email;
        const user1Response = coordination.responses[user1Email];
        const user2Response = coordination.responses[user2Email];

        // Check if both partners have responded
        if (user1Response && user2Response) {
            if (user1Response.choice === user2Response.choice) {
                // Both chose the same option - create confirmed session!
                await this.createConfirmedSession(coordinationId, coordination, optionIndex);
            } else {
                // Different choices - need negotiation
                await this.handleNegotiation(coordinationId, coordination);
            }
        } else {
            // Still waiting for partner response
            const waitingForPartner = user1Response ? coordination.user2 : coordination.user1;
            const selectedOption = coordination.suggestions[optionIndex];
            
            await this.bot.editMessageText(
                `✅ You chose Option ${optionIndex + 1} (${selectedOption.day} ${selectedOption.displayStart})!\n\n` +
                `⏳ Waiting for ${waitingForPartner.name} to respond...`,
                {
                    chat_id: callbackQuery.message.chat.id,
                    message_id: callbackQuery.message.message_id
                }
            );

            // Notify the partner that response is needed
            const partnerEmail = user1Response ? user2Email : user1Email;
            const respondingUserName = user1Response ? coordination.user1.name : coordination.user2.name;
            
            await this.sendMessageToUser(partnerEmail, 
                `⏰ ${respondingUserName} has chosen their workout preference! Please respond to coordinate your session. 🏋️‍♂️`
            );
        }
    }

    /**
     * Handle session decline
     */
    async handleSessionDecline(callbackQuery, data) {
        const coordinationId = data.replace('coord_decline_', '');
        const userId = callbackQuery.from.id;
        const userEmail = await this.getUserEmail(userId);

        this.debugLog(`User ${userEmail} declined coordination ${coordinationId}`);

        const coordination = this.coordinationStates.get(coordinationId);
        if (!coordination) {
            await this.bot.editMessageText(
                "❌ This coordination session has expired.",
                {
                    chat_id: callbackQuery.message.chat.id,
                    message_id: callbackQuery.message.message_id
                }
            );
            return;
        }

        // Clean up coordination state
        this.coordinationStates.delete(coordinationId);

        // Update the declining user's message
        await this.bot.editMessageText(
            `❌ You declined the suggested times.\n\n💡 Update your availability anytime to trigger new suggestions! 💪`,
            {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id
            }
        );

        // Notify the partner
        const partnerEmail = coordination.user1.email === userEmail ? 
                           coordination.user2.email : coordination.user1.email;
        const decliningUserName = coordination.user1.email === userEmail ? 
                                coordination.user1.name : coordination.user2.name;

        await this.sendMessageToUser(partnerEmail, 
            `🤷‍♂️ ${decliningUserName} needs different workout times.\n\n` +
            `💡 Try updating your availability for new suggestions! 💪`
        );
    }

    // ========================================
    // SESSION BOOKING
    // ========================================

    /**
     * Create confirmed session when both partners agree
     */
    async createConfirmedSession(coordinationId, coordination, optionIndex) {
        try {
            const selectedOption = coordination.suggestions[optionIndex];
            
            this.debugLog(`Creating confirmed session for option ${optionIndex}:`, selectedOption);

            // Book the session via API
            const bookingResult = await this.apiService.bookSession(
                coordination.user1.email,
                coordination.user2.email,
                selectedOption.date,
                selectedOption.startTime,
                selectedOption.endTime
            );

            if (!bookingResult.success) {
                throw new Error(`Session booking failed: ${bookingResult.error}`);
            }

            // Clean up coordination state
            this.coordinationStates.delete(coordinationId);

            // Create success message
            const successMessage = this.formatSessionConfirmation(selectedOption, coordination.user1, coordination.user2);
            
            // Send confirmation to both partners
            await this.sendToBothPartners(coordination.user1.email, coordination.user2.email, successMessage);

            console.log(`[PartnerBot] 🎉 Session successfully booked between ${coordination.user1.name} and ${coordination.user2.name}`);

        } catch (error) {
            console.error('[PartnerBot] Error creating confirmed session:', error);
            
            // Notify both partners of the error
            await this.sendToBothPartners(
                coordination.user1.email, 
                coordination.user2.email, 
                "❌ Sorry, there was an error booking your session. Please try again or contact support."
            );
        }
    }

    /**
     * Handle negotiation when partners choose different options
     */
    async handleNegotiation(coordinationId, coordination) {
        const user1Choice = coordination.responses[coordination.user1.email].choice;
        const user2Choice = coordination.responses[coordination.user2.email].choice;

        this.debugLog(`Negotiation: ${coordination.user1.name} chose ${user1Choice}, ${coordination.user2.name} chose ${user2Choice}`);

        const option1 = coordination.suggestions[user1Choice];
        const option2 = coordination.suggestions[user2Choice];

        const negotiationMessage = `🤝 **COORDINATION UPDATE**\n\n` +
            `${coordination.user1.name} prefers: Option ${user1Choice + 1} (${option1.day} ${option1.displayStart})\n` +
            `${coordination.user2.name} prefers: Option ${user2Choice + 1} (${option2.day} ${option2.displayStart})\n\n` +
            `You chose different options! Please coordinate:\n` +
            `• Send a message like "I prefer the Tuesday session"\n` +
            `• Or update your availability for new suggestions\n\n` +
            `💪 Keep coordinating - you've got this! 🤝`;

        // Send negotiation message to both
        await this.sendToBothPartners(coordination.user1.email, coordination.user2.email, negotiationMessage);

        // Clean up coordination state after a delay to allow manual negotiation
        setTimeout(() => {
            this.coordinationStates.delete(coordinationId);
        }, 300000); // 5 minutes
    }

    /**
     * Format session confirmation message
     */
    formatSessionConfirmation(session, user1, user2) {
        const dayName = session.day.charAt(0).toUpperCase() + session.day.slice(1);
        
        return `🎉 **SESSION CONFIRMED!** 🎉\n\n` +
               `👥 Partners: ${user1.name} & ${user2.name}\n` +
               `📅 Date: ${dayName}, ${session.date}\n` +
               `⏰ Time: ${session.displayStart} - ${session.displayEnd}\n` +
               `💪 Duration: 2 hours\n\n` +
               `🏋️‍♂️ See you at the gym! Let's crush this workout together!`;
    }

    // ========================================
    // NATURAL LANGUAGE PROCESSING
    // ========================================

    /**
     * Check if message should be handled by partner coordination
     */
    shouldHandleMessage(messageText) {
        const text = messageText.toLowerCase();
        
        const partnerKeywords = [
            // Partner requests
            'pair with', 'partner with', 'gym buddy', 'workout partner',
            'want to pair', 'add as partner', 'send partner request',
            
            // Partner request responses
            'accept partner request', 'decline partner request', 'reject partner request',
            'accept partner', 'decline partner', 'reject partner',
            
            // Coordination requests
            'coordinate', 'schedule together', 'workout with',
            'when can we', 'book together', 'let\'s workout',
            'find a time', 'schedule session',
            
            // Session preferences
            'prefer', 'i like', 'better', 'instead',
            'tuesday session', 'monday session', 'wednesday session',
            'thursday session', 'friday session', 'weekend session',
            
            // Partner management
            'my partner', 'gym partner', 'workout buddy'
        ];
        
        return partnerKeywords.some(keyword => text.includes(keyword));
    }

    /**
     * Process coordination request from natural language
     */
    async processCoordinationRequest(msg) {
        const chatId = msg.chat.id;
        const messageText = msg.text.toLowerCase();
        const telegramId = msg.from.id;
        const userEmail = await this.getUserEmail(telegramId);

        if (!userEmail) {
            await this.bot.sendMessage(chatId, "❌ I couldn't identify your account. Please contact support.");
            return;
        }

        console.log(`[PartnerBot] Processing coordination request from ${userEmail}: ${msg.text}`);

        // Handle partner request responses (e.g., "Accept partner request", "Decline partner request")
        const handledPartnerResponse = await this.handlePartnerRequestResponse(msg, userEmail, messageText);
        if (handledPartnerResponse) {
            return;
        }

        // Handle partner requests (e.g., "I want to pair with Youssef")
        if (this.isPartnerRequest(messageText)) {
            await this.handlePartnerRequestFromMessage(msg, userEmail, messageText);
            return;
        }

        // Handle session preferences (e.g., "I prefer the Tuesday session")
        if (this.isSessionPreference(messageText)) {
            await this.handleSessionPreferenceFromMessage(msg, userEmail, messageText);
            return;
        }

        // Handle general coordination requests
        await this.handleGeneralCoordinationRequest(msg, userEmail);
    }

    /**
     * Check if message is a partner request
     */
    isPartnerRequest(messageText) {
        const partnerRequestPatterns = [
            /pair with\s+(\w+)/i,
            /partner with\s+(\w+)/i,
            /add\s+(\w+)\s+as\s+partner/i,
            /want\s+to\s+pair\s+with\s+(\w+)/i,
            /send\s+partner\s+request\s+to\s+(\w+)/i,
            /gym\s+buddy\s+(\w+)/i
        ];

        return partnerRequestPatterns.some(pattern => pattern.test(messageText));
    }

    /**
     * Check if message is a session preference
     */
    isSessionPreference(messageText) {
        const preferencePatterns = [
            /prefer.*session/i,
            /like.*session/i,
            /choose.*session/i,
            /pick.*session/i,
            /(monday|tuesday|wednesday|thursday|friday|saturday|sunday).*session/i,
            /option\s+\d/i
        ];

        return preferencePatterns.some(pattern => pattern.test(messageText));
    }

    // ========================================
    // PARTNER REQUEST MANAGEMENT
    // ========================================

    /**
     * Handle partner request acceptance via callback
     */
    async handlePartnerRequestAccept(callbackQuery, data) {
        const requestId = data.replace('partner_accept_', '');
        const userId = callbackQuery.from.id;
        const userEmail = await this.getUserEmail(userId);

        if (!userEmail) {
            throw new Error('User email not found');
        }

        this.debugLog(`User ${userEmail} accepting partner request ${requestId}`);

        try {
            const result = await this.apiService.respondToPartnerRequest(
                requestId, 
                userEmail, 
                'accepted', 
                'Accepted via Telegram'
            );

            if (result.success) {
                await this.bot.editMessageText(
                    `✅ Partner request accepted!\n\n` +
                    `🤝 You're now paired as workout partners! I'll automatically coordinate your sessions when both of you have availability. 💪`,
                    {
                        chat_id: callbackQuery.message.chat.id,
                        message_id: callbackQuery.message.message_id
                    }
                );

                console.log(`[PartnerBot] 🤝 Partner request ${requestId} accepted by ${userEmail}`);
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('[PartnerBot] Error accepting partner request:', error);
            await this.bot.editMessageText(
                `❌ Error accepting partner request: ${error.message}`,
                {
                    chat_id: callbackQuery.message.chat.id,
                    message_id: callbackQuery.message.message_id
                }
            );
        }
    }

    /**
     * Handle partner request decline via callback
     */
    async handlePartnerRequestDecline(callbackQuery, data) {
        const requestId = data.replace('partner_decline_', '');
        const userId = callbackQuery.from.id;
        const userEmail = await this.getUserEmail(userId);

        if (!userEmail) {
            throw new Error('User email not found');
        }

        this.debugLog(`User ${userEmail} declining partner request ${requestId}`);

        try {
            const result = await this.apiService.respondToPartnerRequest(
                requestId, 
                userEmail, 
                'rejected', 
                'Declined via Telegram'
            );

            if (result.success) {
                await this.bot.editMessageText(
                    `❌ Partner request declined.\n\n` +
                    `No worries! You can always send or accept partner requests later. 👍`,
                    {
                        chat_id: callbackQuery.message.chat.id,
                        message_id: callbackQuery.message.message_id
                    }
                );

                console.log(`[PartnerBot] ❌ Partner request ${requestId} declined by ${userEmail}`);
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error('[PartnerBot] Error declining partner request:', error);
            await this.bot.editMessageText(
                `❌ Error declining partner request: ${error.message}`,
                {
                    chat_id: callbackQuery.message.chat.id,
                    message_id: callbackQuery.message.message_id
                }
            );
        }
    }

    /**
     * Handle partner request acceptance/decline from natural language
     */
    async handlePartnerRequestResponse(msg, userEmail, messageText) {
        const chatId = msg.chat.id;
        
        const isAccept = /accept.*partner.*request/i.test(messageText);
        const isDecline = /decline.*partner.*request|reject.*partner.*request/i.test(messageText);
        
        if (!isAccept && !isDecline) {
            return false; // Not a partner request response
        }

        try {
            // Get pending partner requests for this user
            const partnerStatus = await this.apiService.getPartnerStatus(userEmail);
            
            if (!partnerStatus.success) {
                await this.bot.sendMessage(chatId, "❌ Could not check your partner requests.");
                return true;
            }

            const pendingRequests = partnerStatus.pendingRequests?.filter(req => 
                req.requested_user_id === partnerStatus.user.id && req.status === 'pending'
            );

            if (!pendingRequests || pendingRequests.length === 0) {
                await this.bot.sendMessage(chatId, 
                    "🤔 I don't see any pending partner requests for you.\n\n" +
                    "If someone sent you a request, it might have expired or already been processed."
                );
                return true;
            }

            // If there's exactly one pending request, process it
            if (pendingRequests.length === 1) {
                const request = pendingRequests[0];
                const response = isAccept ? 'accepted' : 'rejected';
                
                const result = await this.apiService.respondToPartnerRequest(
                    request.id,
                    userEmail,
                    response,
                    `${response} via Telegram message`
                );

                if (result.success) {
                    if (isAccept) {
                        await this.bot.sendMessage(chatId,
                            `✅ Partner request from ${request.requester.name} accepted!\n\n` +
                            `🤝 You're now paired as workout partners! I'll automatically coordinate your sessions. 💪`
                        );
                    } else {
                        await this.bot.sendMessage(chatId,
                            `❌ Partner request from ${request.requester.name} declined.\n\n` +
                            `No problem! You can always accept other requests later. 👍`
                        );
                    }
                } else {
                    await this.bot.sendMessage(chatId, 
                        `❌ Failed to ${response} partner request: ${result.error}`
                    );
                }
            } else {
                // Multiple pending requests - need clarification
                let message = `🤔 You have ${pendingRequests.length} pending partner requests:\n\n`;
                
                pendingRequests.forEach((request, index) => {
                    message += `${index + 1}. From ${request.requester.name}\n`;
                });
                
                message += `\nPlease specify which request you want to ${isAccept ? 'accept' : 'decline'}.`;
                
                await this.bot.sendMessage(chatId, message);
            }

            return true;

        } catch (error) {
            console.error('[PartnerBot] Error handling partner request response:', error);
            await this.bot.sendMessage(chatId, "❌ Error processing your partner request response.");
            return true;
        }
    }

    /**
     * Handle partner request from natural language
     */
    async handlePartnerRequestFromMessage(msg, userEmail, messageText) {
        const chatId = msg.chat.id;

        // Extract partner name from message
        const nameMatch = messageText.match(/(?:pair with|partner with|add|request to)\s+(\w+)/i);
        if (!nameMatch) {
            await this.bot.sendMessage(chatId, 
                "🤔 I couldn't understand which partner you want to pair with. " +
                "Try: 'I want to pair with Youssef' or 'Send partner request to John'"
            );
            return;
        }

        const partnerName = nameMatch[1];
        console.log(`[PartnerBot] Partner request: ${userEmail} wants to pair with ${partnerName}`);

        try {
            // Find partner by name (this will need to be enhanced to search by various identifiers)
            const partnerResult = await this.apiService.findPartner(partnerName);
            
            if (!partnerResult.success) {
                await this.bot.sendMessage(chatId, 
                    `❌ I couldn't find a partner named "${partnerName}". ` +
                    "Make sure they're registered in the system and try their exact name or email."
                );
                return;
            }

            // Send partner request
            const requestResult = await this.apiService.sendPartnerRequest(
                userEmail, 
                partnerResult.partner.email, 
                `Partner request sent via Telegram`
            );

            if (requestResult.success) {
                await this.bot.sendMessage(chatId,
                    `✅ Partner request sent to ${partnerResult.partner.name}!\n\n` +
                    `They'll receive a notification and can accept or decline your request. 🤝`
                );

                // Notify the target partner if they have Telegram
                await this.sendMessageToUser(partnerResult.partner.email,
                    `🤝 **PARTNER REQUEST**\n\n` +
                    `${userEmail} wants to be your gym partner!\n\n` +
                    `Reply with "Accept partner request" or "Decline partner request"`
                );
            } else {
                await this.bot.sendMessage(chatId,
                    `❌ Failed to send partner request: ${requestResult.error}`
                );
            }

        } catch (error) {
            console.error('[PartnerBot] Error handling partner request:', error);
            await this.bot.sendMessage(chatId, "❌ Error processing partner request. Please try again.");
        }
    }

    /**
     * Handle session preference from natural language
     */
    async handleSessionPreferenceFromMessage(msg, userEmail, messageText) {
        const chatId = msg.chat.id;

        // This would ideally check if there's an active coordination session
        // and apply the preference accordingly
        
        // For now, provide a helpful response
        await this.bot.sendMessage(chatId,
            "💡 I understand you have a session preference!\n\n" +
            "If you have active session suggestions, please use the buttons to select your preferred option. " +
            "Otherwise, update your availability and I'll automatically coordinate with your partner! 🏋️‍♂️"
        );
    }

    /**
     * Handle general coordination requests
     */
    async handleGeneralCoordinationRequest(msg, userEmail) {
        const chatId = msg.chat.id;

        try {
            // Check if user has a partner
            const partnerStatus = await this.apiService.getPartnerStatus(userEmail);
            
            if (!partnerStatus.success || partnerStatus.relationshipStatus !== 'has_partner') {
                await this.bot.sendMessage(chatId,
                    "🤝 You don't have a gym partner yet!\n\n" +
                    "To get started:\n" +
                    "• Say 'I want to pair with [PartnerName]' to send a partner request\n" +
                    "• Or ask them to send you a partner request\n\n" +
                    "Once you're paired, I'll automatically coordinate your workouts! 💪"
                );
                return;
            }

            // Try to trigger coordination
            const coordinationTriggered = await this.checkForCoordinationTrigger(userEmail);
            
            if (!coordinationTriggered) {
                await this.bot.sendMessage(chatId, 
                    `🏋️‍♂️ I'll coordinate your workouts with ${partnerStatus.partner.name} once both of you have set availability!\n\n` +
                    `💡 Update your availability and I'll automatically suggest optimal session times. 💪`
                );
            }

        } catch (error) {
            console.error('[PartnerBot] Error in general coordination request:', error);
            await this.bot.sendMessage(chatId, "❌ Error processing coordination request. Please try again.");
        }
    }

    // ========================================
    // UTILITY METHODS
    // ========================================

    /**
     * Send message to both partners simultaneously
     */
    async sendToBothPartners(email1, email2, message, options = {}) {
        await Promise.all([
            this.sendMessageToUser(email1, message, options),
            this.sendMessageToUser(email2, message, options)
        ]);
    }

    /**
     * Send message to user by email
     */
    async sendMessageToUser(userEmail, message, options = {}) {
        try {
            const telegramId = await this.getTelegramIdByEmail(userEmail);
            if (telegramId) {
                await this.bot.sendMessage(telegramId, message, {
                    parse_mode: 'Markdown',
                    ...options
                });
                this.debugLog(`Message sent to ${userEmail} (${telegramId})`);
            } else {
                console.warn(`[PartnerBot] No Telegram ID found for user ${userEmail}`);
            }
        } catch (error) {
            console.error(`[PartnerBot] Error sending message to ${userEmail}:`, error);
        }
    }

    /**
     * Get Telegram ID by email
     */
    async getTelegramIdByEmail(email) {
        const emailToTelegram = {
            'ivanaguilarmari@gmail.com': process.env.IVAN_TELEGRAM_ID,
            'youssef.email@gmail.com': process.env.YOUSSEF_TELEGRAM_ID // Update with real email
        };
        
        return emailToTelegram[email];
    }

    /**
     * Get email by Telegram ID
     */
    async getUserEmail(telegramId) {
        const telegramToEmail = {
            [process.env.IVAN_TELEGRAM_ID]: 'ivanaguilarmari@gmail.com',
            [process.env.YOUSSEF_TELEGRAM_ID]: 'youssef.email@gmail.com' // Update with real email
        };
        
        return telegramToEmail[telegramId.toString()];
    }

    /**
     * Clean up expired coordination states (called periodically)
     */
    cleanupExpiredStates() {
        const now = new Date();
        const expiredThreshold = 24 * 60 * 60 * 1000; // 24 hours

        for (const [id, state] of this.coordinationStates.entries()) {
            const stateAge = now - new Date(state.createdAt);
            if (stateAge > expiredThreshold) {
                this.coordinationStates.delete(id);
                this.debugLog(`Cleaned up expired coordination state: ${id}`);
            }
        }

        // Log current state count
        if (this.debugMode) {
            this.debugLog(`Active coordination states: ${this.coordinationStates.size}`);
        }
    }
}

module.exports = PartnerCoordinationBot;