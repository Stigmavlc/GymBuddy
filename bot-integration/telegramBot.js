/**
 * GymBuddy Telegram Bot - Standalone Implementation
 * 
 * This is an alternative to the n8n workflow implementation.
 * It provides the same functionality but as a standalone Node.js service.
 * 
 * Features:
 * - Uses API service for all database operations
 * - Handles all bot operations (availability management, scheduling)
 * - Integrates with Claude AI for intelligent responses
 * - Proper error handling and logging
 * - Real-time sync with website through API
 */

const TelegramBot = require('node-telegram-bot-api');
const GymBuddyAPIService = require('./apiService');
const http = require('http');

class GymBuddyTelegramBot {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ';
        this.claudeAPIKey = process.env.ANTHROPIC_API_KEY;
        this.debugMode = process.env.BOT_DEBUG_MODE === 'true';
        
        // Initialize services
        this.bot = new TelegramBot(this.botToken, { polling: true });
        this.apiService = new GymBuddyAPIService();
        
        // User context storage for conversation flow
        this.userContexts = new Map();
        
        // Message processing tracking to prevent duplicates
        this.processedMessages = new Set();
        
        // Debug logging helper
        this.debugLog = this.debugMode ? console.log.bind(console, '[DEBUG]') : () => {};
        
        // Conversation flow tracking for diagnostics
        this.conversationTracker = {
            totalMessages: 0,
            intentRouting: {
                availability_update: 0,
                availability_query: 0,
                availability_clear: 0,
                session_deletion: 0,
                general_chat: 0
            },
            claudeUsage: 0,
            directProcessing: 0
        };
        
        console.log('[Bot] GymBuddy Telegram Bot initialized');
        console.log('[Bot] Debug mode:', this.debugMode ? 'ON' : 'OFF');
        console.log('[Bot] Claude API configured:', !!this.claudeAPIKey);
        console.log('[Bot] Conversation tracking enabled');
        
