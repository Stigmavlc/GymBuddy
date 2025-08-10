/**
 * Debug Script for Availability Update Issue
 * 
 * This script tests the natural language processing and API call flow
 * to identify why start_time and end_time are being sent as null
 */

const GymBuddyTelegramBot = require('./telegramBot');
const GymBuddyAPIService = require('./apiService');

// Enable debug mode
process.env.BOT_DEBUG_MODE = 'true';

console.log('=== DEBUG SCRIPT: Availability Update Issue ===\n');

// Test the parsing function directly
function testParsingOnly() {
    console.log('--- Testing Parsing Function ---');
    
    const bot = new GymBuddyTelegramBot();
    
    const testMessages = [
        "Update my availability for next Tuesday, from 09 to 11am",
        "Update my availability for Tuesday 9am to 11am",
        "Set me available Monday 6-8pm",
        "Available Thursday morning",
        "I'm free on Wednesday 14:00 to 16:00"
    ];
    
    testMessages.forEach(async (message, index) => {
        console.log(`\nTest ${index + 1}: "${message}"`);
        
        // Test synchronous parsing
        const parsedSlots = bot.parseAvailabilityFromTextSync(message);
        
        if (parsedSlots && parsedSlots.length > 0) {
            parsedSlots.forEach(slot => {
                console.log(`  ✅ Parsed successfully:`);
                console.log(`     Day: ${slot.day}`);
                console.log(`     Start Time: ${slot.startTime}`);
                console.log(`     End Time: ${slot.endTime}`);
                console.log(`     Display: ${slot.day} ${slot.startTime}:00-${slot.endTime}:00`);
            });
        } else {
            console.log('  ❌ Failed to parse');
        }
    });
}

// Test the API payload formation
async function testAPIPayloadFormation() {
    console.log('\n--- Testing API Payload Formation ---');
    
    const bot = new GymBuddyTelegramBot();
    const testMessage = "Update my availability for Tuesday 9am to 11am";
    
    console.log(`Input: "${testMessage}"`);
    
    // Parse the message
    const parsedSlots = await bot.parseAvailabilityFromText(testMessage);
    console.log('\nParsed slots:', JSON.stringify(parsedSlots, null, 2));
    
    if (parsedSlots && parsedSlots.length > 0) {
        // Convert to API format (as done in handleAvailabilityUpdate)
        const apiSlots = parsedSlots.map(slot => ({
            day: slot.day,
            startTime: slot.startTime,
            endTime: slot.endTime
        }));
        
        console.log('\nAPI payload slots:', JSON.stringify(apiSlots, null, 2));
        
        // Show what the API expects
        console.log('\nAPI expects format:');
        console.log(JSON.stringify({
            slots: [
                {
                    day: 'tuesday',
                    start_time: 9,
                    end_time: 11
                }
            ]
        }, null, 2));
        
        // Identify the issue
        console.log('\n⚠️  ISSUE IDENTIFIED:');
        console.log('Bot sends: { day, startTime, endTime }');
        console.log('API expects: { day, start_time, end_time }');
        console.log('The property names don\'t match! Using camelCase instead of snake_case.');
    }
}

// Test actual API call
async function testActualAPICall() {
    console.log('\n--- Testing Actual API Call ---');
    
    const apiService = new GymBuddyAPIService();
    const telegramId = '1195143765'; // Ivan's Telegram ID
    
    // Test with CORRECT format
    const correctSlots = [{
        day: 'tuesday',
        start_time: 9,  // snake_case as expected by API
        end_time: 11    // snake_case as expected by API
    }];
    
    console.log('Testing with correct format:', JSON.stringify(correctSlots, null, 2));
    
    const result = await apiService.setUserAvailability(telegramId, correctSlots);
    
    if (result.success) {
        console.log('✅ API call successful with correct format');
        console.log('Result:', result);
    } else {
        console.log('❌ API call failed:', result.error);
    }
    
    // Test with INCORRECT format (what bot currently sends)
    const incorrectSlots = [{
        day: 'wednesday',
        startTime: 14,  // camelCase (WRONG)
        endTime: 16     // camelCase (WRONG)
    }];
    
    console.log('\nTesting with incorrect format (current bot behavior):', JSON.stringify(incorrectSlots, null, 2));
    
    const result2 = await apiService.setUserAvailability(telegramId, incorrectSlots);
    
    if (result2.success) {
        console.log('✅ API call successful (unexpected)');
        console.log('Result:', result2);
    } else {
        console.log('❌ API call failed as expected:', result2.error);
        console.log('This confirms the issue: property name mismatch');
    }
}

// Run all tests
async function runAllTests() {
    testParsingOnly();
    
    setTimeout(async () => {
        await testAPIPayloadFormation();
        
        setTimeout(async () => {
            await testActualAPICall();
            
            console.log('\n=== SOLUTION ===');
            console.log('In telegramBot.js, line 823-825, change:');
            console.log('FROM:');
            console.log(`  const apiSlots = parsedSlots.map(slot => ({
      day: slot.day,
      startTime: slot.startTime,
      endTime: slot.endTime
  }));`);
            console.log('\nTO:');
            console.log(`  const apiSlots = parsedSlots.map(slot => ({
      day: slot.day,
      start_time: slot.startTime,  // Changed to snake_case
      end_time: slot.endTime       // Changed to snake_case
  }));`);
            
            console.log('\n=== END DEBUG SCRIPT ===');
            process.exit(0);
        }, 2000);
    }, 2000);
}

// Run tests
runAllTests();