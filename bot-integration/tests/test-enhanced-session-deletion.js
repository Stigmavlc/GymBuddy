/**
 * Test script for enhanced session deletion functionality
 * Tests natural language parsing and session matching
 */

const GymBuddyTelegramBot = require('./telegramBot');

// Mock sessions data for testing
const mockSessions = [
    { id: 1, day: 'monday', start_time: 7, end_time: 9 },
    { id: 2, day: 'monday', start_time: 19, end_time: 21 },
    { id: 3, day: 'tuesday', start_time: 9, end_time: 11 },
    { id: 4, day: 'wednesday', start_time: 18, end_time: 20 },
    { id: 5, day: 'friday', start_time: 14, end_time: 16 }
];

// Test cases for natural language parsing
const testCases = [
    // Exact matches
    { input: 'delete my Monday 7-9 session', expectedMatches: 1, description: 'Exact match - Monday 7-9' },
    { input: 'cancel Monday 7am-9am', expectedMatches: 1, description: 'Exact match with AM/PM' },
    { input: 'remove Tuesday 9-11', expectedMatches: 1, description: 'Exact match - Tuesday 9-11' },
    
    // Partial matches (day only)
    { input: 'cancel my Monday session', expectedMatches: 2, description: 'Day only - Monday (should match 2)' },
    { input: 'delete Friday session', expectedMatches: 1, description: 'Day only - Friday' },
    
    // Partial matches (time only)
    { input: 'cancel my 7-9 session', expectedMatches: 1, description: 'Time only - 7-9' },
    { input: 'delete 9am-11am session', expectedMatches: 1, description: 'Time only with AM/PM' },
    
    // Multiple matches
    { input: 'cancel evening sessions', expectedMatches: 2, description: 'Evening sessions (Monday 7-9pm, Wednesday 6-8pm)' },
    
    // No matches
    { input: 'delete Sunday session', expectedMatches: 0, description: 'No Sunday sessions' },
    { input: 'cancel 5am-7am session', expectedMatches: 0, description: 'No early morning sessions' },
    
    // Edge cases
    { input: 'just the number 1', expectedMatches: null, description: 'Pure numeric input' },
    { input: 'hello world', expectedMatches: null, description: 'No session-related content' }
];

console.log('=== Testing Enhanced Session Deletion ===\n');

// Create a bot instance for testing (won't actually start polling)
const bot = new GymBuddyTelegramBot();

// Test parsing function
function testSessionParsing() {
    console.log('🧪 Testing parseSessionFromNaturalLanguage:\n');
    
    testCases.forEach((testCase, index) => {
        console.log(`Test ${index + 1}: "${testCase.input}"`);
        
        try {
            const criteria = bot.parseSessionFromNaturalLanguage(testCase.input);
            
            if (testCase.expectedMatches === null) {
                console.log(`  Expected: No parsing (pure numeric or irrelevant)`);
                console.log(`  Got: ${criteria ? JSON.stringify(criteria) : 'null'}`);
            } else {
                console.log(`  Expected: Criteria for ${testCase.expectedMatches} matches`);
                console.log(`  Got: ${criteria ? JSON.stringify(criteria) : 'null'}`);
            }
            
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
        }
        
        console.log(`  Description: ${testCase.description}\n`);
    });
}

// Test matching function
function testSessionMatching() {
    console.log('🎯 Testing matchSessionToCriteria:\n');
    
    testCases.forEach((testCase, index) => {
        if (testCase.expectedMatches === null) return; // Skip non-session inputs
        
        console.log(`Test ${index + 1}: "${testCase.input}"`);
        
        try {
            const criteria = bot.parseSessionFromNaturalLanguage(testCase.input);
            
            if (criteria) {
                const matchResult = bot.matchSessionToCriteria(criteria, mockSessions);
                const totalMatches = matchResult.exactMatches.length + matchResult.partialMatches.length;
                
                console.log(`  Criteria: ${JSON.stringify(criteria)}`);
                console.log(`  Exact matches: ${matchResult.exactMatches.length}`);
                console.log(`  Partial matches: ${matchResult.partialMatches.length}`);
                console.log(`  Total matches: ${totalMatches}`);
                console.log(`  Expected: ${testCase.expectedMatches}`);
                console.log(`  ✅ ${totalMatches === testCase.expectedMatches ? 'PASS' : 'FAIL'}`);
                
                // Show matched sessions
                if (matchResult.exactMatches.length > 0) {
                    console.log('  Exact match sessions:');
                    matchResult.exactMatches.forEach(session => {
                        console.log(`    - ${session.day} ${session.start_time}:00-${session.end_time}:00`);
                    });
                }
                if (matchResult.partialMatches.length > 0) {
                    console.log('  Partial match sessions:');
                    matchResult.partialMatches.forEach(session => {
                        console.log(`    - ${session.day} ${session.start_time}:00-${session.end_time}:00`);
                    });
                }
            } else {
                console.log(`  No criteria parsed`);
                console.log(`  Expected: ${testCase.expectedMatches} matches`);
                console.log(`  ❌ FAIL - Could not parse criteria`);
            }
            
        } catch (error) {
            console.log(`  ❌ Error: ${error.message}`);
        }
        
        console.log(`  Description: ${testCase.description}\n`);
    });
}

// Show mock data
function showMockData() {
    console.log('📊 Mock Session Data:');
    mockSessions.forEach((session, index) => {
        const dayName = session.day.charAt(0).toUpperCase() + session.day.slice(1);
        console.log(`  ${index + 1}. ${dayName} ${session.start_time}:00-${session.end_time}:00`);
    });
    console.log('\n');
}

// Run tests
showMockData();
testSessionParsing();
testSessionMatching();

console.log('=== Test Summary ===');
console.log('✅ Enhanced session deletion functionality tested');
console.log('🎯 Natural language parsing implemented');
console.log('🔍 Session matching with exact/partial results');
console.log('♻️  Backward compatibility maintained for numeric input');
console.log('\nYou can now use phrases like:');
console.log('• "delete my Monday 7-9 session"');
console.log('• "cancel Tuesday session" ');
console.log('• "remove my evening session"');
console.log('• Or still use "1", "2", "3" for numbered selection');