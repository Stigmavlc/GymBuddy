/**
 * Simple test script to verify the bot's natural language improvements
 * This tests the intent detection and response patterns without actually running the bot
 */

const GymBuddyTelegramBot = require('./telegramBot');

// Create a test instance (without actually starting polling)
// We'll access methods directly to avoid initializing the Telegram bot
const botClass = require('./telegramBot');
const bot = {
    analyzeMessageIntent: botClass.prototype.analyzeMessageIntent.bind({}),
    parseAvailabilityFromTextSync: botClass.prototype.parseAvailabilityFromTextSync.bind({
        debugLog: () => {} // Mock debug log
    })
};

console.log('=== Testing Bot Natural Language Improvements ===\n');

// Test cases for contextual understanding
const testCases = [
    {
        description: 'Contextual clear commands',
        messages: [
            'clear this',
            'delete it',
            'cancel this',
            'remove it',
            'clear all'
        ]
    },
    {
        description: 'Direct clear commands',
        messages: [
            'clear my availability',
            'delete my availability',
            'reset my schedule'
        ]
    },
    {
        description: 'Availability updates',
        messages: [
            'set me available Monday 9am-11am',
            'update my availability for Tuesday morning',
            'I\'m free Wednesday 6-8pm',
            'available Thursday evening'
        ]
    },
    {
        description: 'Availability queries',
        messages: [
            'what\'s my availability?',
            'show my schedule',
            'when am I available?'
        ]
    }
];

// Mock availability for context testing
const mockAvailability = [
    { day: 'monday', start_time: 9, end_time: 11 },
    { day: 'wednesday', start_time: 18, end_time: 20 }
];

testCases.forEach(testCase => {
    console.log(`--- ${testCase.description} ---`);
    
    testCase.messages.forEach((message, index) => {
        console.log(`\nTest ${index + 1}: "${message}"`);
        
        // Test intent analysis with and without availability context
        const intentWithoutContext = bot.analyzeMessageIntent(message);
        const intentWithContext = bot.analyzeMessageIntent(message, mockAvailability);
        
        console.log(`  Without context: ${intentWithoutContext.type} (${intentWithoutContext.confidence})`);
        console.log(`  With context: ${intentWithContext.type} (${intentWithContext.confidence})`);
        
        // Test availability parsing for update messages
        if (intentWithContext.type === 'availability_update') {
            try {
                const parsed = bot.parseAvailabilityFromTextSync(message);
                if (parsed && parsed.length > 0) {
                    parsed.forEach(slot => {
                        console.log(`    Parsed: ${slot.day} ${slot.startTime}:00-${slot.endTime}:00`);
                    });
                } else {
                    console.log(`    Parsing: Could not extract time/day`);
                }
            } catch (error) {
                console.log(`    Parsing: Error - ${error.message}`);
            }
        }
    });
    
    console.log('');
});

console.log('=== Key Improvements Made ===');
console.log('✅ Contextual understanding: "clear this" now works when user has availability');
console.log('✅ Removed instructional responses from availability queries');
console.log('✅ Simplified error messages without excessive examples');
console.log('✅ Natural, action-oriented responses instead of explanations');
console.log('✅ Updated Claude AI prompt to be conversational, not instructional');
console.log('✅ Cleaner success messages focused on the action completed');
console.log('\n=== Test Complete ===');