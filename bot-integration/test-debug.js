/**
 * Debug Test Script for GymBuddy Telegram Bot
 * 
 * This script helps test the bot's debugging capabilities and functionality
 * without needing to send actual Telegram messages.
 */

const GymBuddyTelegramBot = require('./telegramBot');

// Test cases for availability parsing
const testCases = [
    {
        name: "Basic availability update",
        message: "Update my availability for next Tuesday, from 09 to 11am",
        expected: "Should parse Tuesday 9am-11am"
    },
    {
        name: "Alternative format",
        message: "Set me available Monday 6-8pm",
        expected: "Should parse Monday 6pm-8pm"
    },
    {
        name: "Full format",
        message: "Available Thursday 10:00-12:00",
        expected: "Should parse Thursday 10am-12pm"
    },
    {
        name: "From-to format", 
        message: "I'm free from 9am to 11am on Wednesday",
        expected: "Should parse Wednesday 9am-11am"
    },
    {
        name: "General chat",
        message: "How's the gym today?",
        expected: "Should be handled as general conversation"
    }
];

async function runDebugTests() {
    console.log('=== GymBuddy Bot Debug Test ===\n');
    
    // Create bot instance with debug mode
    process.env.BOT_DEBUG_MODE = 'true';
    const bot = new GymBuddyTelegramBot();
    
    console.log('Testing availability intent detection:\n');
    
    for (const testCase of testCases) {
        console.log(`Test: ${testCase.name}`);
        console.log(`Message: "${testCase.message}"`);
        
        const isAvailabilityIntent = bot.detectAvailabilityIntent(testCase.message);
        console.log(`Intent detected: ${isAvailabilityIntent}`);
        console.log(`Expected: ${testCase.expected}`);
        
        if (isAvailabilityIntent) {
            const parsedSlots = await bot.parseAvailabilityFromText(testCase.message);
            console.log(`Parsed slots:`, parsedSlots);
        }
        
        console.log('---\n');
    }
    
    console.log('Testing Claude API prompt construction:\n');
    
    // Test prompt construction
    const mockUser = {
        id: '123',
        name: 'Test User',
        email: 'test@example.com'
    };
    
    const mockAvailability = [
        { day: 'monday', start_time: 9, end_time: 11 },
        { day: 'wednesday', start_time: 18, end_time: 20 }
    ];
    
    console.log('Mock user:', mockUser);
    console.log('Mock availability:', mockAvailability);
    
    // Test availability context formatting
    const availabilityContext = mockAvailability.map(slot => 
        `${slot.day.charAt(0).toUpperCase() + slot.day.slice(1)}: ${slot.start_time}:00-${slot.end_time}:00`
    ).join(', ');
    
    console.log('Formatted availability context:', availabilityContext);
    
    console.log('\n=== Debug Test Complete ===');
    
    // Don't actually start the bot
    process.exit(0);
}

// Run tests if called directly
if (require.main === module) {
    runDebugTests().catch(error => {
        console.error('Debug test failed:', error);
        process.exit(1);
    });
}

module.exports = { runDebugTests };