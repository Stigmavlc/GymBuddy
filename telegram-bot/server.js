const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
require('dotenv').config();

// Import services
const DatabaseService = require('./services/database');
const AIService = require('./services/ai');
const MessageHandler = require('./services/messageHandler');
const CoordinationService = require('./services/coordinationService');
const ReminderService = require('./services/reminderService');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize services  
const databaseService = new DatabaseService(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

const aiService = new AIService(process.env.ANTHROPIC_API_KEY);

// Initialize Telegram bot first (needed for coordination service)
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, {
    polling: process.env.NODE_ENV !== 'production'
});

const reminderService = new ReminderService(databaseService, bot);
const coordinationService = new CoordinationService(databaseService, bot, reminderService);
const messageHandler = new MessageHandler(databaseService, aiService, coordinationService);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bot is already initialized above

// Store active users
const activeUsers = new Set();

// Bot setup function for webhooks (production)
async function setupWebhook() {
    if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
        try {
            await bot.setWebHook(process.env.WEBHOOK_URL);
            console.log('Webhook set successfully');
        } catch (error) {
            console.error('Failed to set webhook:', error);
        }
    }
}

// Handle /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.from;
    
    activeUsers.add(chatId);
    
    // Check if user is in database
    const dbUser = await databaseService.getUserByTelegramId(chatId);
    
    // Determine user and partner names
    let userName = user.first_name;
    let partnerName = 'your workout partner';
    let isRegistered = false;
    
    if (dbUser) {
        isRegistered = true;
        userName = dbUser.name.split(' ')[0]; // Get first name
        
        // Get partner info
        const partner = await databaseService.getPartnerInfo(dbUser.id);
        if (partner) {
            partnerName = partner.name.split(' ')[0];
        }
    } else {
        // Detect Ivan vs Youssef for unregistered users
        if (user.first_name?.toLowerCase().includes('ivan') || user.username?.toLowerCase().includes('ivan')) {
            userName = 'Ivan';
            partnerName = 'Youssef';
        } else if (user.first_name?.toLowerCase().includes('youssef') || user.username?.toLowerCase().includes('youssef')) {
            userName = 'Youssef';
            partnerName = 'Ivan';
        }
    }

    let welcomeMessage = `🤖💪 Hey ${userName}! Welcome to GymBuddy Coordinator!

I'm the AI that Ivan created specifically for you two gym enthusiasts! 🏋️‍♂️

Think of me as your personal workout scheduling genius who never forgets leg day! 😏

🎯 What I can do for you:
• Coordinate gym sessions with ${partnerName} (because someone has to keep you both accountable!)
• Find the perfect workout times that work for both of you
• Send those "friendly" reminders when you try to skip 😉
• Handle all the back-and-forth scheduling drama so you can focus on gains

Just tell me about your availability in plain English and I'll work my magic to coordinate with ${partnerName}. No more endless "what time works for you?" text chains! 

Ready to get those gains scheduled? Let's do this! 💪✨`;

    if (!isRegistered) {
        welcomeMessage += `\n\n⚠️ Note: I don't have you in my system yet. Please sign up at https://gymbuddy.com first, then come back and I'll be able to help coordinate your sessions!`;
    }

    await bot.sendMessage(chatId, welcomeMessage);
    
    // Update user activity if registered
    if (isRegistered) {
        await databaseService.updateUserActivity(chatId);
    }
});

// Handle /help command
bot.onText(/\/help/, async (msg) => {
    const chatId = msg.chat.id;
    
    const helpMessage = `🤖 GymBuddy Coordinator Help

**Commands:**
/start - Start using the bot
/help - Show this help message
/status - Check bot status

**How to use:**
Just send me natural language messages about your gym schedule:

• "I'm available Monday and Wednesday evenings"
• "What days work for both of us this week?"
• "I need to reschedule tomorrow's session"

I'll use my scheduling superpowers to help you and your workout partner find the best times!

**What makes me awesome:**
✅ I speak human (no complicated commands!)
✅ I never forget your preferences 
✅ I'll bug both of you until you actually book sessions 😏
✅ I'm available 24/7 (unlike your gym buddy who "forgot" to reply)`;

    await bot.sendMessage(chatId, helpMessage);
});

// Handle /status command
bot.onText(/\/status/, async (msg) => {
    const chatId = msg.chat.id;
    
    const statusMessage = `🤖 GymBuddy Status

✅ Bot is online and active
👥 Active users: ${activeUsers.size}
🧠 Direct Claude AI integration
⏰ Uptime: ${Math.floor(process.uptime() / 60)} minutes

All systems operational! 🏋️`;

    await bot.sendMessage(chatId, statusMessage);
});

