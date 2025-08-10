/**
 * Test script to verify the session filtering fix
 * This should now show only confirmed upcoming sessions like the website
 */

const GymBuddyAPIService = require('./apiService');

async function testSessionFiltering() {
    console.log('🧪 Testing Session Filtering Fix');
    console.log('================================\n');
    
    const apiService = new GymBuddyAPIService();
    
    // Test with Ivan's Telegram ID
    const telegramId = '1195143765';
    
    console.log('📋 Testing getUserSessions with filtering...');
    
    try {
        const sessions = await apiService.getUserSessions(telegramId);
        
        console.log('\n✅ Session Results:');
        console.log(`📊 Total sessions found: ${sessions.length}`);
        
        if (sessions.length === 0) {
            console.log('🔍 No confirmed upcoming sessions found');
        } else {
            sessions.forEach((session, index) => {
                console.log(`\n${index + 1}. Session Details:`);
                console.log(`   📅 Day: ${session.day}`);
                console.log(`   🕐 Time: ${session.start_time}:00 - ${session.end_time}:00`);
                console.log(`   ✅ Status: ${session.status}`);
                console.log(`   📝 Date: ${session.date}`);
                console.log(`   🆔 ID: ${session.id}`);
            });
        }
        
        console.log('\n🎯 Expected Result:');
        console.log('- Bot should now show the SAME sessions as the website');
        console.log('- Only confirmed upcoming sessions');
        console.log('- No past, cancelled, or completed sessions');
        
        if (sessions.length === 1) {
            console.log('\n🎉 SUCCESS: Bot now shows exactly 1 session like the website!');
        } else if (sessions.length === 0) {
            console.log('\n⚠️  INFO: No upcoming sessions (website should also show 0)');
        } else {
            console.log('\n⚠️  REVIEW: Multiple sessions found - check if website shows the same');
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
    
    console.log('\n================================');
    console.log('🏁 Test Complete');
}

// Run the test
testSessionFiltering().catch(console.error);