        this.setupEventHandlers();
        this.setupCommands();
    }

    /**
     * Setup bot event handlers
     */
    setupEventHandlers() {
        // Handle all text messages
        this.bot.on('message', async (msg) => {
            try {
                await this.handleMessage(msg);
            } catch (error) {
                console.error('[Bot Error] Message handling failed:', error);
                await this.sendErrorMessage(msg.chat.id, 'Sorry, I encountered an error processing your message.');
            }
        });

        // Handle errors
        this.bot.on('polling_error', (error) => {
            console.error('[Bot Error] Polling error:', error);
        });

        console.log('[Bot] Event handlers configured');
    }

    /**
     * Setup bot commands
     */
    setupCommands() {
        const commands = [
            { command: 'start', description: 'Start using GymBuddy' },
            { command: 'help', description: 'Show available commands' },
            { command: 'availability', description: 'Check your availability' },
            { command: 'clear', description: 'Clear all availability' },
            { command: 'status', description: 'Check sync status' },
            { command: 'test', description: 'Test bot functionality' },
            { command: 'debug', description: 'Show conversation flow diagnostics' }
        ];

        this.bot.setMyCommands(commands);
        console.log('[Bot] Commands configured:', commands.map(c => c.command).join(', '));
    }

    /**
     * Main message handler
     */
    async handleMessage(msg) {
        const chatId = msg.chat.id;
        const messageText = msg.text;
        const telegramId = msg.from.id;
        const messageId = msg.message_id;
        const messageKey = `${chatId}_${messageId}`;
        
        // Prevent duplicate message processing
        if (this.processedMessages.has(messageKey)) {
            this.debugLog(`Duplicate message detected and skipped: ${messageKey}`);
            return;
        }
        this.processedMessages.add(messageKey);
        
        // Cleanup old message IDs (keep last 100)
        if (this.processedMessages.size > 100) {
            const entries = Array.from(this.processedMessages);
            entries.slice(0, entries.length - 100).forEach(key => this.processedMessages.delete(key));
        }
        
        // Track conversation metrics
        this.conversationTracker.totalMessages++;
        
        console.log(`[Bot] Message ${this.conversationTracker.totalMessages} from ${msg.from.first_name} (${telegramId}): ${messageText}`);
        this.debugLog('Full message object:', {
            message_id: messageId,
            chat_id: chatId,
            user_id: telegramId,
            text: messageText,
            date: msg.date
        });
        
        // Log conversation flow tracking
        this.debugLog('=== CONVERSATION FLOW TRACKING ===');
        this.debugLog('Total messages processed:', this.conversationTracker.totalMessages);
        this.debugLog('Current routing stats:', this.conversationTracker.intentRouting);
        this.debugLog('Claude vs Direct processing:', {
            claude: this.conversationTracker.claudeUsage,
            direct: this.conversationTracker.directProcessing
        });
        
        // Show typing indicator
        await this.bot.sendChatAction(chatId, 'typing');
        
        // Handle commands
        if (messageText.startsWith('/')) {
            this.debugLog('Processing as command');
            await this.handleCommand(msg);
            return;
        }
        
        // Handle natural language messages with enhanced routing
        this.debugLog('Processing as natural language message');
        await this.handleNaturalLanguage(msg);
    }

    /**
     * Handle bot commands
     */
    async handleCommand(msg) {
        const chatId = msg.chat.id;
        const command = msg.text.split(' ')[0].substring(1); // Remove '/'
        const telegramId = msg.from.id;
        
        console.log(`[Bot] Command: /${command} from ${telegramId}`);
        
        switch (command) {
            case 'start':
                await this.handleStartCommand(msg);
                break;
                
            case 'help':
                await this.handleHelpCommand(msg);
                break;
                
            case 'availability':
                await this.handleAvailabilityCommand(msg);
                break;
                
            case 'clear':
                await this.handleClearCommand(msg);
                break;
                
            case 'status':
                await this.handleStatusCommand(msg);
                break;
                
            case 'test':
                await this.handleTestCommand(msg);
                break;
                
            case 'debug':
                await this.handleDebugCommand(msg);
                break;
                
            default:
                await this.bot.sendMessage(chatId, 'Unknown command. Use /help to see available commands.');
        }
    }

    /**
     * Handle /start command
     */
    async handleStartCommand(msg) {
        const chatId = msg.chat.id;
        const firstName = msg.from.first_name;
        
        const welcomeMessage = `
Hey ${firstName}! 💪 Welcome to GymBuddy!

I'm here to help you coordinate workouts with your gym partner and keep you motivated on your fitness journey!

Just chat with me naturally - I can help with scheduling, give workout tips, or just be your fitness cheerleader! 🎉

Ready to crush those fitness goals? Let's do this! 🚀
        `;
        
        await this.bot.sendMessage(chatId, welcomeMessage);
        
        // Check if user exists in system
        const user = await this.apiService.getUserByTelegramId(msg.from.id);
        if (!user) {
            await this.bot.sendMessage(chatId, 
                "⚠️ I don't have your profile in the system yet. Please register on the GymBuddy website first!"
            );
        }
    }

    /**
     * Handle /help command
     */
    async handleHelpCommand(msg) {
        const chatId = msg.chat.id;
        
        const helpMessage = `
🤖 GymBuddy Commands:

/start - Start using the bot
/help - Show this help message
/availability - Check your current availability
/clear - Clear all your availability slots
/status - Check bot and sync status
/test - Test bot functionality

💬 **Just chat naturally!**
Tell me when you're free, ask about your schedule, or let me know if you want to clear your availability. I'll understand! 😊

💪 **Fitness motivation:**
I'm also here for workout tips, motivation, and general fitness chat!

🔄 All changes sync automatically with the website!
        `;
        
        await this.bot.sendMessage(chatId, helpMessage);
    }

    /**
     * Handle /availability command
     */
    async handleAvailabilityCommand(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        
        try {
            const availability = await this.apiService.getUserAvailability(telegramId);
            
            if (!availability || availability.length === 0) {
                await this.bot.sendMessage(chatId, 
                    "📅 Your schedule is empty. Let me know when you're free to work out!"
                );
                return;
            }
            
            let message = "📅 Your current availability:\n\n";
            
            // Group by day and format nicely
            const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const groupedByDay = {};
            
            availability.forEach(slot => {
                if (!groupedByDay[slot.day]) {
                    groupedByDay[slot.day] = [];
                }
                groupedByDay[slot.day].push(slot);
            });
            
            dayOrder.forEach(day => {
                if (groupedByDay[day]) {
                    const dayName = day.charAt(0).toUpperCase() + day.slice(1);
                    message += `🗓️ ${dayName}:\n`;
                    
                    groupedByDay[day]
                        .sort((a, b) => a.start_time - b.start_time)
                        .forEach(slot => {
                            message += `   ⏰ ${slot.start_time}:00 - ${slot.end_time}:00\n`;
                        });
                    message += '\n';
                }
            });
            
            message += `📊 Total slots: ${availability.length}\n`;
            message += "🔄 Synced with website in real-time";
            
            await this.bot.sendMessage(chatId, message);
            
        } catch (error) {
            console.error('[Bot Error] Availability command failed:', error);
            await this.sendErrorMessage(chatId, 'Failed to retrieve your availability. Please try again.');
        }
    }

    /**
     * Handle /clear command
     */
    async handleClearCommand(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        
        try {
            // Show confirmation
            await this.bot.sendMessage(chatId, 'Clearing your availability... ⏳');
            
            const result = await this.apiService.clearUserAvailability(telegramId);
            
            if (result.success) {
                const message = `
✅ Done! Cleared ${result.deletedCount} slots from your schedule.

🔄 Changes synced with website automatically
                `;
                
                await this.bot.sendMessage(chatId, message);
            } else {
                await this.sendErrorMessage(chatId, `Failed to clear availability: ${result.error}`);
            }
            
        } catch (error) {
            console.error('[Bot Error] Clear command failed:', error);
            await this.sendErrorMessage(chatId, 'Failed to clear availability. Please try again.');
        }
    }

    /**
     * Handle /status command
     */
    async handleStatusCommand(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        
        try {
            await this.bot.sendMessage(chatId, 'Checking status... 🔍');
            
            // Check API health
            const healthCheck = await this.apiService.healthCheck();
            
            // Get sync status
            const syncStatus = await this.apiService.getSyncStatus(telegramId);
            
            let message = '📊 GymBuddy Status Report:\n\n';
            
            // API Status
            if (healthCheck.success) {
                message += `✅ API Server: Online (${healthCheck.version})\n`;
            } else {
                message += `❌ API Server: ${healthCheck.error}\n`;
            }
            
            // User Status
            if (syncStatus.success && syncStatus.users.length > 0) {
                const user = syncStatus.users[0];
                message += `✅ User Profile: Found (${user.name})\n`;
                message += `📧 Email: ${user.email}\n`;
                
                if (syncStatus.availability.length > 0) {
                    message += `📅 Availability: ${syncStatus.availability.length} slots\n`;
                } else {
                    message += `📅 Availability: No slots set\n`;
                }
            } else {
                message += `❌ User Profile: ${syncStatus.error || 'Not found'}\n`;
            }
            
            // System Stats
            if (syncStatus.success && syncStatus.stats) {
                message += `\n📈 System Stats:\n`;
                message += `👥 Total Users: ${syncStatus.stats.total_users}\n`;
                message += `📅 Total Availability: ${syncStatus.stats.total_availability_slots}\n`;
                message += `🏋️ Total Sessions: ${syncStatus.stats.total_sessions}\n`;
            }
            
            message += '\n🔄 All systems operational!';
            
            await this.bot.sendMessage(chatId, message);
            
        } catch (error) {
            console.error('[Bot Error] Status command failed:', error);
            await this.sendErrorMessage(chatId, 'Failed to get status. Please try again.');
        }
    }

    /**
     * Handle /debug command - Show conversation flow diagnostics
     */
    async handleDebugCommand(msg) {
        const chatId = msg.chat.id;
        
        try {
            const stats = this.conversationTracker;
            const totalRouted = Object.values(stats.intentRouting).reduce((a, b) => a + b, 0);
            const claudePercentage = stats.totalMessages > 0 ? ((stats.claudeUsage / stats.totalMessages) * 100).toFixed(1) : '0';
            const directPercentage = stats.totalMessages > 0 ? ((stats.directProcessing / stats.totalMessages) * 100).toFixed(1) : '0';
            
            const debugMessage = `
🐛 **Conversation Flow Diagnostics**

📊 **Message Processing Stats:**
• Total messages: ${stats.totalMessages}
• Claude AI usage: ${stats.claudeUsage} (${claudePercentage}%)
• Direct processing: ${stats.directProcessing} (${directPercentage}%)

🎯 **Intent Detection Breakdown:**
• Availability updates: ${stats.intentRouting.availability_update}
• Availability queries: ${stats.intentRouting.availability_query}
• Availability clears: ${stats.intentRouting.availability_clear}
• Session deletions: ${stats.intentRouting.session_deletion}
• General chat: ${stats.intentRouting.general_chat}

🔧 **Debug Settings:**
• Debug mode: ${this.debugMode ? 'ON' : 'OFF'}
• Claude API: ${this.claudeAPIKey ? 'Configured' : 'Missing'}

💡 **Tip:** Watch the logs to see real-time routing decisions!
            `;
            
            await this.bot.sendMessage(chatId, debugMessage);
            
            // Also show a sample intent test if in debug mode
            if (this.debugMode) {
                await this.bot.sendMessage(chatId, 
                    "🧪 **Quick Intent Test:**\n" +
                    "Try these messages to see routing:\n" +
                    "• \"Set me available Monday 9am\" (should → direct)\n" +
                    "• \"What's my schedule?\" (should → direct)\n" +
                    "• \"Clear my availability\" (should → direct)\n" +
                    "• \"Cancel my session\" (should → direct)\n" +
                    "• \"How's your day?\" (should → Claude AI)"
                );
            }
            
        } catch (error) {
            console.error('[Bot Error] Debug command failed:', error);
            await this.sendErrorMessage(chatId, 'Failed to get debug information.');
        }
    }

    /**
     * Handle /test command
     */
    async handleTestCommand(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        
        try {
            await this.bot.sendMessage(chatId, 'Running sync test... 🧪');
            
            const result = await this.apiService.testSync(telegramId);
            
            if (result.success) {
                const message = `
🧪 Sync Test Results:

✅ Test passed successfully!
📋 ${result.message}
📝 ${result.note}

The test created and deleted a temporary availability slot to verify real-time synchronization between the bot and website.
                `;
                
                await this.bot.sendMessage(chatId, message);
            } else {
                await this.sendErrorMessage(chatId, `Sync test failed: ${result.error}`);
            }
            
        } catch (error) {
            console.error('[Bot Error] Test command failed:', error);
            await this.sendErrorMessage(chatId, 'Failed to run test. Please try again.');
        }
    }

    /**
     * Handle natural language messages with Claude AI
     */
    async handleNaturalLanguage(msg) {
        const chatId = msg.chat.id;
        const messageText = msg.text;
        const telegramId = msg.from.id;
        
        this.debugLog('=== Natural Language Processing Started ===');
        this.debugLog('Message text:', messageText);
        
        if (!this.claudeAPIKey) {
            console.warn('[Bot Warning] Claude AI not configured');
            await this.bot.sendMessage(chatId, 
                "🤖 Claude AI is not configured. Please set ANTHROPIC_API_KEY environment variable."
            );
            return;
        }

        try {
            this.debugLog('Step 1: Checking for pending session choice');
            
            // CHECK FOR PENDING SESSION CHOICE FIRST - before any other processing
            const existingContext = this.userContexts.get(telegramId);
            if (existingContext && existingContext.waitingForSessionChoice) {
                this.debugLog('User has pending session choice, processing number selection');
                await this.handleSessionChoice(msg, existingContext, messageText);
                return;
            }
            
            this.debugLog('Step 2: Getting user data and availability');
            
            // Get user data and availability for context
            const user = await this.apiService.getUserByTelegramId(telegramId);
            const availability = await this.apiService.getUserAvailability(telegramId);
            
            this.debugLog('User found:', user);
            this.debugLog('User availability:', availability);
            
            if (!user) {
                console.warn(`[Bot Warning] User not found for Telegram ID: ${telegramId}`);
                await this.bot.sendMessage(chatId,
                    "⚠️ I don't recognize you in the system. Please register on the GymBuddy website first!"
                );
                return;
            }

            this.debugLog('Step 3: Preparing context for Claude');
            
            // Store context for potential follow-up actions
            this.userContexts.set(telegramId, {
                lastAvailability: availability,
                lastMessage: messageText,
                timestamp: Date.now()
            });
            
            // Prepare context for Claude
            const availabilityContext = availability && availability.length > 0 
                ? availability.map(slot => 
                    `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)}: ${slot.start_time}:00-${slot.end_time}:00`
                ).join(', ')
                : 'No availability set yet';

            this.debugLog('Availability context:', availabilityContext);
            
            // Enhanced message routing with context awareness
            const messageIntent = this.analyzeMessageIntent(messageText, availability);
            this.debugLog('Message intent analysis:', messageIntent);
            
            // Route message based on intent analysis
            this.conversationTracker.intentRouting[messageIntent.type]++;
            
            console.log(`[ROUTING] Intent: ${messageIntent.type} (confidence: ${messageIntent.confidence})`);
            this.debugLog('Intent routing decision:', {
                detected_intent: messageIntent.type,
                confidence: messageIntent.confidence,
                will_use_claude: messageIntent.type === 'general_chat',
                routing_count: this.conversationTracker.intentRouting[messageIntent.type]
            });
            
            switch (messageIntent.type) {
                case 'availability_update':
                    this.conversationTracker.directProcessing++;
                    console.log('[ROUTING] → Direct processing: Availability Update');
                    await this.handleAvailabilityUpdate(msg, user, messageText);
                    return;
                    
                case 'availability_query':
                    this.conversationTracker.directProcessing++;
                    console.log('[ROUTING] → Direct processing: Availability Query');
                    await this.handleAvailabilityQuery(msg, user);
                    return;
                    
                case 'availability_clear':
                    this.conversationTracker.directProcessing++;
                    console.log('[ROUTING] → Direct processing: Availability Clear');
                    await this.handleAvailabilityClear(msg, user);
                    return;
                    
                case 'session_deletion':
                    this.conversationTracker.directProcessing++;
                    console.log('[ROUTING] → Direct processing: Session Deletion');
                    await this.handleSessionDeletion(msg, user, messageText);
                    return;
                    
                case 'general_chat':
                default:
                    this.conversationTracker.claudeUsage++;
                    console.log('[ROUTING] → Claude AI processing: General Chat');
                    // Continue to Claude AI for general conversation
                    break;
            }

            this.debugLog('Step 3: Calling Claude API for general conversation');
            
            const claudePrompt = {
                model: "claude-3-5-sonnet-20241022",
                max_tokens: 1000,
                temperature: 0.7,
                system: `You are GymBuddy, a helpful and enthusiastic gym partner! 💪

You're here to chat about fitness, motivation, and workouts. Respond naturally and conversationally to whatever the user says.

Personality:
- Friendly, supportive, and encouraging  
- Short, casual responses like texting a friend
- Focus on fitness, motivation, health topics
- Always positive and upbeat

CRITICAL RULES:
- NEVER mention bot commands or how to use the bot
- NEVER say "you can", "you could", "try saying", or give instructions
- NEVER explain bot functionality or provide examples
- Just chat naturally like a supportive friend
- Focus ONLY on fitness motivation, workout advice, and general encouragement

NOTE: You should NOT be handling scheduling, availability, or session management requests. 
Those are handled separately by the bot's direct processing system.

Examples:
"Hey how's it going?" → "Hey! Going great, just finished a killer leg workout! How about you?"
"What's the best exercise for building muscle?" → "Compound movements are amazing! Squats, deadlifts, and bench press are my favorites. What muscle group are you focusing on?"
"I need some motivation" → "You've got this! Every workout counts, even the tough days. What's your goal right now?"`,
                messages: [{
                    role: "user",
                    content: `User: ${user.name} (Telegram ID: ${telegramId})
Message: ${messageText}

User's current availability: ${availabilityContext}

Respond to this general conversation message. Focus on fitness motivation and advice rather than availability management.`
                }]
            };

            // Call Claude AI
            console.log('[CLAUDE] Sending request to Claude AI...');
            this.debugLog('Claude prompt system message:', claudePrompt.system);
            this.debugLog('Claude prompt user message:', claudePrompt.messages[0].content);
            
            const claudeResponse = await this.callClaudeAPI(claudePrompt);
            
            this.debugLog('Claude API response:', claudeResponse);
            console.log('[CLAUDE] Response received:', claudeResponse.success ? 'SUCCESS' : 'FAILED');
            
            if (claudeResponse.success) {
                console.log('[CLAUDE] Response preview:', claudeResponse.message.substring(0, 100) + '...');
                
                // Analyze the response for robotic patterns
                if (this.debugMode) {
                    this.analyzeClaudeResponse(claudeResponse.message, messageText);
                }
            }
            
            if (claudeResponse.success) {
                this.debugLog('Step 4: Sending successful response to user');
                await this.bot.sendMessage(chatId, claudeResponse.message);
            } else {
                console.error('[Bot Error] Claude API failed:', claudeResponse.error);
                await this.sendErrorMessage(chatId, 'Sorry, I had trouble processing your message with AI.');
            }

        } catch (error) {
            console.error('[Bot Error] Natural language processing failed:', error);
            this.debugLog('Error details:', error);
            await this.sendErrorMessage(chatId, 'Sorry, I encountered an error understanding your message.');
        } finally {
            this.debugLog('=== Natural Language Processing Completed ===');
        }
    }

    /**
     * Analyze message intent with enhanced classification and context awareness
     */
    analyzeMessageIntent(messageText, currentAvailability = null) {
        const text = messageText.toLowerCase().trim();
        
        // CHECK FOR SESSION DELETION INTENT FIRST (highest priority)
        const sessionDeletionIntent = this.detectSessionDeletionIntent(text);
        if (sessionDeletionIntent.detected) {
            return { type: 'session_deletion', confidence: sessionDeletionIntent.confidence };
        }
        
        // Check for contextual clearing intent (e.g., "clear this", "remove it")
        const contextualClearKeywords = [
            'clear this',
            'clear it',
            'delete this',
            'delete it',
            'remove this',
            'remove it',
            'cancel this',
            'cancel it',
            'cancel all',
            'clear all'
        ];
        
        // Check for explicit clearing intent
        const clearKeywords = [
            'clear my availability',
            'clear availability',
            'delete my availability',
            'remove my availability',
            'cancel my availability',
            'reset my schedule'
        ];
        
        // If contextual clear keywords are used and user has availability, treat as clear intent
        if (contextualClearKeywords.some(keyword => text.includes(keyword)) && 
            currentAvailability && currentAvailability.length > 0) {
            return { type: 'availability_clear', confidence: 'high' };
        }
        
        if (clearKeywords.some(keyword => text.includes(keyword))) {
            return { type: 'availability_clear', confidence: 'high' };
        }
        
        // Check for availability update intent FIRST (before query check)
        const isAvailabilityUpdate = this.detectAvailabilityUpdateIntent(text);
        if (isAvailabilityUpdate) {
            return { type: 'availability_update', confidence: 'high' };
        }
        
        // Check for availability query intent (after update check to avoid conflicts)
        const queryKeywords = [
            'what\'s my availability',
            'show my availability',
            'my schedule',
            'when am i available',
            'what\'s my schedule',
            'check my availability'
        ];
        
        if (queryKeywords.some(keyword => text.includes(keyword))) {
            return { type: 'availability_query', confidence: 'high' };
        }
        
        // Default to general chat
        return { type: 'general_chat', confidence: 'medium' };
    }
    
    /**
     * Detect if message is about session deletion
     */
    detectSessionDeletionIntent(messageText) {
        const text = messageText.toLowerCase().trim();
        
        // Direct session deletion keywords (highest confidence)
        const directSessionKeywords = [
            'cancel my session',
            'delete my session',
            'remove my session',
            'cancel the session',
            'delete the session',
            'remove the session',
            'cancel my confirmed session',
            'delete my confirmed session',
            'remove my confirmed session',
            'cancel my gym session',
            'delete my gym session',
            'remove my gym session',
            'cancel my workout session',
            'delete my workout session',
            'remove my workout session'
        ];
        
        // Check for direct keywords first
        for (const keyword of directSessionKeywords) {
            if (text.includes(keyword)) {
                this.debugLog(`Direct session deletion detected: "${keyword}"`);
                return { detected: true, confidence: 'high' };
            }
        }
        
        // Contextual session deletion patterns (medium confidence)
        const contextualPatterns = [
            // User's exact messages from the screenshot
            /cancel.*it.*session/i,
            /want.*cancel.*it/i,
            /please.*delete.*it/i,
            /cancel.*confirmed/i,
            /delete.*confirmed/i,
            
            // General patterns
            /cancel.*session/i,
            /delete.*session/i,
            /remove.*session/i,
            /cancel.*workout/i,
            /delete.*workout/i,
            /cancel.*gym.*session/i,
            /delete.*gym.*session/i,
            
            // Contextual references with "it"
            /cancel.*it/i,
            /delete.*it/i,
            /remove.*it/i
        ];
        
        // Check contextual patterns
        for (const pattern of contextualPatterns) {
            if (pattern.test(text)) {
                this.debugLog(`Contextual session deletion pattern matched: ${pattern}`);
                return { detected: true, confidence: 'medium' };
            }
        }
        
        // Session-related words combined with action words (lower confidence)
        const sessionWords = ['session', 'workout', 'gym', 'confirmed', 'scheduled'];
        const actionWords = ['cancel', 'delete', 'remove', 'clear'];
        
        const hasSessionWord = sessionWords.some(word => text.includes(word));
        const hasActionWord = actionWords.some(word => text.includes(word));
        
        if (hasSessionWord && hasActionWord) {
            this.debugLog(`Session + action word combination detected`);
            return { detected: true, confidence: 'low' };
        }
        
        return { detected: false, confidence: 'none' };
    }
    
    /**
     * Detect if message is about availability updates
     */
    detectAvailabilityUpdateIntent(messageText) {
        const text = messageText.toLowerCase().trim();
        
        // Strong availability intent keywords
        const strongAvailabilityKeywords = [
            'update my availability',
            'set my availability', 
            'availability for',
            'available on',
            'available for',
            'free on',
            'free for',
            'schedule me',
            'book me',
            'add availability',
            'i\'m available',
            'i am available',
            'can work out',
            'can gym',
            'gym at',
            'workout at'
        ];
        
        // Day keywords
        const dayKeywords = [
            'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
            'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun',
            'tomorrow', 'today', 'next week', 'this week'
        ];
        
        // Time pattern keywords
        const timePatterns = [
            /\d{1,2}\s*(am|pm|:\d{2})/i,  // "9am", "6pm", "10:30"
            /\d{1,2}\s*(to|-|until)\s*\d{1,2}/i,  // "9 to 11", "6-8"
            /from\s+\d{1,2}/i,  // "from 9"
            /at\s+\d{1,2}/i,   // "at 6"
            /(morning|afternoon|evening|night)/i,  // time of day
            /o'?clock/i  // "o'clock"
        ];
        
        // Check for strong availability keywords
        const hasStrongAvailabilityKeyword = strongAvailabilityKeywords.some(keyword => 
            text.includes(keyword)
        );
        
        // Check for day keywords
        const hasDayKeyword = dayKeywords.some(keyword => 
            text.includes(keyword)
        );
        
        // Check for time patterns
        const hasTimePattern = timePatterns.some(pattern => 
            pattern.test(text)
        );
        
        // Determine intent based on combinations
        let isAvailabilityIntent = false;
        let confidence = 'low';
        
        if (hasStrongAvailabilityKeyword) {
            isAvailabilityIntent = true;
            confidence = 'high';
        } else if (hasDayKeyword && hasTimePattern) {
            isAvailabilityIntent = true;
            confidence = 'medium';
        } else if ((hasDayKeyword || hasTimePattern) && 
                   (text.includes('update') || text.includes('set') || text.includes('add'))) {
            isAvailabilityIntent = true;
            confidence = 'medium';
        }
        
        this.debugLog('Availability intent detection:', {
            text: text,
            hasStrongAvailabilityKeyword,
            hasDayKeyword,
            hasTimePattern,
            confidence,
            result: isAvailabilityIntent
        });
        
        return isAvailabilityIntent;
    }
    
    /**
     * Handle availability query requests
     */
    async handleAvailabilityQuery(msg, user) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        
        this.debugLog('Handling availability query for user:', user.name);
        
        try {
            const availability = await this.apiService.getUserAvailability(telegramId);
            
            if (!availability || availability.length === 0) {
                await this.bot.sendMessage(chatId, 
                    "📅 You don't have any availability set yet. Just let me know when you're free to work out!"
                );
                return;
            }
            
            let message = `📅 Hi ${user.name}, here's your current availability:\n\n`;
            
            // Group by day and format nicely
            const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const groupedByDay = {};
            
            availability.forEach(slot => {
                if (!groupedByDay[slot.day]) {
                    groupedByDay[slot.day] = [];
                }
                groupedByDay[slot.day].push(slot);
            });
            
            dayOrder.forEach(day => {
                if (groupedByDay[day]) {
                    const dayName = day.charAt(0).toUpperCase() + day.slice(1);
                    message += `🗓️ ${dayName}:\n`;
                    
                    groupedByDay[day]
                        .sort((a, b) => a.start_time - b.start_time)
                        .forEach(slot => {
                            message += `   ⏰ ${slot.start_time}:00 - ${slot.end_time}:00\n`;
                        });
                    message += '\n';
                }
            });
            
            message += `📊 Total slots: ${availability.length}\n`;
            message += "🔄 Synced with website in real-time";
            
            await this.bot.sendMessage(chatId, message);
            
        } catch (error) {
            console.error('[Bot Error] Availability query failed:', error);
            await this.sendErrorMessage(chatId, 'Failed to retrieve your availability. Please try again.');
        }
    }
    
    /**
     * Handle availability clear requests
     */
    async handleAvailabilityClear(msg, user) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        
        this.debugLog('Handling availability clear for user:', user.name);
        
        try {
            // Just do it without announcing
            // await this.bot.sendMessage(chatId, `⏳ Clearing your availability, ${user.name}...`);
            
            const result = await this.apiService.clearUserAvailability(telegramId);
            
            if (result.success) {
                const message = `
✅ Done! Cleared ${result.deletedCount} ${result.deletedCount === 1 ? 'slot' : 'slots'} from your schedule.

🔄 Changes synced with website.
                `;
                
                await this.bot.sendMessage(chatId, message);
            } else {
                await this.sendErrorMessage(chatId, `Failed to clear availability: ${result.error}`);
            }
            
        } catch (error) {
            console.error('[Bot Error] Availability clear failed:', error);
            await this.sendErrorMessage(chatId, 'Failed to clear availability. Please try again.');
        }
    }
    
    /**
     * Handle session deletion requests
     */
    async handleSessionDeletion(msg, user, messageText) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        
        this.debugLog('=== Session Deletion Processing Started ===');
        this.debugLog('Message:', messageText);
        this.debugLog('User:', user.name);
        this.debugLog('Telegram ID:', telegramId);
        
        try {
            // Enhanced logging for getUserSessions call
            console.log('[SESSION DEBUG] About to call getUserSessions...');
            console.log('[SESSION DEBUG] API Service instance:', !!this.apiService);
            console.log('[SESSION DEBUG] getUserSessions method exists:', typeof this.apiService.getUserSessions);
            
            if (typeof this.apiService.getUserSessions !== 'function') {
                console.error('[SESSION ERROR] getUserSessions is not a function!');
                await this.bot.sendMessage(chatId, 
                    "🚧 Session management is not fully implemented yet. I can help with availability management instead!\n\n" +
                    "Try: 'clear my availability' or 'show my availability'"
                );
                return;
            }
            
            // Check if user has any sessions first
            console.log('[SESSION DEBUG] Calling getUserSessions with telegramId:', telegramId);
            const sessions = await this.apiService.getUserSessions(telegramId);
            console.log('[SESSION DEBUG] getUserSessions returned:', sessions);
            console.log('[SESSION DEBUG] Sessions type:', typeof sessions);
            console.log('[SESSION DEBUG] Sessions is array:', Array.isArray(sessions));
            console.log('[SESSION DEBUG] Sessions length:', sessions?.length);
            
            if (!sessions || sessions.length === 0) {
                console.log('[SESSION DEBUG] No sessions found for user');
                await this.bot.sendMessage(chatId, 
                    "📅 You don't have any confirmed sessions to cancel right now."
                );
                return;
            }
            
            console.log('[SESSION DEBUG] Found sessions, preparing list...');
            
            // For now, show what sessions exist and ask for confirmation
            // TODO: Parse which specific session to delete from messageText
            let sessionsList = `📋 Your confirmed sessions:\n\n`;
            
            sessions.forEach((session, index) => {
                const dayName = session.day.charAt(0).toUpperCase() + session.day.slice(1);
                sessionsList += `${index + 1}. ${dayName} ${session.start_time}:00-${session.end_time}:00\n`;
            });
            
            sessionsList += `\n❓ Which session would you like to cancel? Reply with the number (1, 2, etc.)`;
            
            console.log('[SESSION DEBUG] Sending sessions list to user');
            await this.bot.sendMessage(chatId, sessionsList);
            
            // Store context for follow-up
            this.userContexts.set(telegramId, {
                waitingForSessionChoice: true,
                availableSessions: sessions,
                originalRequest: messageText,
                timestamp: Date.now()
            });
            
        } catch (error) {
            console.error('[Bot Error] Session deletion failed:', error);
            console.error('[SESSION ERROR] Error type:', typeof error);
            console.error('[SESSION ERROR] Error name:', error.name);
            console.error('[SESSION ERROR] Error message:', error.message);
            console.error('[SESSION ERROR] Error stack:', error.stack);
            
            // Enhanced error diagnostics
            if (error.message) {
                console.log('[SESSION ERROR] Error message contains:');
                console.log('  - "getUserSessions is not a function":', error.message.includes('getUserSessions is not a function'));
                console.log('  - "fetch":', error.message.includes('fetch'));
                console.log('  - "timeout":', error.message.includes('timeout'));
                console.log('  - "API request failed":', error.message.includes('API request failed'));
                console.log('  - "404":', error.message.includes('404'));
                console.log('  - "500":', error.message.includes('500'));
            }
            
            // Check if this is a "method not found" error
            if (error.message && error.message.includes('getUserSessions is not a function')) {
                await this.bot.sendMessage(chatId, 
                    "🚧 Session management is not fully implemented yet. I can help with availability management instead!\n\n" +
                    "Try: 'clear my availability' or 'show my availability'"
                );
            } else if (error.message && error.message.includes('API request failed')) {
                // API endpoint doesn't exist or returned an error
                await this.sendErrorMessage(chatId, `API Error: ${error.message}`);
            } else if (error.message && error.message.includes('fetch')) {
                // Network/connectivity issue
                await this.sendErrorMessage(chatId, 'Network error: Unable to connect to the server. Please try again.');
            } else if (error.message && error.message.includes('timeout')) {
                // Request timeout
                await this.sendErrorMessage(chatId, 'Request timeout: The server took too long to respond. Please try again.');
            } else {
                // Generic error with full details for debugging
                await this.sendErrorMessage(chatId, `Sorry, I had trouble accessing your sessions. Error: ${error.message}`);
            }
        } finally {
            this.debugLog('=== Session Deletion Processing Completed ===');
        }
    }
    
    /**
     * Handle session choice when user replies with a number
     */
    async handleSessionChoice(msg, context, messageText) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        
        this.debugLog('=== Session Choice Processing Started ===');
        this.debugLog('User message:', messageText);
        this.debugLog('Available sessions:', context.availableSessions);
        
        try {
            // Parse the user's choice
            const choiceText = messageText.trim();
            const choiceNumber = parseInt(choiceText);
            
            this.debugLog('Parsed choice number:', choiceNumber);
            
            // Validate the choice
            if (isNaN(choiceNumber) || choiceNumber < 1 || choiceNumber > context.availableSessions.length) {
                await this.bot.sendMessage(chatId, 
                    `❌ Please enter a valid number between 1 and ${context.availableSessions.length}.`
                );
                return; // Keep waiting for valid choice
            }
            
            // Get the selected session (arrays are 0-indexed, user sees 1-indexed)
            const selectedSession = context.availableSessions[choiceNumber - 1];
            this.debugLog('Selected session:', selectedSession);
            
            // Show confirmation and delete the session
            const dayName = selectedSession.day.charAt(0).toUpperCase() + selectedSession.day.slice(1);
            await this.bot.sendMessage(chatId, 
                `🗑️ Canceling your session: ${dayName} ${selectedSession.start_time}:00-${selectedSession.end_time}:00...`
            );
            
            // Delete the session via API
            const result = await this.apiService.deleteUserSession(telegramId, selectedSession.id);
            
            if (result.success) {
                await this.bot.sendMessage(chatId, 
                    `✅ Session canceled successfully!\n\n🔄 Your website will update automatically.`
                );
            } else {
                await this.sendErrorMessage(chatId, `Failed to cancel session: ${result.error}`);
            }
            
        } catch (error) {
            console.error('[Bot Error] Session choice processing failed:', error);
            await this.sendErrorMessage(chatId, 'Failed to process your session choice. Please try again.');
        } finally {
            // Clear the context - user is no longer waiting for a choice
            this.userContexts.delete(telegramId);
            this.debugLog('=== Session Choice Processing Completed ===');
        }
    }
    
    /**
     * Handle availability update requests
     */
    async handleAvailabilityUpdate(msg, user, messageText) {
        const chatId = msg.chat.id;
        
        this.debugLog('=== Availability Update Processing Started ===');
        this.debugLog('Message:', messageText);
        
        try {
            // Parse availability from natural language
            const parsedSlots = await this.parseAvailabilityFromText(messageText);
            
            this.debugLog('Parsed availability slots:', parsedSlots);
            
            if (!parsedSlots || parsedSlots.length === 0) {
                await this.bot.sendMessage(chatId, 
                    "🤔 I didn't quite catch that time. Try something like 'Monday 9am' or 'Tuesday evening'?"
                );
                return;
            }
            
            // Show processing message with details
            const slotsPreview = parsedSlots.map(slot => 
                `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)} ${slot.startTime}:00-${slot.endTime}:00`
            ).join(', ');
            
            await this.bot.sendMessage(chatId, `⏳ Adding availability: ${slotsPreview}...`);
            
            // Convert parsed slots to API expected format (using snake_case)
            const apiSlots = parsedSlots.map(slot => ({
                day: slot.day,
                start_time: slot.startTime,  // API expects snake_case
                end_time: slot.endTime       // API expects snake_case
            }));
            
            // Enhanced debug logging for troubleshooting
            this.debugLog('Original parsed slots:', parsedSlots);
            this.debugLog('Converted slots for API:', JSON.stringify(apiSlots, null, 2));
            console.log('[Bot Debug] Sending to API:', {
                telegram_id: msg.from.id,
                slots: apiSlots,
                slot_count: apiSlots.length
            });
            
            // Update availability via API
            const result = await this.apiService.setUserAvailability(msg.from.id, apiSlots);
            
            this.debugLog('API update result:', JSON.stringify(result, null, 2));
            console.log('[Bot Debug] API Response:', {
                success: result.success,
                error: result.error,
                slots_set: result.slotsSet
            });
            
            if (result.success) {
                const slotsText = parsedSlots.map(slot => 
                    `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)}: ${slot.startTime}:00-${slot.endTime}:00`
                ).join('\n');
                
                await this.bot.sendMessage(chatId, 
                    `✅ Got it! Added ${slotsText} to your schedule.\n\n` +
                    `🔄 Synced with website.`
                );
            } else {
                // Provide more specific error feedback
                let errorMessage = '❌ Failed to update availability.';
                
                // Parse different types of errors
                if (result.error) {
                    if (result.error.includes('User not found')) {
                        errorMessage = '❌ User not found in system. Please register on the GymBuddy website first.';
                    } else if (result.error.includes('null value in column')) {
                        // This specific error means the time values weren't properly sent
                        errorMessage = '❌ Time format error: Unable to parse the time values correctly.';
                        this.debugLog('API received invalid time values. Slots sent:', apiSlots);
                    } else if (result.error.includes('Invalid')) {
                        errorMessage = '❌ Invalid time format detected. Please try a different format.';
                    } else if (result.error.includes('violates')) {
                        // Database constraint violation
                        errorMessage = '❌ Database error: Invalid data format. Please check your input.';
                    } else {
                        // Show the actual error for debugging
                        errorMessage = `❌ Update failed: API request failed: ${result.error}`;
                    }
                }
                
                await this.sendErrorMessage(chatId, errorMessage);
                
                // Only provide simple help if parsing failed, without being instructional
                if (result.error && result.error.includes('format')) {
                    await this.bot.sendMessage(chatId, 
                        "💡 Try something like 'Monday 9am-11am'"
                    );
                }
            }
            
        } catch (error) {
            console.error('[Bot Error] Availability update failed:', error);
            this.debugLog('Error details:', error);
            
            // Provide user-friendly error message based on error type
            let userMessage = 'Sorry, I encountered an error updating your availability.';
            
            if (error.message && error.message.includes('fetch')) {
                userMessage = 'Unable to connect to the server. Please try again in a moment.';
            } else if (error.message && error.message.includes('timeout')) {
                userMessage = 'The request timed out. Please try again.';
            } else if (error.message && error.message.includes('parse')) {
                userMessage = 'I had trouble understanding the time format. Please try a simpler format like "Monday 9am-11am".';
            }
            
            await this.sendErrorMessage(chatId, userMessage);
        } finally {
            this.debugLog('=== Availability Update Processing Completed ===');
        }
    }
    
    /**
     * Parse availability slots from natural language text
     */
    async parseAvailabilityFromText(text) {
        this.debugLog('Parsing availability from text:', text);
        
        const slots = [];
        const normalizedText = text.toLowerCase().trim();
        
        // Enhanced day mapping with better detection
        const dayMap = {
            'monday': 'monday', 'mon': 'monday',
            'tuesday': 'tuesday', 'tue': 'tuesday', 'tues': 'tuesday',
            'wednesday': 'wednesday', 'wed': 'wednesday',
            'thursday': 'thursday', 'thu': 'thursday', 'thurs': 'thursday',
            'friday': 'friday', 'fri': 'friday',
            'saturday': 'saturday', 'sat': 'saturday',
            'sunday': 'sunday', 'sun': 'sunday'
        };
        
        // Handle relative day references
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        
        let targetDay = null;
        
        // Check for specific day names first (improved matching)
        for (const [key, day] of Object.entries(dayMap)) {
            // Use word boundary matching to avoid partial matches
            const regex = new RegExp(`\\b${key}\\b`, 'i');
            if (regex.test(normalizedText)) {
                targetDay = day;
                break;
            }
        }
        
        // Handle relative references if no specific day found
        if (!targetDay) {
            if (normalizedText.includes('tomorrow')) {
                const tomorrowDay = (dayOfWeek + 1) % 7;
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                targetDay = dayNames[tomorrowDay];
            } else if (normalizedText.includes('today')) {
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                targetDay = dayNames[dayOfWeek];
            }
        }
        
        this.debugLog('Target day found:', targetDay);
        
        if (!targetDay) {
            this.debugLog('No day found in text');
            return null;
        }
        
        // Enhanced time parsing with more patterns
        const timePatterns = [
            // "9 to 11am", "9-11am", "09 to 11am"
            /(\d{1,2})\s*(?:to|-|until)\s*(\d{1,2})\s*(am|pm)/gi,
            // "9am to 11am", "9am-11am"
            /(\d{1,2})\s*(am|pm)\s*(?:to|-|until)\s*(\d{1,2})\s*(am|pm)/gi,
            // "09:00 to 11:00", "9:00-11:00"
            /(\d{1,2}):(\d{2})\s*(?:to|-|until)\s*(\d{1,2}):(\d{2})/gi,
            // "from 9am to 11am"
            /from\s+(\d{1,2})\s*(am|pm)\s+to\s+(\d{1,2})\s*(am|pm)/gi,
            // "at 9am" - single time (assume 2 hour duration)
            /at\s+(\d{1,2})\s*(am|pm)/gi,
            // "9am" - single time (assume 2 hour duration)
            /^.*(\d{1,2})\s*(am|pm).*$/gi,
            // "morning", "afternoon", "evening" - predefined slots
            /(morning|afternoon|evening)/gi
        ];
        
        let timeMatch = null;
        let startTime = null;
        let endTime = null;
        
        for (const pattern of timePatterns) {
            // Reset regex lastIndex to avoid issues with global flag
            pattern.lastIndex = 0;
            timeMatch = pattern.exec(normalizedText);
            if (timeMatch) {
                this.debugLog('Time pattern matched:', timeMatch);
                
                if (timeMatch.length === 4 && timeMatch[3]) { // "9 to 11am" format
                    startTime = this.parseTime(timeMatch[1], timeMatch[3]);
                    endTime = this.parseTime(timeMatch[2], timeMatch[3]);
                } else if (timeMatch.length === 5 && timeMatch[2] && timeMatch[4]) { // "9am to 11am" format
                    startTime = this.parseTime(timeMatch[1], timeMatch[2]);
                    endTime = this.parseTime(timeMatch[3], timeMatch[4]);
                } else if (timeMatch.length === 5) { // "09:00 to 11:00" format (array has 5 elements)
                    const potentialStartTime = parseInt(timeMatch[1]);
                    const potentialEndTime = parseInt(timeMatch[3]);
                    
                    // Handle 24-hour format (0-23) - database uses 0-23 for hours
                    if (potentialStartTime >= 0 && potentialStartTime <= 23 && 
                        potentialEndTime >= 1 && potentialEndTime <= 23 &&  // Fixed: max is 23, not 24
                        potentialStartTime < potentialEndTime) {
                        startTime = potentialStartTime;
                        endTime = potentialEndTime;
                    } else {
                        startTime = null;
                        endTime = null;
                    }
                } else if (timeMatch.length === 3 && timeMatch[2]) { // "at 9am" or single time
                    startTime = this.parseTime(timeMatch[1], timeMatch[2]);
                    endTime = startTime + 2; // Default 2-hour duration
                    if (endTime > 23) endTime = 23; // Don't go past midnight
                } else if (timeMatch.length === 2 && typeof timeMatch[1] === 'string') { // "morning", "afternoon", "evening"
                    const timeOfDay = timeMatch[1].toLowerCase();
                    switch (timeOfDay) {
                        case 'morning':
                            startTime = 9;  // 9 AM
                            endTime = 12;   // 12 PM
                            break;
                        case 'afternoon':
                            startTime = 14; // 2 PM
                            endTime = 17;   // 5 PM
                            break;
                        case 'evening':
                            startTime = 18; // 6 PM
                            endTime = 21;   // 9 PM
                            break;
                    }
                }
                
                if (startTime !== null && endTime !== null) {
                    break; // Found valid time, stop looking
                }
            }
        }
        
        this.debugLog('Parsed times:', { startTime, endTime });
        
        if (startTime !== null && endTime !== null && startTime < endTime && 
            startTime >= 0 && startTime <= 23 && endTime >= 1 && endTime <= 24) {
            slots.push({
                day: targetDay,
                startTime: startTime,
                endTime: endTime
            });
        }
        
        return slots.length > 0 ? slots : null;
    }
    
    /**
     * Parse time string to 24-hour format
     */
    parseTime(hour, period) {
        let h = parseInt(hour);
        
        // Validate input
        if (isNaN(h) || h < 1 || h > 12) {
            this.debugLog('Invalid hour detected:', hour);
            return null;
        }
        
        if (!period || (period !== 'am' && period !== 'pm')) {
            this.debugLog('Invalid period detected:', period);
            return null;
        }
        
        // Convert to 24-hour format
        if (period === 'pm' && h !== 12) {
            h += 12;
        } else if (period === 'am' && h === 12) {
            h = 0;
        }
        
        this.debugLog(`Converted ${hour}${period} to ${h}:00`);
        return h;
    }

    /**
     * Call Claude AI API with proper implementation
     */
    async callClaudeAPI(prompt) {
        this.debugLog('=== Claude API Call Started ===');
        this.debugLog('Prompt:', prompt);
        
        if (!this.claudeAPIKey) {
            console.error('[Bot Error] No Claude API key configured');
            return {
                success: false,
                error: 'Claude API key not configured'
            };
        }
        
        try {
            const fetch = require('node-fetch');
            
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.claudeAPIKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(prompt)
            });
            
            this.debugLog('Claude API response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('[Bot Error] Claude API request failed:', response.status, errorText);
                return {
                    success: false,
                    error: `Claude API error: ${response.status} ${errorText}`
                };
            }
            
            const data = await response.json();
            this.debugLog('Claude API response data:', data);
            
            if (data.content && data.content[0] && data.content[0].text) {
                return {
                    success: true,
                    message: data.content[0].text
                };
            } else {
                console.error('[Bot Error] Unexpected Claude API response format:', data);
                return {
                    success: false,
                    error: 'Unexpected response format from Claude API'
                };
            }
            
        } catch (error) {
            console.error('[Bot Error] Claude API call failed:', error);
            this.debugLog('Error details:', error);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.debugLog('=== Claude API Call Completed ===');
        }
    }

    /**
     * Send error message to user
     */
    async sendErrorMessage(chatId, message) {
        try {
            await this.bot.sendMessage(chatId, `❌ ${message}`);
        } catch (error) {
            console.error('[Bot Error] Failed to send error message:', error);
        }
    }

    /**
     * Start the bot
     */
    start() {
        console.log('[Bot] GymBuddy Telegram Bot started and listening for messages...');
        
        // Perform initial health check
        this.apiService.healthCheck().then(result => {
            if (result.success) {
                console.log('[Bot] API health check passed:', result.status);
            } else {
                console.error('[Bot] API health check failed:', result.error);
            }
        });
        
        // Run NLP tests in debug mode
        if (this.debugMode) {
            setTimeout(() => {
                this.testNaturalLanguageProcessing();
            }, 2000); // Wait 2 seconds after startup
        }

        // Create HTTP server for Heroku PORT requirement
        const port = process.env.PORT || 3000;
        const server = http.createServer((req, res) => {
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.end(JSON.stringify({
                status: 'GymBuddy Telegram Bot is running! 🤖',
                timestamp: new Date().toISOString(),
                bot: '@GymBuddyAppBot',
                version: '1.0.0'
            }));
        });

        server.listen(port, () => {
            console.log(`[Bot] HTTP server listening on port ${port} for Heroku`);
        });

        // Store server reference for cleanup
        this.server = server;
    }

    /**
     * Test enhanced natural language processing
     */
    testNaturalLanguageProcessing() {
        console.log('\n=== Testing Enhanced Natural Language Processing ===');
        
        const testMessages = [
            // Availability update tests
            'Update my availability for next Tuesday, from 09 to 11am',
            'Set me available Monday 6-8pm',
            'Available Thursday morning',
            'I\'m free on Wednesday 14:00 to 16:00',
            'Add Friday evening to my schedule',
            'Tomorrow 7-9am works for me',
            
            // Availability query tests
            'What\'s my availability?',
            'Show my schedule',
            'When am I available?',
            'Check my availability',
            
            // Availability clear tests
            'Clear my availability',
            'Delete my availability',
            'Cancel my schedule',
            
            // General chat tests
            'Hello there!',
            'How are you doing?',
            'What\'s the best workout for arms?',
            'I need motivation to go to the gym'
        ];
        
        testMessages.forEach((message, index) => {
            console.log(`\nTest ${index + 1}: "${message}"`);
            
            // Test intent analysis
            const intent = this.analyzeMessageIntent(message);
            console.log(`  Intent: ${intent.type} (${intent.confidence} confidence)`);
            
            // Test availability detection for update messages
            if (intent.type === 'availability_update') {
                const parsedSlots = this.parseAvailabilityFromTextSync(message);
                if (parsedSlots && parsedSlots.length > 0) {
                    parsedSlots.forEach(slot => {
                        console.log(`  Parsed: ${slot.day} ${slot.startTime}:00-${slot.endTime}:00`);
                    });
                } else {
                    console.log('  Parsing: Failed to parse time/day');
                }
            }
        });
        
        console.log('\n=== Natural Language Processing Test Complete ===\n');
    }
    
    /**
     * Synchronous version of parseAvailabilityFromText for testing
     */
    parseAvailabilityFromTextSync(text) {
        const normalizedText = text.toLowerCase().trim();
        
        // Enhanced day mapping with better detection
        const dayMap = {
            'monday': 'monday', 'mon': 'monday',
            'tuesday': 'tuesday', 'tue': 'tuesday', 'tues': 'tuesday',
            'wednesday': 'wednesday', 'wed': 'wednesday',
            'thursday': 'thursday', 'thu': 'thursday', 'thurs': 'thursday',
            'friday': 'friday', 'fri': 'friday',
            'saturday': 'saturday', 'sat': 'saturday',
            'sunday': 'sunday', 'sun': 'sunday'
        };
        
        // Find target day
        let targetDay = null;
        for (const [key, day] of Object.entries(dayMap)) {
            if (normalizedText.includes(key)) {
                targetDay = day;
                break;
            }
        }
        
        // Handle relative references
        if (!targetDay) {
            if (normalizedText.includes('tomorrow')) {
                targetDay = 'tuesday'; // For testing purposes
            } else if (normalizedText.includes('today')) {
                targetDay = 'monday'; // For testing purposes
            }
        }
        
        if (!targetDay) return null;
        
        // Simplified time parsing for testing
        const timePatterns = [
            /(\d{1,2})\s*(?:to|-|until)\s*(\d{1,2})\s*(am|pm)/gi,
            /(\d{1,2})\s*(am|pm)\s*(?:to|-|until)\s*(\d{1,2})\s*(am|pm)/gi,
            /(\d{1,2}):(\d{2})\s*(?:to|-|until)\s*(\d{1,2}):(\d{2})/gi,
            /(morning|afternoon|evening)/gi
        ];
        
        let startTime = null;
        let endTime = null;
        
        for (const pattern of timePatterns) {
            pattern.lastIndex = 0;
            const match = pattern.exec(normalizedText);
            if (match) {
                if (match.length === 4 && match[3]) {
                    startTime = this.parseTime(match[1], match[3]);
                    endTime = this.parseTime(match[2], match[3]);
                } else if (match.length === 5 && match[2] && match[4]) {
                    startTime = this.parseTime(match[1], match[2]);
                    endTime = this.parseTime(match[3], match[4]);
                } else if (match.length === 6) {
                    startTime = parseInt(match[1]);
                    endTime = parseInt(match[3]);
                } else if (match.length === 2) {
                    const timeOfDay = match[1].toLowerCase();
                    switch (timeOfDay) {
                        case 'morning': startTime = 9; endTime = 12; break;
                        case 'afternoon': startTime = 14; endTime = 17; break;
                        case 'evening': startTime = 18; endTime = 21; break;
                    }
                }
                
                if (startTime !== null && endTime !== null) break;
            }
        }
        
        if (startTime !== null && endTime !== null && startTime < endTime) {
            return [{ day: targetDay, startTime, endTime }];
        }
        
        return null;
    }
    
    /**
     * Analyze Claude's response for robotic patterns (debugging)
     */
    analyzeClaudeResponse(response, originalMessage) {
        const roboticPatterns = [
            /you can use/i,
            /you can say/i,
            /try saying/i,
            /you could/i,
            /simply say/i,
            /just tell me/i,
            /here are some examples/i,
            /you might want to/i,
            /feel free to/i
        ];
        
        const foundPatterns = roboticPatterns.filter(pattern => pattern.test(response));
        
        if (foundPatterns.length > 0) {
            console.log('⚠️  [CLAUDE ANALYSIS] Potentially robotic response detected!');
            console.log('Original message:', originalMessage);
            console.log('Response length:', response.length);
            console.log('Robotic patterns found:', foundPatterns.length);
            console.log('Response preview:', response.substring(0, 200) + '...');
            
            // Log which patterns were found
            foundPatterns.forEach(pattern => {
                const match = response.match(pattern);
                if (match) {
                    console.log('  → Found pattern:', match[0]);
                }
            });
            
            // Suggest if this should have been routed differently
            const intent = this.analyzeMessageIntent(originalMessage);
            if (intent.type !== 'general_chat') {
                console.log('💡 [SUGGESTION] This might have been better handled as:', intent.type);
            }
        } else {
            console.log('✅ [CLAUDE ANALYSIS] Response appears natural and conversational');
        }
    }
    
    /**
     * Stop the bot
     */
    stop() {
        console.log('[Bot] Stopping GymBuddy Telegram Bot...');
        this.bot.stopPolling();
        
        // Close HTTP server if it exists
        if (this.server) {
            this.server.close(() => {
                console.log('[Bot] HTTP server stopped');
            });
        }
    }
}

// Export for use as module
module.exports = GymBuddyTelegramBot;

// If running directly, start the bot
if (require.main === module) {
    const bot = new GymBuddyTelegramBot();
    bot.start();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n[Bot] Received SIGINT, shutting down gracefully...');
        bot.stop();
        process.exit(0);
    });
}