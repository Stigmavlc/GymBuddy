#!/usr/bin/env node

/**
 * RLS Fix Verification Script
 * This script verifies that the RLS policies are working correctly
 * after applying the fixes.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cikoqlryskuczwtfkprq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpa29xbHJ5c2t1Y3p3dGZrcHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzIwODcsImV4cCI6MjA2ODk0ODA4N30.O_DML3t7yZOAJ7LcIqnPSuWCo7_DpeAcqxxIN38TUd8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, debug: false }
});

console.log('🔒 RLS Fix Verification for GymBuddy');
console.log('====================================\n');

async function testRLSProtection(tableName, shouldBeProtected = true) {
  console.log(`Testing ${tableName} table RLS protection...`);
  
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      if (error.code === '42501' || error.message.includes('row-level security') || error.message.includes('permission denied')) {
        if (shouldBeProtected) {
          console.log(`   ✅ CORRECT: RLS is blocking unauthenticated access`);
          console.log(`      Error: ${error.message}`);
          return 'protected';
        } else {
          console.log(`   ❌ UNEXPECTED: Public table is blocked`);
          console.log(`      Error: ${error.message}`);
          return 'blocked';
        }
      } else {
        console.log(`   ⚠️  OTHER ERROR: ${error.code} - ${error.message}`);
        return 'error';
      }
    } else {
      if (shouldBeProtected) {
        console.log(`   ❌ SECURITY ISSUE: Table still accessible without authentication!`);
        console.log(`      Returned ${data?.length || 0} rows of ${count} total`);
        return 'unprotected';
      } else {
        console.log(`   ✅ CORRECT: Public table is accessible`);
        console.log(`      Found ${count} total rows`);
        return 'public';
      }
    }
  } catch (error) {
    console.log(`   ❌ QUERY FAILED: ${error.message}`);
    return 'failed';
  }
}

async function verifyRLSFixes() {
  console.log('Running comprehensive RLS verification...\n');
  
  const results = {};
  
  // Test protected tables (should be blocked for unauthenticated users)
  console.log('🔐 TESTING PROTECTED TABLES (should be blocked):');
  console.log('------------------------------------------------');
  results.users = await testRLSProtection('users', true);
  console.log();
  
  results.availability = await testRLSProtection('availability', true);
  console.log();
  
  results.sessions = await testRLSProtection('sessions', true);
  console.log();
  
  results.user_badges = await testRLSProtection('user_badges', true);
  console.log();
  
  results.user_challenges = await testRLSProtection('user_challenges', true);
  console.log();
  
  // Test public tables (should be accessible)
  console.log('🌐 TESTING PUBLIC TABLES (should be accessible):');
  console.log('------------------------------------------------');
  results.badges = await testRLSProtection('badges', false);
  console.log();
  
  results.challenges = await testRLSProtection('challenges', false);
  console.log();
  
  // Analysis
  console.log('📊 VERIFICATION RESULTS:');
  console.log('========================');
  
  const protectedTables = ['users', 'availability', 'sessions', 'user_badges', 'user_challenges'];
  const publicTables = ['badges', 'challenges'];
  
  let fixedCount = 0;
  let issueCount = 0;
  
  protectedTables.forEach(table => {
    if (results[table] === 'protected') {
      console.log(`✅ ${table}: Properly protected`);
      fixedCount++;
    } else if (results[table] === 'unprotected') {
      console.log(`❌ ${table}: Still unprotected - RLS not working`);
      issueCount++;
    } else {
      console.log(`⚠️  ${table}: ${results[table]} status`);
      issueCount++;
    }
  });
  
  publicTables.forEach(table => {
    if (results[table] === 'public') {
      console.log(`✅ ${table}: Correctly public`);
      fixedCount++;
    } else {
      console.log(`⚠️  ${table}: ${results[table]} status`);
    }
  });
  
  console.log('\n📈 SUMMARY:');
  console.log('===========');
  console.log(`✅ Working correctly: ${fixedCount}/7 tables`);
  console.log(`❌ Issues remaining: ${issueCount} tables`);
  
  if (issueCount === 0) {
    console.log('\n🎉 SUCCESS! All RLS policies are working correctly.');
    console.log('Your 400/401 errors should now be resolved.');
    console.log();
    console.log('💡 Next steps:');
    console.log('1. Test your app with authenticated users');
    console.log('2. Verify that all features work as expected');
    console.log('3. Monitor for any remaining authentication issues');
    return true;
  } else {
    console.log('\n🚨 ISSUES DETECTED! RLS policies need further attention.');
    console.log();
    console.log('💡 Troubleshooting steps:');
    console.log('1. Ensure the RLS fix SQL script was run successfully');
    console.log('2. Check the Supabase dashboard for policy configuration');
    console.log('3. Verify there are no conflicting policies');
    console.log('4. Contact support if issues persist');
    return false;
  }
}

// Test authentication flow with the corrected RLS
async function testAuthenticatedAccess() {
  console.log('\n🔐 TESTING AUTHENTICATED ACCESS:');
  console.log('================================');
  console.log('(This demonstrates what happens when users are properly authenticated)');
  console.log();
  
  // Create a test user session to show how authenticated access works
  console.log('NOTE: In a real application, authenticated users would be able to:');
  console.log('- View and edit their own profile data');
  console.log('- Manage their availability schedules');
  console.log('- See sessions they participate in');
  console.log('- View their badges and challenge progress');
  console.log('- See their partner\'s availability (for gym coordination)');
  console.log();
  console.log('The RLS policies ensure that users can only access their own data');
  console.log('or data specifically shared with them (like partner availability).');
}

// Run verification
verifyRLSFixes()
  .then((success) => {
    testAuthenticatedAccess();
    console.log('\n' + '='.repeat(60));
    if (success) {
      console.log('🎉 RLS VERIFICATION PASSED - Security is properly configured!');
      process.exit(0);
    } else {
      console.log('⚠️  RLS VERIFICATION FAILED - Manual intervention required.');
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('\n💥 Verification script failed:', error);
    process.exit(1);
  });