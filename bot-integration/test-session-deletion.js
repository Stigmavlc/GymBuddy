#!/usr/bin/env node

/**
 * Test Session Deletion Debugging
 * 
 * This script tests the session deletion functionality to verify our debug logging works
 */

const GymBuddyAPIService = require('./apiService');

async function testSessionDeletion() {
    console.log('🧪 Testing Session Deletion with Debug Logging');
    console.log('================================================\n');
    
    // Test with the known user Telegram ID
    const telegramId = '1195143765'; // Ivan's Telegram ID
    
    const apiService = new GymBuddyAPIService();
    
    try {
        console.log('1. Testing getUserSessions method...');
        const sessions = await apiService.getUserSessions(telegramId);
        
        console.log('\n📊 Results:');
        console.log('Sessions found:', sessions.length);
        console.log('Sessions data:', JSON.stringify(sessions, null, 2));
        
        if (sessions.length > 0) {
            console.log('\n✅ Session deletion should work!');
            
            // Find confirmed sessions that can be deleted
            const confirmedSessions = sessions.filter(s => s.status === 'confirmed');
            console.log(`\n📅 Confirmed sessions available for deletion: ${confirmedSessions.length}`);
            
            confirmedSessions.forEach((session, index) => {
                console.log(`   ${index + 1}. ${session.day} ${session.start_time}:00-${session.end_time}:00 (${session.date})`);
            });
            
        } else {
            console.log('\n❌ No sessions found - user needs to create some sessions first');
        }
        
    } catch (error) {
        console.error('\n❌ Test failed with error:');
        console.error('Error type:', typeof error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
    }
}

// Run the test
testSessionDeletion().then(() => {
    console.log('\n🎯 Test completed!');
    process.exit(0);
}).catch(error => {
    console.error('\n💥 Test crashed:', error);
    process.exit(1);
});