// Handle all other messages
bot.on('message', async (msg) => {
    // Skip if it's a command (already handled above)
    if (msg.text && msg.text.startsWith('/')) {
        return;
    }
    
    const chatId = msg.chat.id;
    const user = msg.from;
    const messageText = msg.text || msg.caption || '';
    
    if (!messageText) {
        await bot.sendMessage(chatId, "I can only process text messages right now. Please send me a text message about your gym schedule!");
        return;
    }
    
    console.log(`Message from ${user.first_name} (${chatId}): ${messageText}`);
    
    // Add user to active users
    activeUsers.add(chatId);
    
    // Send "typing" indicator
    await bot.sendChatAction(chatId, 'typing');
    
    try {
        // Process message using our new MessageHandler
        const result = await messageHandler.processMessage(msg);
        
        if (result.success) {
            // Send the AI-generated response
            await bot.sendMessage(chatId, result.response, { parse_mode: 'HTML' });
            
            // Log any actions that were executed
            if (result.actions && result.actions.length > 0) {
                console.log('Bot executed actions:', result.actions.map(a => a.type));
            }
            
            // Log action results
            if (result.actionResults && result.actionResults.length > 0) {
                const successfulActions = result.actionResults.filter(r => r.success);
                if (successfulActions.length > 0) {
                    console.log('✅ Successful actions:', successfulActions.map(r => r.action));
                }
                
                const failedActions = result.actionResults.filter(r => !r.success);
                if (failedActions.length > 0) {
                    console.log('❌ Failed actions:', failedActions.map(r => `${r.action}: ${r.error}`));
                }
            }
        } else {
            // Handle error
            await bot.sendMessage(chatId, result.response || "😅 Oops! I'm having trouble processing that. Please try again!");
        }
        
    } catch (error) {
        console.error('Failed to process message:', error);
        await bot.sendMessage(chatId, "😅 Sorry, I'm having a technical moment. Please try again in a bit!");
    }
});

// Express routes

// Health check
app.get('/', (req, res) => {
    res.json({
        status: 'GymBuddy Telegram Bot is running! 🏋️',
        uptime: process.uptime(),
        activeUsers: activeUsers.size,
        environment: process.env.NODE_ENV || 'development'
    });
});

// Webhook endpoint for Telegram
app.post('/webhook', (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Webhook health check endpoint
app.get('/webhook/health', async (req, res) => {
    try {
        // Check webhook info from Telegram
        const webhookInfo = await bot.getWebHookInfo();
        
        // Check database connection
        const dbStatus = await databaseService.checkConnection();
        
        // Check AI service
        const aiStatus = aiService.isConfigured();
        
        res.json({
            status: 'healthy',
            webhook: {
                url: webhookInfo.url || 'Not set',
                hasCustomCertificate: webhookInfo.has_custom_certificate || false,
                pendingUpdateCount: webhookInfo.pending_update_count || 0,
                lastErrorDate: webhookInfo.last_error_date ? new Date(webhookInfo.last_error_date * 1000).toISOString() : null,
                lastErrorMessage: webhookInfo.last_error_message || null,
                maxConnections: webhookInfo.max_connections || 40,
                allowedUpdates: webhookInfo.allowed_updates || []
            },
            services: {
                database: dbStatus ? 'connected' : 'disconnected',
                ai: aiStatus ? 'configured' : 'not configured',
                reminder: 'active'
            },
            stats: {
                uptime: process.uptime(),
                activeUsers: activeUsers.size,
                memoryUsage: process.memoryUsage(),
                environment: process.env.NODE_ENV || 'development'
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Webhook health check error:', error);
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Database diagnostic endpoint
app.get('/debug/database', async (req, res) => {
    try {
        const userId = req.query.userId || 'f8939d4a-c2d3-4c7b-80e2-3a384fc953bd';
        
        const testResults = await databaseService.testDatabaseAccess(userId);
        
        res.json({
            status: 'diagnostic_complete',
            userId: userId,
            timestamp: new Date().toISOString(),
            results: testResults,
            recommendations: {
                availability: testResults.availability?.success ? 'OK' : 'Apply RLS policy for service role',
                sessions: testResults.sessions?.success ? 'OK' : 'Apply RLS policy for service role',
                availability_write: testResults.availability_write?.success ? 'OK' : 'RLS blocking writes - apply service role policy'
            }
        });
    } catch (error) {
        console.error('Database diagnostic error:', error);
        res.status(500).json({
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// API endpoint to send messages (kept for backward compatibility)
app.post('/send-message', async (req, res) => {
    const { chat_id, message, parse_mode = 'HTML' } = req.body;
    
    if (!chat_id || !message) {
        return res.status(400).json({ 
            error: 'Missing required fields: chat_id, message' 
        });
    }
    
    try {
        await bot.sendMessage(chat_id, message, { parse_mode });
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Broadcast message to all active users (for system notifications)
app.post('/broadcast', async (req, res) => {
    const { message, parse_mode = 'HTML' } = req.body;
    
    if (!message) {
        return res.status(400).json({ error: 'Missing message field' });
    }
    
    const results = [];
    
    for (const chatId of activeUsers) {
        try {
            await bot.sendMessage(chatId, message, { parse_mode });
            results.push({ chat_id: chatId, success: true });
        } catch (error) {
            results.push({ chat_id: chatId, success: false, error: error.message });
        }
    }
    
    res.json({ 
        total_users: activeUsers.size,
        results: results 
    });
});

// Error handling
bot.on('error', (error) => {
    console.error('Telegram bot error:', error);
});

bot.on('polling_error', (error) => {
    console.error('Telegram polling error:', error);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    reminderService.destroy();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    reminderService.destroy();
    process.exit(0);
});

// Start server
app.listen(PORT, async () => {
    console.log(`🤖 GymBuddy Telegram Bot server running on port ${PORT}`);
    console.log(`📱 Bot token: ${process.env.TELEGRAM_BOT_TOKEN ? 'Set' : 'Missing'}`);
    console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL ? 'Connected' : 'Missing'}`);
    console.log(`🤖 Claude AI: ${process.env.ANTHROPIC_API_KEY ? 'Ready' : 'Missing'}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`⏰ Reminder Service: Active (checking every 15 minutes)`);
    console.log(`✨ Direct Claude AI integration active!`);
    
    // Set up webhook for production
    if (process.env.NODE_ENV === 'production') {
        await setupWebhook();
    }
});