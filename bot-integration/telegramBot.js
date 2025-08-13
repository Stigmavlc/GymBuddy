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
const PartnerCoordinationBot = require('./partner_coordination_bot');
const http = require('http');

class GymBuddyTelegramBot {
    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '8255853885:AAFlGskAj77voLkFCtMFEXlewBnusB4gzkQ';
        this.claudeAPIKey = process.env.ANTHROPIC_API_KEY;
        this.debugMode = process.env.BOT_DEBUG_MODE === 'true';
        
        // Initialize services
        this.bot = new TelegramBot(this.botToken, { polling: true });
        this.apiService = new GymBuddyAPIService();
        this.partnerBot = new PartnerCoordinationBot(this.bot, this.apiService, this.debugMode);
        
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
                partner_coordination: 0,
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

        // Handle callback queries (for partner coordination buttons)
        this.bot.on('callback_query', async (callbackQuery) => {
            try {
                const handled = await this.partnerBot.handleCallbackQuery(callbackQuery);
                if (!handled) {
                    // Handle other callback queries here if needed
                    console.log('[Bot] Unhandled callback query:', callbackQuery.data);
                }
            } catch (error) {
                console.error('[Bot Error] Callback query handling failed:', error);
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
     * Handle /debug command - Comprehensive diagnostics and manual testing
     */
    async handleDebugCommand(msg) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        const args = msg.text.split(' ').slice(1); // Get command arguments
        
        try {
            // Parse debug command type
            const debugType = args[0] || 'stats';
            
            switch (debugType.toLowerCase()) {
                case 'stats':
                case 'flow':
                    await this.showConversationFlowStats(chatId);
                    break;
                    
                case 'sync':
                    await this.runSyncDiagnostics(chatId, telegramId);
                    break;
                    
                case 'data':
                    await this.runDataIntegrityCheck(chatId, telegramId);
                    break;
                    
                case 'intent':
                    const testMessage = args.slice(1).join(' ');
                    await this.testIntentDetection(chatId, testMessage);
                    break;
                    
                case 'claude':
                    await this.testClaudeContextIntegration(chatId, telegramId);
                    break;
                    
                case 'api':
                    await this.testAPIConnectivity(chatId, telegramId);
                    break;
                    
                case 'help':
                default:
                    await this.showDebugHelp(chatId);
                    break;
            }
            
        } catch (error) {
            console.error('[Bot Error] Debug command failed:', error);
            await this.sendErrorMessage(chatId, `Debug command failed: ${error.message}`);
        }
    }

    /**
     * Show conversation flow statistics
     */
    async showConversationFlowStats(chatId) {
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
• Partner coordination: ${stats.intentRouting.partner_coordination}
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
    }

    /**
     * Run comprehensive sync diagnostics
     */
    async runSyncDiagnostics(chatId, telegramId) {
        await this.bot.sendMessage(chatId, '🔄 Running sync diagnostics...');
        
        const syncResults = await this.apiService.verifySyncStatus(telegramId);
        
        let resultMessage = `🔍 **Sync Diagnostics Results**\n\n`;
        resultMessage += `**Sync Test ID:** ${syncResults.syncTestId}\n`;
        resultMessage += `**Overall Status:** ${syncResults.overall?.success ? '✅ PASS' : '❌ FAIL'}\n\n`;
        
        if (syncResults.tests) {
            resultMessage += `**Test Results:**\n`;
            
            // API Connectivity
            const apiTest = syncResults.tests.apiConnectivity;
            resultMessage += `• API Connection: ${apiTest?.success ? '✅' : '❌'} (${apiTest?.duration || 0}ms)\n`;
            
            // User Lookup  
            const userTest = syncResults.tests.userLookup;
            resultMessage += `• User Lookup: ${userTest?.success ? '✅' : '❌'} (${userTest?.duration || 0}ms)\n`;
            if (userTest?.userName) resultMessage += `  Found: ${userTest.userName} (${userTest.userEmail})\n`;
            
            // Availability Access
            const availTest = syncResults.tests.availabilityAccess;
            resultMessage += `• Availability Access: ${availTest?.success ? '✅' : '❌'} (${availTest?.duration || 0}ms)\n`;
            resultMessage += `  Slots Found: ${availTest?.slotsFound || 0}\n`;
            
            // Data Freshness
            const freshTest = syncResults.tests.dataFreshness;
            resultMessage += `• Data Freshness: ${freshTest?.success ? '✅' : '❌'} (${freshTest?.duration || 0}ms)\n`;
            resultMessage += `  Data Consistent: ${freshTest?.dataConsistent ? '✅' : '❌'}\n`;
        }
        
        if (syncResults.overall?.issues && syncResults.overall.issues.length > 0) {
            resultMessage += `\n**Issues Found:**\n`;
            syncResults.overall.issues.forEach(issue => {
                resultMessage += `• ${issue}\n`;
            });
        }
        
        resultMessage += `\n**Duration:** ${syncResults.overall?.totalDuration || 0}ms`;
        
        await this.bot.sendMessage(chatId, resultMessage);
    }

    /**
     * Run data integrity check
     */
    async runDataIntegrityCheck(chatId, telegramId) {
        await this.bot.sendMessage(chatId, '🔍 Running data integrity check...');
        
        const integrityResults = await this.apiService.performDataIntegrityCheck(telegramId);
        
        let resultMessage = `🧪 **Data Integrity Check Results**\n\n`;
        resultMessage += `**Check ID:** ${integrityResults.checkId}\n\n`;
        
        if (integrityResults.checks) {
            // Data Structure Validation
            const structCheck = integrityResults.checks.dataStructure;
            if (structCheck) {
                resultMessage += `**Data Structure:** ${structCheck.isValid ? '✅ Valid' : '❌ Invalid'}\n`;
                if (structCheck.summary) {
                    resultMessage += `• Total Slots: ${structCheck.summary.length}\n`;
                    resultMessage += `• Valid Slots: ${structCheck.summary.validSlots}\n`;
                    resultMessage += `• Invalid Slots: ${structCheck.summary.invalidSlots}\n`;
                }
                if (structCheck.issues && structCheck.issues.length > 0) {
                    resultMessage += `• Issues: ${structCheck.issues.join(', ')}\n`;
                }
            }
            
            // API Comparison
            const apiCheck = integrityResults.checks.directApiComparison;
            if (apiCheck) {
                resultMessage += `\n**API Comparison:** ${apiCheck.dataMatches ? '✅ Match' : '❌ Mismatch'}\n`;
                resultMessage += `• Processed Slots: ${apiCheck.processedSlots}\n`;
                resultMessage += `• Raw API Slots: ${apiCheck.rawSlots}\n`;
            }
        }
        
        if (integrityResults.recommendations && integrityResults.recommendations.length > 0) {
            resultMessage += `\n**Recommendations:**\n`;
            integrityResults.recommendations.forEach(rec => {
                resultMessage += `• ${rec}\n`;
            });
        }
        
        await this.bot.sendMessage(chatId, resultMessage);
    }

    /**
     * Test intent detection with a specific message
     */
    async testIntentDetection(chatId, testMessage) {
        if (!testMessage || testMessage.trim().length === 0) {
            await this.bot.sendMessage(chatId, 
                '🧪 **Intent Detection Test**\n\n' +
                'Usage: `/debug intent your message here`\n\n' +
                'Examples:\n' +
                '• `/debug intent Set me available Monday 9am`\n' +
                '• `/debug intent What\'s my availability?`\n' +
                '• `/debug intent Clear my schedule`'
            );
            return;
        }
        
        const analysisStart = Date.now();
        
        // Get current availability for context
        const telegramId = chatId; // Using chatId as fallback
        const availability = await this.apiService.getUserAvailability(telegramId);
        
        // Analyze intent with diagnostics
        const intent = this.analyzeMessageIntent(testMessage, availability);
        const analysisDuration = Date.now() - analysisStart;
        
        let resultMessage = `🧪 **Intent Detection Test**\n\n`;
        resultMessage += `**Test Message:** "${testMessage}"\n`;
        resultMessage += `**Detected Intent:** ${intent.type}\n`;
        resultMessage += `**Confidence:** ${intent.confidence}\n`;
        resultMessage += `**Analysis Time:** ${analysisDuration}ms\n`;
        resultMessage += `**Availability Context:** ${availability.length} slots\n\n`;
        
        // Show routing decision
        switch (intent.type) {
            case 'availability_update':
                resultMessage += `**Routing:** → Direct Processing (Availability Update)\n`;
                resultMessage += `**Handler:** handleAvailabilityUpdate()`;
                break;
            case 'availability_query':
                resultMessage += `**Routing:** → Direct Processing (Availability Query)\n`;
                resultMessage += `**Handler:** handleAvailabilityQuery()`;
                break;
            case 'availability_clear':
                resultMessage += `**Routing:** → Direct Processing (Availability Clear)\n`;
                resultMessage += `**Handler:** handleAvailabilityClear()`;
                break;
            case 'session_deletion':
                resultMessage += `**Routing:** → Direct Processing (Session Deletion)\n`;
                resultMessage += `**Handler:** handleSessionDeletion()`;
                break;
            case 'partner_coordination':
                resultMessage += `**Routing:** → Direct Processing (Partner Coordination)\n`;
                resultMessage += `**Handler:** partnerBot.processCoordinationRequest()`;
                break;
            case 'general_chat':
                resultMessage += `**Routing:** → Claude AI Processing\n`;
                resultMessage += `**Handler:** Claude AI with fitness/gym context`;
                break;
        }
        
        await this.bot.sendMessage(chatId, resultMessage);
    }

    /**
     * Test API connectivity and response times
     */
    async testAPIConnectivity(chatId, telegramId) {
        await this.bot.sendMessage(chatId, '🌐 Testing API connectivity...');
        
        const tests = [];
        
        try {
            // Test 1: Basic connectivity
            const connectStart = Date.now();
            const healthResult = await this.apiService.makeAPIRequest('/health');
            tests.push({
                name: 'Health Check',
                success: healthResult.success,
                duration: Date.now() - connectStart,
                error: healthResult.error
            });
            
            // Test 2: User lookup
            const userStart = Date.now();
            const userResult = await this.apiService.getUserByTelegramId(telegramId);
            tests.push({
                name: 'User Lookup',
                success: !!userResult,
                duration: Date.now() - userStart,
                details: userResult ? `Found: ${userResult.name}` : 'User not found'
            });
            
            // Test 3: Availability fetch
            const availStart = Date.now();
            const availResult = await this.apiService.getUserAvailability(telegramId);
            tests.push({
                name: 'Availability Fetch',
                success: Array.isArray(availResult),
                duration: Date.now() - availStart,
                details: `${availResult?.length || 0} slots found`
            });
            
        } catch (error) {
            tests.push({
                name: 'API Test',
                success: false,
                error: error.message,
                duration: 0
            });
        }
        
        // Format results
        let resultMessage = `🌐 **API Connectivity Test Results**\n\n`;
        
        tests.forEach(test => {
            const status = test.success ? '✅' : '❌';
            resultMessage += `**${test.name}:** ${status} (${test.duration}ms)\n`;
            if (test.details) resultMessage += `  ${test.details}\n`;
            if (test.error) resultMessage += `  Error: ${test.error}\n`;
            resultMessage += '\n';
        });
        
        const avgDuration = tests.reduce((sum, test) => sum + test.duration, 0) / tests.length;
        const successRate = (tests.filter(test => test.success).length / tests.length * 100).toFixed(1);
        
        resultMessage += `**Summary:**\n`;
        resultMessage += `• Success Rate: ${successRate}%\n`;
        resultMessage += `• Average Response Time: ${avgDuration.toFixed(1)}ms\n`;
        
        await this.bot.sendMessage(chatId, resultMessage);
    }

    /**
     * Show debug help menu
     */
    async showDebugHelp(chatId) {
        const helpMessage = `
🐛 **Debug Command Help**

Available debug commands:

🔹 \`/debug\` or \`/debug stats\`
   Show conversation flow statistics

🔹 \`/debug sync\`
   Run comprehensive sync diagnostics

🔹 \`/debug data\`
   Perform data integrity checks

🔹 \`/debug intent <message>\`
   Test intent detection on a specific message

🔹 \`/debug api\`
   Test API connectivity and response times

🔹 \`/debug help\`
   Show this help menu

**Examples:**
• \`/debug intent What's my schedule?\`
• \`/debug sync\`
• \`/debug data\`

💡 **Tip:** Enable debug mode with environment variable \`BOT_DEBUG_MODE=true\` for detailed logs.
        `;
        
        await this.bot.sendMessage(chatId, helpMessage);
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
     * Test Claude AI context integration
     */
    async testClaudeContextIntegration(chatId, telegramId) {
        try {
            await this.bot.sendMessage(chatId, '🧠 Testing Claude AI Context Integration...');
            
            // Get user data for context testing
            const user = await this.apiService.getUserByTelegramId(telegramId);
            if (!user.success) {
                await this.bot.sendMessage(chatId, '❌ Need to be registered to test Claude context.');
                return;
            }
            
            // Get context data
            const availability = await this.apiService.getUserAvailability(telegramId);
            let partnerStatus = null;
            try {
                partnerStatus = await this.apiService.getPartnerStatus(user.email);
            } catch (error) {
                console.log('Partner status unavailable for testing');
            }
            
            const availabilityContext = availability && availability.length > 0 
                ? availability.map(slot => 
                    `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)}: ${slot.start_time}:00-${slot.end_time}:00`
                ).join(', ')
                : 'No availability set yet';
                
            const partnerContext = partnerStatus?.success 
                ? {
                    relationshipStatus: partnerStatus.relationshipStatus,
                    partnerName: partnerStatus.partner?.name || null,
                    hasPendingRequests: partnerStatus.pendingRequests?.length > 0 || false
                }
                : { relationshipStatus: 'unknown', partnerName: null, hasPendingRequests: false };
            
            // Test contextual intent with sample messages
            const testMessages = [
                'How does this work?',
                'Can you help me coordinate with my partner?',
                'What should I do next?',
                'I need some motivation'
            ];
            
            let testResults = '🧠 **Claude Context Integration Test Results**\n\n';
            testResults += `👤 **User Context:**\n`;
            testResults += `• Name: ${user.name}\n`;
            testResults += `• Availability: ${availabilityContext}\n`;
            testResults += `• Partner: ${partnerContext.relationshipStatus}${partnerContext.partnerName ? ` (${partnerContext.partnerName})` : ''}\n`;
            testResults += `• Pending requests: ${partnerContext.hasPendingRequests ? 'Yes' : 'No'}\n\n`;
            
            testResults += `🎯 **Contextual Intent Analysis:**\n`;
            
            for (const testMessage of testMessages) {
                const contextualIntent = this.analyzeMessageIntentWithContext(testMessage, {
                    availability: availability,
                    partnerStatus: partnerContext,
                    previousContext: this.userContexts.get(telegramId),
                    user: user
                });
                
                testResults += `• "${testMessage}"\n`;
                testResults += `  → Intent: ${contextualIntent.type}\n`;
                testResults += `  → Context: ${contextualIntent.contextFactors || 'none'}\n`;
                if (contextualIntent.override) {
                    testResults += `  → Override: ${contextualIntent.originalIntent} → ${contextualIntent.type}\n`;
                }
                testResults += '\n';
            }
            
            testResults += `🔧 **Claude Configuration:**\n`;
            testResults += `• API Key: ${this.claudeAPIKey ? 'Configured ✅' : 'Missing ❌'}\n`;
            testResults += `• Context enhancement: Enabled ✅\n`;
            testResults += `• Intelligent fallbacks: Enabled ✅\n`;
            testResults += `• Response enhancement: Enabled ✅\n`;
            
            await this.bot.sendMessage(chatId, testResults);
            
        } catch (error) {
            console.error('[Bot Error] Claude test failed:', error);
            await this.sendErrorMessage(chatId, 'Failed to test Claude integration. Please try again.');
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
            
            // Get partner status for enhanced context
            let partnerStatus = null;
            try {
                partnerStatus = await this.apiService.getPartnerStatus(user.email);
                this.debugLog('Partner status:', partnerStatus);
            } catch (error) {
                console.warn('[Bot Warning] Failed to get partner status:', error.message);
                this.debugLog('Partner status fetch failed, using defaults');
            }
            
            // Store enhanced context for potential follow-up actions
            this.userContexts.set(telegramId, {
                lastAvailability: availability,
                lastMessage: messageText,
                partnerStatus: partnerStatus,
                timestamp: Date.now(),
                conversationTurn: (this.userContexts.get(telegramId)?.conversationTurn || 0) + 1
            });
            
            // Prepare context for Claude
            const availabilityContext = availability && availability.length > 0 
                ? availability.map(slot => 
                    `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)}: ${slot.start_time}:00-${slot.end_time}:00`
                ).join(', ')
                : 'No availability set yet';
                
            // Enhanced partner context
            const partnerContext = partnerStatus?.success 
                ? {
                    relationshipStatus: partnerStatus.relationshipStatus,
                    partnerName: partnerStatus.partner?.name || null,
                    hasPendingRequests: partnerStatus.pendingRequests?.length > 0 || false
                }
                : { relationshipStatus: 'unknown', partnerName: null, hasPendingRequests: false };

            this.debugLog('Availability context:', availabilityContext);
            
            // Enhanced message routing with context awareness
            const contextualIntent = this.analyzeMessageIntentWithContext(messageText, {
                availability: availability,
                partnerStatus: partnerContext,
                previousContext: this.userContexts.get(telegramId),
                user: user
            });
            this.debugLog('Contextual intent analysis:', contextualIntent);
            
            // Route message based on contextual intent analysis
            this.conversationTracker.intentRouting[contextualIntent.type]++;
            
            console.log(`[ROUTING] Intent: ${contextualIntent.type} (confidence: ${contextualIntent.confidence}, context: ${contextualIntent.contextFactors || 'none'})`);
            this.debugLog('Contextual intent routing decision:', {
                detected_intent: contextualIntent.type,
                confidence: contextualIntent.confidence,
                context_factors: contextualIntent.contextFactors,
                will_use_claude: contextualIntent.type === 'general_chat',
                routing_count: this.conversationTracker.intentRouting[contextualIntent.type]
            });
            
            switch (contextualIntent.type) {
                case 'availability_update':
                    this.conversationTracker.directProcessing++;
                    console.log('[ROUTING] → Direct processing: Availability Update');
                    await this.handleAvailabilityUpdate(msg, user, messageText);
                    return;
                    
                case 'partner_coordination':
                    this.conversationTracker.directProcessing++;
                    console.log('[ROUTING] → Direct processing: Partner Coordination');
                    await this.partnerBot.processCoordinationRequest(msg);
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
                system: `You are GymBuddy, an intelligent fitness companion that's part of a comprehensive gym coordination system! 💪

ABOUT GYMBUDDY:
You're integrated into a smart system that helps gym partners coordinate their workouts automatically. The system can:
- Track user availability schedules
- Match partners with overlapping free time
- Schedule joint workout sessions
- Send notifications and reminders
- Provide workout analytics and progress tracking
- Award achievement badges for consistency

YOUR ROLE:
You handle general fitness conversations, motivation, and advice. You're aware of what the system can do, but you focus on being a supportive workout buddy rather than a technical assistant.

CURRENT USER CONTEXT:
- User: ${user.name}
- Current availability: ${availabilityContext}
- Partner status: ${partnerContext.relationshipStatus}${partnerContext.partnerName ? ` (partnered with ${partnerContext.partnerName})` : ''}
- Pending requests: ${partnerContext.hasPendingRequests ? 'Yes - they have partner requests to handle' : 'None'}
- Conversation turn: ${this.userContexts.get(telegramId)?.conversationTurn || 1}
- Recent activity: They're chatting with you right now

PERSONALITY & APPROACH:
- Enthusiastic and knowledgeable about fitness
- Aware of the user's schedule and coordination needs
- Supportive friend who understands gym partnership dynamics
- Smart enough to reference their actual situation when relevant

RESPONSE GUIDELINES:
1. Be naturally conversational and fitness-focused
2. If they mention scheduling/availability, acknowledge the system handles that smartly
3. Reference their actual availability when it makes sense contextually
4. For technical requests, gently guide them to use direct commands
5. Stay positive and encouraging about their fitness journey

WHAT TO AVOID:
- Don't give step-by-step bot instructions
- Don't be overly technical about system features
- Don't promise functionality you can't deliver
- Don't ignore their actual situation/context

SMART RESPONSES EXAMPLES:
"How's my schedule?" → "Looking at your availability, you've got some good workout windows set up! ${availabilityContext !== 'No availability set yet' ? 'Your current slots look solid for consistency.' : 'Might be worth setting some regular times when you can stay consistent.'}"
"I need motivation" → "You've got this! ${availabilityContext !== 'No availability set yet' ? 'I see you\'ve planned out your workout times - that\'s already showing commitment!' : 'The hardest part is just getting started.'} What's your main goal right now?"
"Should I work out today?" → "Absolutely! ${partnerContext.relationshipStatus === 'has_partner' ? `Plus if ${partnerContext.partnerName} is available too, you could coordinate something together.` : 'Even a solo session counts!'}"

CONTEXTUAL GUIDANCE:
- If they have pending partner requests, gently mention they might want to check those
- If they have a partner but no availability set, suggest setting up regular times for coordination
- If they seem frustrated with scheduling, acknowledge the system can help automate that
- For workout advice, be specific and actionable rather than generic
- Reference their actual situation (availability, partner status) naturally in conversation`,
                messages: [{
                    role: "user",
                    content: `User: ${user.name} (Telegram ID: ${telegramId})
Current message: "${messageText}"

CONTEXT DETAILS:
- Availability schedule: ${availabilityContext}
- Partnership: ${partnerContext.relationshipStatus}${partnerContext.partnerName ? ` with ${partnerContext.partnerName}` : ''}
- Pending actions: ${partnerContext.hasPendingRequests ? 'Has partner requests to review' : 'None'}
- Conversation turn: #${this.userContexts.get(telegramId)?.conversationTurn || 1}
${this.userContexts.get(telegramId)?.lastMessage && this.userContexts.get(telegramId)?.lastMessage !== messageText ? `- Previous message: "${this.userContexts.get(telegramId)?.lastMessage}"` : ''}

Respond naturally as their supportive gym buddy. Reference their actual situation contextually when it makes sense, but keep the focus on fitness motivation and advice.`
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
                
                // Enhance Claude response with actionable suggestions if context suggests they need guidance
                let finalResponse = claudeResponse.message;
                
                if (contextualIntent.contextFactors) {
                    finalResponse = await this.enhanceClaudeResponseWithContext(
                        claudeResponse.message, 
                        contextualIntent, 
                        partnerContext, 
                        availabilityContext
                    );
                }
                
                await this.bot.sendMessage(chatId, finalResponse);
                
                // If Claude's response seems generic and user has specific context, offer additional help
                if (this.shouldOfferAdditionalGuidance(claudeResponse.message, contextualIntent, partnerContext)) {
                    setTimeout(async () => {
                        await this.sendContextualGuidance(chatId, contextualIntent, partnerContext, availabilityContext);
                    }, 1500); // Small delay to let Claude's response be read first
                }
                
            } else {
                console.error('[Bot Error] Claude API failed:', claudeResponse.error);
                
                // Intelligent fallback based on context
                const fallbackResponse = await this.generateIntelligentFallback(
                    messageText, 
                    contextualIntent, 
                    partnerContext, 
                    availabilityContext,
                    user
                );
                
                await this.bot.sendMessage(chatId, fallbackResponse);
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
     * Analyze message intent with enhanced classification, context awareness, and comprehensive diagnostics
     */
    analyzeMessageIntent(messageText, currentAvailability = null) {
        const intentAnalysisStart = Date.now();
        const text = messageText.toLowerCase().trim();
        
        // Initialize detailed diagnostics
        const diagnostics = {
            originalMessage: messageText,
            normalizedText: text,
            textLength: text.length,
            hasAvailabilityContext: !!(currentAvailability && currentAvailability.length > 0),
            availabilitySlotCount: currentAvailability ? currentAvailability.length : 0,
            analysisSteps: []
        };

        this.debugLog('🔍 INTENT ANALYSIS START', diagnostics);

        // CHECK FOR SESSION DELETION INTENT FIRST (highest priority)
        const sessionDeletionIntent = this.detectSessionDeletionIntent(text);
        diagnostics.analysisSteps.push({
            step: 1,
            check: 'session_deletion',
            detected: sessionDeletionIntent.detected,
            confidence: sessionDeletionIntent.confidence
        });
        
        if (sessionDeletionIntent.detected) {
            diagnostics.finalIntent = { type: 'session_deletion', confidence: sessionDeletionIntent.confidence };
            diagnostics.duration = Date.now() - intentAnalysisStart;
            this.debugLog('✅ INTENT DETECTED: session_deletion', diagnostics);
            return { type: 'session_deletion', confidence: sessionDeletionIntent.confidence };
        }
        
        // Check for contextual clearing intent (e.g., "clear this", "remove it")
        const contextualClearKeywords = [
            'clear this', 'clear it', 'delete this', 'delete it',
            'remove this', 'remove it', 'cancel this', 'cancel it',
            'cancel all', 'clear all'
        ];
        
        const clearKeywords = [
            'clear my availability', 'clear availability', 'delete my availability',
            'remove my availability', 'cancel my availability', 'reset my schedule'
        ];
        
        const contextualClearFound = contextualClearKeywords.find(keyword => text.includes(keyword));
        const explicitClearFound = clearKeywords.find(keyword => text.includes(keyword));
        
        diagnostics.analysisSteps.push({
            step: 2,
            check: 'availability_clear',
            contextualClearFound,
            explicitClearFound,
            hasAvailabilityForContext: !!(currentAvailability && currentAvailability.length > 0)
        });
        
        // Contextual clear with availability context
        if (contextualClearFound && currentAvailability && currentAvailability.length > 0) {
            diagnostics.finalIntent = { type: 'availability_clear', confidence: 'high' };
            diagnostics.duration = Date.now() - intentAnalysisStart;
            this.debugLog('✅ INTENT DETECTED: availability_clear (contextual)', diagnostics);
            return { type: 'availability_clear', confidence: 'high' };
        }
        
        // Explicit clear intent
        if (explicitClearFound) {
            diagnostics.finalIntent = { type: 'availability_clear', confidence: 'high' };
            diagnostics.duration = Date.now() - intentAnalysisStart;
            this.debugLog('✅ INTENT DETECTED: availability_clear (explicit)', diagnostics);
            return { type: 'availability_clear', confidence: 'high' };
        }
        
        // Check for availability update intent FIRST (before query check)
        const updateDetectionStart = Date.now();
        const isAvailabilityUpdate = this.detectAvailabilityUpdateIntent(text);
        const updateDetectionDuration = Date.now() - updateDetectionStart;
        
        diagnostics.analysisSteps.push({
            step: 3,
            check: 'availability_update',
            detected: isAvailabilityUpdate,
            detectionDuration: updateDetectionDuration
        });
        
        if (isAvailabilityUpdate) {
            diagnostics.finalIntent = { type: 'availability_update', confidence: 'high' };
            diagnostics.duration = Date.now() - intentAnalysisStart;
            this.debugLog('✅ INTENT DETECTED: availability_update', diagnostics);
            return { type: 'availability_update', confidence: 'high' };
        }
        
        // Check for partner coordination intent
        const partnerDetectionStart = Date.now();
        const shouldHandlePartner = this.partnerBot.shouldHandleMessage(text);
        const partnerDetectionDuration = Date.now() - partnerDetectionStart;
        
        diagnostics.analysisSteps.push({
            step: 4,
            check: 'partner_coordination',
            detected: shouldHandlePartner,
            detectionDuration: partnerDetectionDuration
        });
        
        if (shouldHandlePartner) {
            diagnostics.finalIntent = { type: 'partner_coordination', confidence: 'high' };
            diagnostics.duration = Date.now() - intentAnalysisStart;
            this.debugLog('✅ INTENT DETECTED: partner_coordination', diagnostics);
            return { type: 'partner_coordination', confidence: 'high' };
        }
        
        // Check for availability query intent (after update check to avoid conflicts)
        const queryKeywords = [
            'what\'s my availability', 'whats my availability',
            'show my availability', 'my schedule', 'when am i available',
            'what\'s my schedule', 'whats my schedule',
            'check my availability', 'view my availability', 'see my availability',
            // Enhanced keywords to capture more natural queries
            'give me my availability', 'tell me my availability',
            'exact dates', 'exact times', 'exact dates and times',
            'give me the exact', 'tell me the exact',
            'when am i free', 'when can i work out',
            'my available times', 'my free times',
            'available this week', 'free this week',
            'show me when', 'tell me when',
            'list my availability', 'display my schedule'
        ];
        
        const queryKeywordFound = queryKeywords.find(keyword => text.includes(keyword));
        
        diagnostics.analysisSteps.push({
            step: 5,
            check: 'availability_query',
            keywordFound: queryKeywordFound,
            allKeywords: queryKeywords.length
        });
        
        if (queryKeywordFound) {
            diagnostics.finalIntent = { type: 'availability_query', confidence: 'high' };
            diagnostics.duration = Date.now() - intentAnalysisStart;
            this.debugLog('✅ INTENT DETECTED: availability_query', diagnostics);
            return { type: 'availability_query', confidence: 'high' };
        }
        
        // Default to general chat - log comprehensive analysis
        diagnostics.finalIntent = { type: 'general_chat', confidence: 'medium' };
        diagnostics.duration = Date.now() - intentAnalysisStart;
        diagnostics.analysisSteps.push({
            step: 6,
            check: 'final_fallback',
            result: 'general_chat'
        });
        
        // Log why this went to general chat instead of specific intents
        this.debugLog('⚠️  INTENT FALLBACK: general_chat', diagnostics);
        console.log(`[INTENT WARNING] Message "${messageText}" fell back to general_chat - review intent patterns`);
        
        return { type: 'general_chat', confidence: 'medium' };
    }
    
    /**
     * Enhanced intent analysis with conversation context and user state awareness
     */
    analyzeMessageIntentWithContext(messageText, context) {
        const startTime = Date.now();
        this.debugLog('🧠 CONTEXTUAL INTENT ANALYSIS START', {
            message: messageText,
            hasAvailability: context.availability?.length > 0,
            partnerStatus: context.partnerStatus?.relationshipStatus,
            previousTurns: context.previousContext?.conversationTurn || 0
        });
        
        // First run basic intent analysis
        const basicIntent = this.analyzeMessageIntent(messageText, context.availability);
        
        // Context factors that might influence routing
        const contextFactors = [];
        
        // Enhanced routing based on conversation context
        if (basicIntent.type === 'general_chat') {
            
            // Check if user is asking about functionality they can actually use
            const functionalityQuestions = [
                /how do(es)? .*work/i,
                /what can .*do/i,
                /how to.*(schedule|coordinate|partner|session)/i,
                /help me.*(schedule|find|coordinate)/i,
                /can you.*(schedule|coordinate|find)/i
            ];
            
            const askingAboutFunctionality = functionalityQuestions.some(pattern => 
                pattern.test(messageText.toLowerCase())
            );
            
            if (askingAboutFunctionality) {
                contextFactors.push('functionality_inquiry');
                
                // If they're asking about coordination and have a partner, route to partner coordination
                if (context.partnerStatus?.relationshipStatus === 'has_partner' && 
                    /coordinate|partner|session/i.test(messageText)) {
                    contextFactors.push('has_partner_coordination_inquiry');
                    this.debugLog('✅ CONTEXTUAL OVERRIDE: general_chat → partner_coordination (functionality inquiry with partner)');
                    return {
                        type: 'partner_coordination',
                        confidence: 'high',
                        contextFactors: contextFactors.join(', '),
                        originalIntent: basicIntent.type,
                        override: true
                    };
                }
                
                // If asking about availability features, but framed as a question
                if (/availability|schedule|time/i.test(messageText) && /\?/.test(messageText)) {
                    contextFactors.push('availability_inquiry');
                    this.debugLog('✅ CONTEXTUAL OVERRIDE: general_chat → availability_query (functionality inquiry)');
                    return {
                        type: 'availability_query',
                        confidence: 'medium',
                        contextFactors: contextFactors.join(', '),
                        originalIntent: basicIntent.type,
                        override: true
                    };
                }
            }
            
            // Check for follow-up context (if they just updated something)
            if (context.previousContext?.lastMessage) {
                const timeSinceLastMessage = Date.now() - context.previousContext.timestamp;
                const recentInteraction = timeSinceLastMessage < 300000; // 5 minutes
                
                if (recentInteraction) {
                    contextFactors.push('recent_interaction');
                    
                    // If they just updated availability and now asking vague questions, help them with next steps
                    if (/thanks|great|good|ok|nice/.test(messageText.toLowerCase()) && 
                        context.previousContext.lastMessage?.includes('availability')) {
                        contextFactors.push('post_availability_acknowledgment');
                        // Keep as general_chat but with awareness they just did something
                    }
                }
            }
            
            // Check if they have pending actions that might be relevant
            if (context.partnerStatus?.hasPendingRequests) {
                contextFactors.push('has_pending_requests');
                
                // If asking general questions but have pending requests, might want to guide them
                if (/what.*next|what.*do|help/i.test(messageText)) {
                    contextFactors.push('seeking_guidance_with_pending_requests');
                }
            }
        }
        
        // Enhance basic intent with context
        const enhancedIntent = {
            ...basicIntent,
            contextFactors: contextFactors.length > 0 ? contextFactors.join(', ') : null,
            analysisTime: Date.now() - startTime,
            contextConsidered: true
        };
        
        this.debugLog('🧠 CONTEXTUAL INTENT ANALYSIS COMPLETE', enhancedIntent);
        return enhancedIntent;
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
            console.log('[AVAILABILITY QUERY] Fetching fresh data for user:', user.name);
            const availability = await this.apiService.getUserAvailability(telegramId);
            
            if (!availability || availability.length === 0) {
                await this.bot.sendMessage(chatId, 
                    `📅 ${user.name}, you don't have any availability set yet. Just let me know when you're free to work out!`
                );
                return;
            }
            
            console.log('[AVAILABILITY SUCCESS] Found', availability.length, 'slots for', user.name);
            
            // Enhanced response with exact dates and comprehensive formatting
            let message = `📅 **${user.name}'s Exact Availability Schedule**\n\n`;
            
            // Get current week dates for context
            const today = new Date();
            const currentWeekStart = new Date(today);
            currentWeekStart.setDate(today.getDate() - today.getDay());
            
            // Group by day and format nicely with exact dates
            const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const groupedByDay = {};
            
            availability.forEach(slot => {
                if (!groupedByDay[slot.day]) {
                    groupedByDay[slot.day] = [];
                }
                groupedByDay[slot.day].push(slot);
            });
            
            let hasUpcomingSlots = false;
            
            dayOrder.forEach((day, index) => {
                if (groupedByDay[day]) {
                    hasUpcomingSlots = true;
                    const dayName = dayNames[index];
                    
                    // Calculate exact date for this week
                    const exactDate = new Date(currentWeekStart);
                    exactDate.setDate(currentWeekStart.getDate() + index + 1);
                    const dateStr = exactDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                    });
                    
                    message += `🗓️ **${dayName}, ${dateStr}:**\n`;
                    
                    // Sort slots by start time and format with enhanced detail
                    groupedByDay[day]
                        .sort((a, b) => a.start_time - b.start_time)
                        .forEach(slot => {
                            const startHour = slot.start_time;
                            const endHour = slot.end_time;
                            const duration = endHour - startHour;
                            
                            // Format time with AM/PM
                            const startFormatted = startHour <= 12 ? 
                                (startHour === 12 ? '12:00 PM' : `${startHour}:00 AM`) :
                                `${startHour - 12}:00 PM`;
                            const endFormatted = endHour <= 12 ? 
                                (endHour === 12 ? '12:00 PM' : `${endHour}:00 AM`) :
                                `${endHour - 12}:00 PM`;
                            
                            message += `   ⏰ ${startFormatted} - ${endFormatted} (${duration}h session)\n`;
                        });
                    message += '\n';
                }
            });
            
            if (hasUpcomingSlots) {
                message += `📊 **Summary:**\n`;
                message += `• Total availability slots: ${availability.length}\n`;
                message += `• Days available this week: ${Object.keys(groupedByDay).length}\n`;
                message += `• Total workout hours: ${availability.reduce((sum, slot) => sum + (slot.end_time - slot.start_time), 0)} hours\n\n`;
                message += `🔄 **Real-time sync:** This data is fresh from the server\n`;
                message += `📱 **Web sync:** All changes sync automatically with the website\n`;
                message += `💪 **Ready to coordinate:** I can help match you with gym partners!`;
            }
            
            await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
            
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
        
        this.debugLog('=== Session/Availability Deletion Processing Started ===');
        this.debugLog('Message:', messageText);
        this.debugLog('User:', user.name);
        this.debugLog('Telegram ID:', telegramId);
        
        try {
            // Parse the deletion request from natural language
            const deletionCriteria = this.parseAvailabilityDeletionRequest(messageText);
            console.log('[DELETION] Parsed criteria:', deletionCriteria);
            
            if (!deletionCriteria) {
                // If we can't parse the request, show current availability and ask for clarification
                console.log('[DELETION] Could not parse deletion criteria, showing current availability');
                const availability = await this.apiService.getUserAvailability(telegramId);
                
                if (!availability || availability.length === 0) {
                    await this.bot.sendMessage(chatId, 
                        `📅 ${user.name}, you don't have any availability slots to delete.`
                    );
                    return;
                }
                
                let message = `📅 **${user.name}, here's your current availability:**\n\n`;
                
                // Group by day for better display
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
                        message += `🗓️ **${dayName}:**\n`;
                        
                        groupedByDay[day]
                            .sort((a, b) => a.start_time - b.start_time)
                            .forEach((slot, index) => {
                                const startFormatted = slot.start_time <= 12 ? 
                                    (slot.start_time === 12 ? '12:00 PM' : `${slot.start_time}:00 AM`) :
                                    `${slot.start_time - 12}:00 PM`;
                                const endFormatted = slot.end_time <= 12 ? 
                                    (slot.end_time === 12 ? '12:00 PM' : `${slot.end_time}:00 AM`) :
                                    `${slot.end_time - 12}:00 PM`;
                                
                                message += `   ${index + 1}. ⏰ ${startFormatted} - ${endFormatted}\n`;
                            });
                        message += '\n';
                    }
                });
                
                message += `💡 **To delete specific slots, try:**\n`;
                message += `• "Delete Monday 6-9am"\n`;
                message += `• "Remove Tuesday morning slot"\n`;
                message += `• "Cancel Wednesday 14:00-16:00"\n`;
                message += `• "Clear all availability" (to delete everything)`;
                
                await this.bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
                return;
            }
            
            // Use the new deleteSpecificAvailability method
            console.log('[DELETION] Attempting to delete specific availability slots...');
            const deleteResult = await this.apiService.deleteSpecificAvailability(telegramId, deletionCriteria);
            
            if (deleteResult.success) {
                let successMessage = `✅ **Deletion Successful!**\n\n`;
                successMessage += `🗑️ Deleted ${deleteResult.deletedCount} availability slot(s):\n\n`;
                
                deleteResult.deletedSlots.forEach(slot => {
                    const dayName = slot.day.charAt(0).toUpperCase() + slot.day.slice(1);
                    const startFormatted = slot.start_time <= 12 ? 
                        (slot.start_time === 12 ? '12:00 PM' : `${slot.start_time}:00 AM`) :
                        `${slot.start_time - 12}:00 PM`;
                    const endFormatted = slot.end_time <= 12 ? 
                        (slot.end_time === 12 ? '12:00 PM' : `${slot.end_time}:00 AM`) :
                        `${slot.end_time - 12}:00 PM`;
                    
                    successMessage += `   ❌ ${dayName}: ${startFormatted} - ${endFormatted}\n`;
                });
                
                successMessage += `\n📊 **Remaining slots:** ${deleteResult.remainingCount}\n`;
                successMessage += `🔄 **Changes synced** with website automatically`;
                
                await this.bot.sendMessage(chatId, successMessage, { parse_mode: 'Markdown' });
                
                // If user has a partner, trigger coordination check
                console.log('[DELETION] Triggering partner coordination check...');
                await this.partnerBot.checkAndNotifyCoordination(telegramId, user.name);
                
            } else {
                let errorMessage = `❌ **Deletion Failed**\n\n`;
                
                if (deleteResult.error.includes('No availability slots found')) {
                    errorMessage += `📅 You don't have any availability slots to delete.`;
                } else if (deleteResult.error.includes('No slots match')) {
                    errorMessage += `🔍 **No matching slots found.**\n\n`;
                    errorMessage += `**What you asked for:**\n`;
                    if (deletionCriteria.day) errorMessage += `• Day: ${deletionCriteria.day.charAt(0).toUpperCase() + deletionCriteria.day.slice(1)}\n`;
                    if (deletionCriteria.startTime) errorMessage += `• Start time: ${deletionCriteria.startTime}:00\n`;
                    if (deletionCriteria.endTime) errorMessage += `• End time: ${deletionCriteria.endTime}:00\n`;
                    errorMessage += `\n💡 Try asking "What's my availability?" to see your current schedule.`;
                } else {
                    errorMessage += `⚠️ ${deleteResult.error}\n\nPlease try again or contact support if the issue persists.`;
                }
                
                await this.bot.sendMessage(chatId, errorMessage, { parse_mode: 'Markdown' });
            }
            
        } catch (error) {
            console.error('[Bot Error] Availability deletion failed:', error);
            await this.sendErrorMessage(chatId, 'Sorry, I had trouble processing your deletion request. Please try again.');
        }
    }
    
    /**
     * Parse availability deletion requests from natural language
     * Handles requests like "Delete the Monday session booked from 6-9am"
     */
    parseAvailabilityDeletionRequest(messageText) {
        const text = messageText.toLowerCase().trim();
        const criteria = {};
        
        console.log('[PARSE DELETION] Analyzing message:', text);
        
        // Extract day of week
        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        for (const day of days) {
            if (text.includes(day)) {
                criteria.day = day;
                break;
            }
        }
        
        // Extract time patterns
        // Pattern: 6-9am, 6-9, 14:00-16:00, 2pm-4pm, etc.
        const timePatterns = [
            // 6-9am, 6-9pm format
            /(\d{1,2})-(\d{1,2})\s*(am|pm)/i,
            // 6:00-9:00 format
            /(\d{1,2}):00-(\d{1,2}):00/i,
            // 14:00-16:00 format (24-hour)
            /(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/i,
            // Simple 6-9 format
            /(\d{1,2})-(\d{1,2})/
        ];
        
        for (const pattern of timePatterns) {
            const match = text.match(pattern);
            if (match) {
                let startTime = parseInt(match[1]);
                let endTime = parseInt(match[2]);
                
                // Handle AM/PM conversion
                if (match[3]) {
                    const ampm = match[3].toLowerCase();
                    if (ampm === 'pm' && startTime !== 12) startTime += 12;
                    if (ampm === 'pm' && endTime !== 12) endTime += 12;
                    if (ampm === 'am' && startTime === 12) startTime = 0;
                    if (ampm === 'am' && endTime === 12) endTime = 0;
                }
                
                criteria.startTime = startTime;
                criteria.endTime = endTime;
                break;
            }
        }
        
        // If we found at least one criteria, return it
        if (criteria.day || criteria.startTime !== undefined) {
            console.log('[PARSE DELETION] Successfully parsed criteria:', criteria);
            return criteria;
        }
        
        console.log('[PARSE DELETION] Could not parse deletion criteria from message');
        return null;
    }

    /**
     * Handle session choice when user replies with a number or natural language
     */
    async handleSessionChoice(msg, context, messageText) {
        const chatId = msg.chat.id;
        const telegramId = msg.from.id;
        
        this.debugLog('=== Session Choice Processing Started ===');
        this.debugLog('User message:', messageText);
        this.debugLog('Available sessions:', context.availableSessions);
        
        try {
            // FIRST: Try to parse natural language from the user's reply
            const parsedCriteria = this.parseSessionFromNaturalLanguage(messageText);
            this.debugLog('Parsed criteria from user reply:', parsedCriteria);
            
            if (parsedCriteria) {
                // Try to match against available sessions
                const matchResult = this.matchSessionToCriteria(parsedCriteria, context.availableSessions);
                this.debugLog('Match result for user reply:', matchResult);
                
                if (matchResult.exactMatches.length === 1) {
                    // Found exactly one match - delete it directly
                    const session = matchResult.exactMatches[0];
                    const dayName = session.day.charAt(0).toUpperCase() + session.day.slice(1);
                    
                    await this.bot.sendMessage(chatId, 
                        `🎯 Got it! Canceling ${dayName} ${session.start_time}:00-${session.end_time}:00...`
                    );
                    
                    const result = await this.apiService.deleteUserSession(telegramId, session.id);
                    
                    if (result.success) {
                        await this.bot.sendMessage(chatId, 
                            `✅ Session canceled successfully!\n\n🔄 Your website will update automatically.`
                        );
                    } else {
                        await this.sendErrorMessage(chatId, `Failed to cancel session: ${result.error}`);
                    }
                    return;
                } else if (matchResult.exactMatches.length > 1) {
                    // Multiple matches - show specific options
                    let message = `🔍 Found ${matchResult.exactMatches.length} sessions matching your description:\n\n`;
                    
                    matchResult.exactMatches.forEach((session, index) => {
                        const dayName = session.day.charAt(0).toUpperCase() + session.day.slice(1);
                        message += `${index + 1}. ${dayName} ${session.start_time}:00-${session.end_time}:00\n`;
                    });
                    
                    message += `\n❓ Which one? Reply with the number.`;
                    
                    await this.bot.sendMessage(chatId, message);
                    
                    // Update context with exact matches
                    this.userContexts.set(telegramId, {
                        ...context,
                        availableSessions: matchResult.exactMatches
                    });
                    return; // Keep waiting for selection
                }
                
                // If partial matches or no matches, fall through to numeric parsing
                this.debugLog('No exact match found, trying numeric parsing...');
            }
            
            // FALLBACK: Parse as numeric choice (original behavior)
            const choiceText = messageText.trim();
            const choiceNumber = parseInt(choiceText);
            
            this.debugLog('Parsed choice number:', choiceNumber);
            
            // Validate the choice
            if (isNaN(choiceNumber) || choiceNumber < 1 || choiceNumber > context.availableSessions.length) {
                await this.bot.sendMessage(chatId, 
                    `❌ Please enter a valid number between 1 and ${context.availableSessions.length}, or describe the session (e.g., "Monday 7-9").`
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

                // PARTNER COORDINATION: Check if this triggers coordination
                try {
                    this.debugLog('Checking for partner coordination trigger...');
                    const userEmail = await this.getUserEmail(msg.from.id);
                    if (userEmail) {
                        const coordinationTriggered = await this.partnerBot.checkForCoordinationTrigger(userEmail);
                        if (coordinationTriggered) {
                            console.log(`[PartnerBot] Coordination workflow triggered for ${userEmail}`);
                        } else {
                            this.debugLog('No coordination trigger - partner may not have availability yet');
                        }
                    } else {
                        this.debugLog('No user email found for coordination check');
                    }
                } catch (partnerError) {
                    console.error('[PartnerBot] Error checking coordination trigger:', partnerError);
                    // Don't fail the availability update if partner coordination fails
                }
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
     * Parse session criteria from natural language text
     * Similar to parseAvailabilityFromText but returns criteria for matching existing sessions
     */
    parseSessionFromNaturalLanguage(text) {
        this.debugLog('Parsing session criteria from text:', text);
        
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
        
        // Find target day (optional - user might just say "7-9")
        let targetDay = null;
        for (const [key, day] of Object.entries(dayMap)) {
            const regex = new RegExp(`\\b${key}\\b`, 'i');
            if (regex.test(normalizedText)) {
                targetDay = day;
                break;
            }
        }
        
        // Handle relative references
        if (!targetDay) {
            const today = new Date();
            const dayOfWeek = today.getDay();
            
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
        
        // Parse time ranges (reuse existing patterns) - FIXED to include 'and'
        const timePatterns = [
            // "9 to 11am", "9-11am", "9 and 11am" (FIXED: added 'and')
            /(\d{1,2})\s*(?:to|-|until|and)\s*(\d{1,2})\s*(am|pm)/gi,
            // "9am to 11am", "9am-11am", "9am and 11am" (FIXED: added 'and')
            /(\d{1,2})\s*(am|pm)\s*(?:to|-|until|and)\s*(\d{1,2})\s*(am|pm)/gi,
            // "09:00 to 11:00", "9:00-11:00"
            /(\d{1,2}):(\d{2})\s*(?:to|-|until)\s*(\d{1,2}):(\d{2})/gi,
            // "from 9am to 11am"
            /from\s+(\d{1,2})\s*(am|pm)\s+to\s+(\d{1,2})\s*(am|pm)/gi,
            // "at 9am" - single time
            /at\s+(\d{1,2})\s*(am|pm)/gi,
            // "9am" - single time
            /\b(\d{1,2})\s*(am|pm)\b/gi,
            // "morning", "afternoon", "evening"
            /(morning|afternoon|evening)/gi
        ];
        
        let startTime = null;
        let endTime = null;
        
        for (const pattern of timePatterns) {
            pattern.lastIndex = 0;
            const timeMatch = pattern.exec(normalizedText);
            if (timeMatch) {
                this.debugLog('Time pattern matched:', timeMatch);
                
                if (timeMatch.length === 4 && timeMatch[3]) { // "9 to 11am"
                    startTime = this.parseTime(timeMatch[1], timeMatch[3]);
                    endTime = this.parseTime(timeMatch[2], timeMatch[3]);
                } else if (timeMatch.length === 5 && timeMatch[2] && timeMatch[4]) { // "9am to 11am"
                    startTime = this.parseTime(timeMatch[1], timeMatch[2]);
                    endTime = this.parseTime(timeMatch[3], timeMatch[4]);
                } else if (timeMatch.length === 5 && timeMatch[2] && timeMatch[4] && timeMatch[2] !== 'am' && timeMatch[2] !== 'pm') { // "09:00 to 11:00"
                    const potentialStartTime = parseInt(timeMatch[1]);
                    const potentialEndTime = parseInt(timeMatch[3]);
                    
                    if (potentialStartTime >= 0 && potentialStartTime <= 23 && 
                        potentialEndTime >= 1 && potentialEndTime <= 23 &&
                        potentialStartTime < potentialEndTime) {
                        startTime = potentialStartTime;
                        endTime = potentialEndTime;
                    }
                } else if (timeMatch.length === 3 && timeMatch[2] && (timeMatch[2] === 'am' || timeMatch[2] === 'pm')) { // "at 9am" or "9am"
                    startTime = this.parseTime(timeMatch[1], timeMatch[2]);
                    endTime = startTime + 2; // Assume 2-hour duration for single times
                    if (endTime > 23) endTime = 23;
                } else if (timeMatch.length === 4 && timeMatch[3] === undefined && timeMatch[2]) { // "7-9" without am/pm
                    const potentialStartTime = parseInt(timeMatch[1]);
                    const potentialEndTime = parseInt(timeMatch[2]);
                    
                    // Default to reasonable hours (6am-11pm range)
                    if (potentialStartTime >= 6 && potentialStartTime <= 23 && 
                        potentialEndTime >= 7 && potentialEndTime <= 23 &&
                        potentialStartTime < potentialEndTime) {
                        startTime = potentialStartTime;
                        endTime = potentialEndTime;
                    }
                } else if (timeMatch.length === 2) { // "morning", "afternoon", "evening"
                    const timeOfDay = timeMatch[1].toLowerCase();
                    switch (timeOfDay) {
                        case 'morning':
                            startTime = 9; endTime = 12; break;
                        case 'afternoon':
                            startTime = 14; endTime = 17; break;
                        case 'evening':
                            startTime = 18; endTime = 21; break;
                    }
                }
                
                if (startTime !== null && endTime !== null) {
                    break;
                }
            }
        }
        
        this.debugLog('Parsed session criteria:', { day: targetDay, startTime, endTime });
        
        // Return criteria object (day is optional, times are optional)
        if (targetDay || (startTime !== null && endTime !== null)) {
            return {
                day: targetDay,
                startTime: startTime,
                endTime: endTime
            };
        }
        
        return null; // No criteria found
    }
    
    /**
     * Match session criteria against actual user sessions
     * Returns exact matches and partial matches
     */
    matchSessionToCriteria(criteria, sessions) {
        this.debugLog('Matching criteria against sessions:', { criteria, sessionCount: sessions.length });
        
        if (!criteria || !sessions || sessions.length === 0) {
            return { exactMatches: [], partialMatches: [] };
        }
        
        const exactMatches = [];
        const partialMatches = [];
        
        sessions.forEach(session => {
            let dayMatch = false;
            let timeMatch = false;
            
            // Check day match
            if (!criteria.day) {
                dayMatch = true; // No day criteria means any day matches
            } else {
                dayMatch = session.day.toLowerCase() === criteria.day.toLowerCase();
            }
            
            // Check time match
            if (!criteria.startTime || !criteria.endTime) {
                timeMatch = true; // No time criteria means any time matches
            } else {
                // Exact time match
                if (session.start_time === criteria.startTime && session.end_time === criteria.endTime) {
                    timeMatch = true;
                } else {
                    // Allow some flexibility - if times overlap or are close
                    const sessionStart = session.start_time;
                    const sessionEnd = session.end_time;
                    const criteriaStart = criteria.startTime;
                    const criteriaEnd = criteria.endTime;
                    
                    // Check if there's significant overlap (at least 50% of either session)
                    const overlapStart = Math.max(sessionStart, criteriaStart);
                    const overlapEnd = Math.min(sessionEnd, criteriaEnd);
                    const overlapDuration = Math.max(0, overlapEnd - overlapStart);
                    
                    const sessionDuration = sessionEnd - sessionStart;
                    const criteriaDuration = criteriaEnd - criteriaStart;
                    
                    if (overlapDuration >= sessionDuration * 0.5 || overlapDuration >= criteriaDuration * 0.5) {
                        timeMatch = true;
                    }
                }
            }
            
            // Categorize matches
            if (dayMatch && timeMatch) {
                exactMatches.push(session);
            } else if (dayMatch || timeMatch) {
                partialMatches.push(session);
            }
        });
        
        const result = { exactMatches, partialMatches };
        this.debugLog('Match results:', {
            exactCount: exactMatches.length,
            partialCount: partialMatches.length
        });
        
        return result;
    }
    
    /**
     * Parse availability slots from natural language text
     */
    async parseAvailabilityFromText(text) {
        this.debugLog('=== ENHANCED TIME PARSING DEBUG ===');
        this.debugLog('Original input text:', text);
        this.debugLog('Text type:', typeof text);
        this.debugLog('Text length:', text.length);
        
        const slots = [];
        const normalizedText = text.toLowerCase().trim();
        this.debugLog('Normalized text:', normalizedText);
        this.debugLog('Normalized length:', normalizedText.length);
        
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
        
        // Enhanced time parsing with more patterns (FIXED to include 'and')
        const timePatterns = [
            // "9 to 11am", "9-11am", "09 to 11am", "9 and 11am" (FIXED: added 'and')
            /(\d{1,2})\s*(?:to|-|until|and)\s*(\d{1,2})\s*(am|pm)/gi,
            // "9am to 11am", "9am-11am", "9am and 11am" (FIXED: added 'and')
            /(\d{1,2})\s*(am|pm)\s*(?:to|-|until|and)\s*(\d{1,2})\s*(am|pm)/gi,
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
        
        this.debugLog('Testing', timePatterns.length, 'time patterns...');
        
        for (let patternIndex = 0; patternIndex < timePatterns.length; patternIndex++) {
            const pattern = timePatterns[patternIndex];
            // Reset regex lastIndex to avoid issues with global flag
            pattern.lastIndex = 0;
            this.debugLog(`\n--- Testing Pattern ${patternIndex} ---`);
            this.debugLog('Pattern:', pattern.toString());
            
            timeMatch = pattern.exec(normalizedText);
            if (timeMatch) {
                this.debugLog('✓ PATTERN MATCHED!');
                this.debugLog('Match array:', timeMatch);
                this.debugLog('Match length:', timeMatch.length);
                for (let i = 0; i < timeMatch.length; i++) {
                    this.debugLog(`  Group ${i}: "${timeMatch[i]}"`);
                }
                
                if (timeMatch.length === 4 && timeMatch[3]) { // "9 to 11am" format
                    this.debugLog('Processing as "X to/and Y am/pm" format');
                    this.debugLog(`Raw values: startHour="${timeMatch[1]}", endHour="${timeMatch[2]}", period="${timeMatch[3]}"`);
                    startTime = this.parseTime(timeMatch[1], timeMatch[3]);
                    endTime = this.parseTime(timeMatch[2], timeMatch[3]);
                } else if (timeMatch.length === 5 && timeMatch[2] && timeMatch[4]) { // "9am to 11am" format
                    this.debugLog('Processing as "X am/pm to/and Y am/pm" format');
                    this.debugLog(`Raw values: startHour="${timeMatch[1]}", startPeriod="${timeMatch[2]}", endHour="${timeMatch[3]}", endPeriod="${timeMatch[4]}"`);
                    startTime = this.parseTime(timeMatch[1], timeMatch[2]);
                    endTime = this.parseTime(timeMatch[3], timeMatch[4]);
                } else if (timeMatch.length === 5) { // "09:00 to 11:00" format (array has 5 elements)
                    this.debugLog('Processing as "HH:MM to HH:MM" format');
                    const potentialStartTime = parseInt(timeMatch[1]);
                    const potentialEndTime = parseInt(timeMatch[3]);
                    this.debugLog(`Raw values: startHour=${potentialStartTime}, endHour=${potentialEndTime}`);
                    
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
                    this.debugLog('Processing as single time format (adding 2 hours)');
                    this.debugLog(`Raw values: hour="${timeMatch[1]}", period="${timeMatch[2]}"`);
                    startTime = this.parseTime(timeMatch[1], timeMatch[2]);
                    endTime = startTime + 2; // Default 2-hour duration
                    if (endTime > 23) endTime = 23; // Don't go past midnight
                    this.debugLog(`Single time converted to: ${startTime}:00-${endTime}:00`);
                } else if (timeMatch.length === 2 && typeof timeMatch[1] === 'string') { // "morning", "afternoon", "evening"
                    this.debugLog('Processing as time-of-day format');
                    const timeOfDay = timeMatch[1].toLowerCase();
                    this.debugLog(`Time of day: "${timeOfDay}"`);
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
                    this.debugLog(`Time-of-day converted to: ${startTime}:00-${endTime}:00`);
                } else {
                    this.debugLog('❌ Match format not recognized, trying next pattern');
                    this.debugLog('Match details:', {
                        length: timeMatch.length,
                        groups: timeMatch,
                        group2Type: typeof timeMatch[2],
                        group4Type: typeof timeMatch[4]
                    });
                }
                
                this.debugLog(`Intermediate result: startTime=${startTime}, endTime=${endTime}`);
                
                if (startTime !== null && endTime !== null) {
                    this.debugLog('✅ Valid time range found, stopping pattern search');
                    break; // Found valid time, stop looking
                } else {
                    this.debugLog('❌ Invalid time range, continuing to next pattern');
                }
            } else {
                this.debugLog('✗ Pattern did not match');
            }
        }
        
        this.debugLog('\n=== FINAL PARSING RESULTS ===');
        this.debugLog('Final startTime:', startTime);
        this.debugLog('Final endTime:', endTime);
        this.debugLog('Target day:', targetDay);
        
        if (startTime !== null && endTime !== null && startTime < endTime && 
            startTime >= 0 && startTime <= 23 && endTime >= 1 && endTime <= 24) {
            const slot = {
                day: targetDay,
                startTime: startTime,
                endTime: endTime
            };
            slots.push(slot);
            this.debugLog('✅ VALID SLOT CREATED:', slot);
        } else {
            this.debugLog('❌ SLOT VALIDATION FAILED:');
            this.debugLog('  startTime:', startTime, '(null?', startTime === null, ')');
            this.debugLog('  endTime:', endTime, '(null?', endTime === null, ')');
            this.debugLog('  startTime < endTime?', startTime < endTime);
            this.debugLog('  startTime in range [0,23]?', startTime >= 0 && startTime <= 23);
            this.debugLog('  endTime in range [1,24]?', endTime >= 1 && endTime <= 24);
        }
        
        this.debugLog('Final slots array:', slots);
        this.debugLog('=== TIME PARSING DEBUG COMPLETE ===\n');
        
        return slots.length > 0 ? slots : null;
    }
    
    /**
     * Parse time string to 24-hour format
     */
    parseTime(hour, period) {
        this.debugLog(`[parseTime] Converting: hour="${hour}", period="${period}"`);
        let h = parseInt(hour);
        this.debugLog(`[parseTime] Parsed integer:`, h);
        
        // Validate input
        if (isNaN(h) || h < 1 || h > 12) {
            this.debugLog(`[parseTime] ❌ Invalid hour detected: ${hour} (parsed as ${h})`);
            return null;
        }
        
        if (!period || (period !== 'am' && period !== 'pm')) {
            this.debugLog(`[parseTime] ❌ Invalid period detected: "${period}"`);
            return null;
        }
        
        // Convert to 24-hour format
        if (period === 'pm' && h !== 12) {
            h += 12;
            this.debugLog(`[parseTime] PM conversion (not 12): ${hour}${period} -> ${h}`);
        } else if (period === 'am' && h === 12) {
            h = 0;
            this.debugLog(`[parseTime] AM 12 conversion: ${hour}${period} -> ${h}`);
        } else {
            this.debugLog(`[parseTime] No conversion needed: ${hour}${period} -> ${h}`);
        }
        
        this.debugLog(`[parseTime] ✅ Final result: ${hour}${period} -> ${h}:00`);
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
     * Get user email by Telegram ID
     */
    async getUserEmail(telegramId) {
        // Hardcoded mapping for Ivan and Youssef (expand this to use database lookup)
        const telegramToEmail = {
            [process.env.IVAN_TELEGRAM_ID]: 'ivanaguilarmari@gmail.com',
            [process.env.YOUSSEF_TELEGRAM_ID]: 'youssef.email@gmail.com' // You'll need to set this
        };
        
        return telegramToEmail[telegramId.toString()];
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
        
        // Simplified time parsing for testing - FIXED to include 'and'
        const timePatterns = [
            /(\d{1,2})\s*(?:to|-|until|and)\s*(\d{1,2})\s*(am|pm)/gi,
            /(\d{1,2})\s*(am|pm)\s*(?:to|-|until|and)\s*(\d{1,2})\s*(am|pm)/gi,
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
     * Enhance Claude's response with contextual actionable guidance
     */
    async enhanceClaudeResponseWithContext(claudeResponse, contextualIntent, partnerContext, availabilityContext) {
        this.debugLog('🔧 ENHANCING CLAUDE RESPONSE', {
            contextFactors: contextualIntent.contextFactors,
            partnerStatus: partnerContext.relationshipStatus,
            hasAvailability: availabilityContext !== 'No availability set yet'
        });
        
        // Don't modify Claude's response if it's already action-oriented
        if (/try|update|set|check|coordinate/i.test(claudeResponse)) {
            return claudeResponse;
        }
        
        let enhancement = '';
        
        // Add context-specific guidance
        if (contextualIntent.contextFactors?.includes('has_pending_requests')) {
            enhancement += '\n\n💡 By the way, you have pending partner requests that might need your attention!';
        }
        
        if (contextualIntent.contextFactors?.includes('functionality_inquiry') && 
            partnerContext.relationshipStatus === 'has_partner' && 
            availabilityContext === 'No availability set yet') {
            enhancement += '\n\n🎯 Quick tip: Setting your availability will let me automatically coordinate workouts with your partner!';
        }
        
        if (contextualIntent.contextFactors?.includes('post_availability_acknowledgment')) {
            if (partnerContext.relationshipStatus === 'has_partner') {
                enhancement += '\n\n🤝 Great! I\'ll watch for coordination opportunities with your partner now.';
            } else {
                enhancement += '\n\n📊 Perfect! Your schedule is all set. Consistency is key!';
            }
        }
        
        return claudeResponse + enhancement;
    }
    
    /**
     * Determine if additional guidance should be offered after Claude's response
     */
    shouldOfferAdditionalGuidance(claudeResponse, contextualIntent, partnerContext) {
        // If Claude gave a very short or generic response and user has specific context
        const isShortResponse = claudeResponse.length < 100;
        const hasSpecificContext = contextualIntent.contextFactors?.includes('functionality_inquiry') ||
                                 contextualIntent.contextFactors?.includes('seeking_guidance_with_pending_requests');
        
        // If user has a partner but no availability, they might need guidance
        const needsCoordinationHelp = partnerContext.relationshipStatus === 'has_partner' && 
                                    contextualIntent.contextFactors?.includes('functionality_inquiry');
        
        return (isShortResponse && hasSpecificContext) || needsCoordinationHelp;
    }
    
    /**
     * Send contextual guidance based on user's situation
     */
    async sendContextualGuidance(chatId, contextualIntent, partnerContext, availabilityContext) {
        let guidance = '';
        
        if (contextualIntent.contextFactors?.includes('functionality_inquiry')) {
            if (partnerContext.relationshipStatus === 'has_partner') {
                guidance = '🤝 Since you have a gym partner, here\'s what I can help with:\n\n' +
                          '• Set your availability and I\'ll coordinate with your partner automatically\n' +
                          '• Get notified when you both have overlapping free time\n' +
                          '• Schedule joint sessions with one simple confirmation\n\n' +
                          'Just tell me your available times and I\'ll handle the rest!';
            } else {
                guidance = '💪 Here\'s how I can help with your fitness journey:\n\n' +
                          '• Track your workout availability\n' +
                          '• Find you a gym partner if you want one\n' +
                          '• Provide motivation and workout advice\n' +
                          '• Help you stay consistent with your schedule\n\n' +
                          'What would you like to focus on first?';
            }
        } else if (partnerContext.hasPendingRequests) {
            guidance = '👋 Quick heads up: You have partner requests waiting for your response. ' +
                      'These might be from people wanting to work out together!';
        }
        
        if (guidance) {
            await this.bot.sendMessage(chatId, guidance);
        }
    }
    
    /**
     * Generate intelligent fallback when Claude API fails
     */
    async generateIntelligentFallback(messageText, contextualIntent, partnerContext, availabilityContext, user) {
        this.debugLog('🚨 GENERATING INTELLIGENT FALLBACK', {
            intent: contextualIntent.type,
            contextFactors: contextualIntent.contextFactors
        });
        
        // Start with a friendly acknowledgment
        let fallback = `Hey ${user.name}! I'm having a bit of trouble with my AI right now, but I can still help! 💪\n\n`;
        
        // Provide context-specific guidance
        if (contextualIntent.contextFactors?.includes('functionality_inquiry')) {
            if (partnerContext.relationshipStatus === 'has_partner') {
                fallback += 'I can see you have a gym partner! The main things I can help with are:\n' +
                           '• Coordinating your workout schedules automatically\n' +
                           '• Setting up joint training sessions\n' +
                           '• Managing your availability\n\n' +
                           'Try telling me your available times and I\'ll coordinate with your partner!';
            } else {
                fallback += 'Here are the key things I can help you with:\n' +
                           '• Managing your workout schedule\n' +
                           '• Finding a gym partner if you want one\n' +
                           '• Tracking your fitness progress\n\n' +
                           'What would you like to start with?';
            }
        } else if (contextualIntent.type === 'general_chat') {
            // Fitness-related fallback
            const fitnessResponses = [
                'Keep pushing yourself! Every workout counts toward your goals.',
                'Remember, consistency beats perfection every time. You\'ve got this!',
                'Whether it\'s strength training or cardio, the best workout is the one you actually do.',
                'Progress isn\'t always visible immediately, but your body is getting stronger with each session!'
            ];
            
            const randomResponse = fitnessResponses[Math.floor(Math.random() * fitnessResponses.length)];
            fallback += randomResponse;
            
            if (availabilityContext !== 'No availability set yet') {
                fallback += '\n\nI can see you\'ve got your workout schedule planned out - that\'s already a great step!';
            }
        } else {
            fallback += 'I can still help you with scheduling, coordination, and fitness tracking. ' +
                       'What specific thing would you like assistance with?';
        }
        
        // Add current status context
        if (partnerContext.hasPendingRequests) {
            fallback += '\n\n💡 P.S. You have pending partner requests that might need attention!';
        }
        
        return fallback;
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