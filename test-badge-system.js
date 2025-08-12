/**
 * Badge System Test Script
 * Run this in the browser console to test badge system functionality
 * 
 * Usage:
 * 1. Open your GymBuddy app in the browser
 * 2. Make sure you're logged in
 * 3. Open Developer Console (F12)
 * 4. Copy and paste this entire script
 * 5. Check the console output for diagnostics
 */

(async function testBadgeSystem() {
    console.log('🔍 BADGE SYSTEM DIAGNOSTIC TEST');
    console.log('================================');
    
    // Check if Supabase is available
    if (typeof window === 'undefined' || !window.supabase) {
        console.error('❌ Supabase not found. Make sure you are on the GymBuddy app.');
        return;
    }
    
    const supabase = window.supabase;
    
    // Test 1: Check authentication
    console.log('\n📌 Test 1: Authentication Status');
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError) {
        console.error('❌ Auth error:', authError);
        return;
    }
    
    if (!session) {
        console.error('❌ Not authenticated. Please log in first.');
        return;
    }
    
    console.log('✅ Authenticated as:', session.user.email);
    console.log('   User ID:', session.user.id);
    
    // Test 2: Try to read badges table
    console.log('\n📌 Test 2: Reading Badges Table');
    const { data: badges, error: badgeError } = await supabase
        .from('badges')
        .select('*');
    
    if (badgeError) {
        console.error('❌ Cannot read badges table:', badgeError);
        console.error('   Error code:', badgeError.code);
        console.error('   Error message:', badgeError.message);
        
        if (badgeError.code === '42501') {
            console.error('   🔒 This is an RLS policy error. The badges table needs proper SELECT permissions.');
        }
    } else {
        console.log('✅ Successfully read badges table');
        console.log('   Total badges available:', badges?.length || 0);
        
        if (badges && badges.length > 0) {
            console.log('   Sample badges:', badges.slice(0, 3).map(b => b.name).join(', '));
        } else {
            console.warn('   ⚠️ No badges found in database. They may need to be initialized.');
        }
    }
    
    // Test 3: Try to read user's badges
    console.log('\n📌 Test 3: Reading User Badges');
    const { data: userBadges, error: userBadgeError } = await supabase
        .from('user_badges')
        .select('*, badges(name, icon, description)')
        .eq('user_id', session.user.id);
    
    if (userBadgeError) {
        console.error('❌ Cannot read user badges:', userBadgeError);
        console.error('   Error code:', userBadgeError.code);
        console.error('   Error message:', userBadgeError.message);
        
        if (userBadgeError.code === '42501') {
            console.error('   🔒 This is an RLS policy error. User cannot read their own badges.');
        }
    } else {
        console.log('✅ Successfully read user badges');
        console.log('   Badges earned:', userBadges?.length || 0);
        
        if (userBadges && userBadges.length > 0) {
            console.log('   Your badges:');
            userBadges.forEach(ub => {
                if (ub.badges) {
                    console.log(`     - ${ub.badges.icon} ${ub.badges.name}: ${ub.badges.description}`);
                }
            });
        } else {
            console.log('   ℹ️ You haven\'t earned any badges yet.');
        }
    }
    
    // Test 4: Check user's sessions for badge eligibility
    console.log('\n📌 Test 4: Checking Session History');
    const { data: sessions, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .contains('participants', [session.user.id])
        .eq('status', 'completed');
    
    if (sessionError) {
        console.error('❌ Cannot read sessions:', sessionError);
    } else {
        const totalSessions = sessions?.length || 0;
        console.log('✅ Total completed sessions:', totalSessions);
        
        // Check badge eligibility
        console.log('\n📊 Badge Eligibility Analysis:');
        
        if (totalSessions >= 2) {
            console.log('   ✅ Eligible for "Getting Started" badge (2+ sessions)');
        } else {
            console.log('   ⏳ Need', 2 - totalSessions, 'more sessions for "Getting Started"');
        }
        
        if (totalSessions >= 10) {
            console.log('   ✅ Eligible for "Double Digits" badge (10+ sessions)');
        } else if (totalSessions >= 2) {
            console.log('   ⏳ Need', 10 - totalSessions, 'more sessions for "Double Digits"');
        }
        
        if (totalSessions >= 50) {
            console.log('   ✅ Eligible for "Half Century" badge (50+ sessions)');
        } else if (totalSessions >= 10) {
            console.log('   ⏳ Need', 50 - totalSessions, 'more sessions for "Half Century"');
        }
        
        // Check monthly sessions
        if (sessions && sessions.length > 0) {
            const monthlyStats = {};
            sessions.forEach(s => {
                const month = new Date(s.date).toISOString().slice(0, 7);
                monthlyStats[month] = (monthlyStats[month] || 0) + 1;
            });
            
            const maxMonthly = Math.max(...Object.values(monthlyStats));
            if (maxMonthly >= 8) {
                console.log('   ✅ Eligible for "Monthly Master" badge (8+ sessions in a month)');
            } else {
                console.log('   ⏳ Best month had', maxMonthly, 'sessions (need 8 for Monthly Master)');
            }
        }
    }
    
    // Test 5: RLS Policy Check
    console.log('\n📌 Test 5: RLS Policy Diagnostics');
    
    // Try to insert a test badge (should fail for regular users)
    const testBadgeId = 'test-badge-' + Date.now();
    const { error: insertError } = await supabase
        .from('badges')
        .insert({
            id: testBadgeId,
            name: 'Test Badge',
            description: 'Test',
            criteria: 'Test',
            icon: '🧪',
            category: 'test'
        });
    
    if (insertError) {
        if (insertError.code === '42501') {
            console.log('✅ Badge insert protection working (users cannot create badges)');
        } else {
            console.log('⚠️ Badge insert failed with unexpected error:', insertError.message);
        }
    } else {
        console.log('⚠️ Badge insert succeeded - this might be a security issue');
        // Clean up test badge
        await supabase.from('badges').delete().eq('id', testBadgeId);
    }
    
    // Summary
    console.log('\n================================');
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('================================');
    
    const issues = [];
    
    if (badgeError) {
        issues.push('Cannot read badges table (RLS issue)');
    }
    if (userBadgeError) {
        issues.push('Cannot read user badges (RLS issue)');
    }
    if (badges && badges.length === 0) {
        issues.push('No badges in database (initialization needed)');
    }
    
    if (issues.length === 0) {
        console.log('✅ Badge system appears to be working correctly!');
        console.log('\nNext steps:');
        console.log('1. If badges are missing, run restore_user_badges.sql');
        console.log('2. Clear browser cache and reload the app');
        console.log('3. Check the Dashboard and Badges pages');
    } else {
        console.log('❌ Issues detected:');
        issues.forEach(issue => console.log('   -', issue));
        console.log('\nRecommended fixes:');
        console.log('1. Run fix_badge_system_rls.sql in Supabase SQL editor');
        console.log('2. Run restore_user_badges.sql to restore missing badges');
        console.log('3. Clear browser cache and localStorage');
        console.log('4. Reload the application');
    }
    
    console.log('\n🔍 Test complete!');
})();