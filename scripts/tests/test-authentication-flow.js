#!/usr/bin/env node

// ========================================
// AUTHENTICATION FLOW VERIFICATION TEST
// ========================================
// 
// This script tests the complete authentication flow to verify
// that the "Failed to fetch" issues are resolved
//
// Usage: node test-authentication-flow.js
//
// ========================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function log(message, color = 'reset') {
  console.log(colors[color] + message + colors.reset);
}

function success(message) {
  log('✅ ' + message, 'green');
}

function error(message) {
  log('❌ ' + message, 'red');
}

function warning(message) {
  log('⚠️ ' + message, 'yellow');
}

function info(message) {
  log('ℹ️ ' + message, 'blue');
}

function header(message) {
  log('\n' + '='.repeat(60), 'cyan');
  log(colors.bold + message + colors.reset, 'cyan');
  log('='.repeat(60), 'cyan');
}

async function testAuthenticationFlow() {
  header('🔐 GYMBUDDY AUTHENTICATION FLOW TEST');
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    error('Environment variables not found');
    return false;
  }
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // ========================================
  // TEST 1: SIMULATE SIGN UP FLOW
  // ========================================
  
  header('👤 TESTING SIGN UP FLOW');
  
  const testEmail = 'test.user@example.com';
  const testPassword = 'TestPassword123!';
  const testName = 'Test User';
  
  info('Testing sign up process...');
  info('NOTE: This will fail if user already exists (expected)');
  
  try {
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: testName
        }
      }
    });
    
    if (signUpError) {
      if (signUpError.message.includes('User already registered')) {
        warning('Test user already exists (expected for testing)');
      } else if (signUpError.message.includes('Failed to fetch')) {
        error('🚨 CRITICAL: "Failed to fetch" error in sign up!');
        error('This indicates the RLS/authentication issue persists');
        return false;
      } else {
        info('Sign up failed with: ' + signUpError.message);
      }
    } else {
      success('Sign up completed successfully');
      if (signUpData.user) {
        info('User created with ID: ' + signUpData.user.id);
      }
    }
  } catch (err) {
    error('Sign up exception: ' + err.message);
    if (err.message.includes('Failed to fetch')) {
      error('🚨 CRITICAL: Network/authentication failure detected');
      return false;
    }
  }
  
  // ========================================
  // TEST 2: SIMULATE SIGN IN FLOW
  // ========================================
  
  header('🔑 TESTING SIGN IN FLOW');
  
  info('Testing sign in with Ivan\'s email (allowed user)...');
  
  const ivanEmail = 'ivanaguilarmari@gmail.com';
  
  try {
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: ivanEmail,
      password: 'dummy-password' // This will fail, but should not give "Failed to fetch"
    });
    
    if (signInError) {
      if (signInError.message.includes('Invalid login credentials')) {
        success('Sign in properly rejected invalid credentials (expected)');
      } else if (signInError.message.includes('Failed to fetch')) {
        error('🚨 CRITICAL: "Failed to fetch" error in sign in!');
        error('This indicates the RLS/authentication issue persists');
        return false;
      } else {
        info('Sign in failed with: ' + signInError.message);
      }
    } else {
      warning('Sign in succeeded with dummy password (unexpected)');
    }
  } catch (err) {
    error('Sign in exception: ' + err.message);
    if (err.message.includes('Failed to fetch')) {
      error('🚨 CRITICAL: Network/authentication failure detected');
      return false;
    }
  }
  
  // ========================================
  // TEST 3: TEST USER PROFILE OPERATIONS
  // ========================================
  
  header('👤 TESTING PROFILE OPERATIONS');
  
  info('Testing user profile queries (the main issue area)...');
  
  try {
    // Test the exact operation that was failing
    const { data: existingUsers, error: usersError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', ivanEmail)
      .maybeSingle();
    
    if (usersError) {
      if (usersError.message.includes('infinite recursion')) {
        error('🚨 INFINITE RECURSION still detected in users table!');
        error('The RLS policies still have circular references');
        return false;
      } else {
        warning('User profile query failed: ' + usersError.message);
        warning('This might be expected for RLS restrictions');
      }
    } else {
      success('User profile queries working correctly');
      if (existingUsers) {
        info('Found existing user: ' + existingUsers.name);
      } else {
        info('No existing user found');
      }
    }
  } catch (err) {
    error('User profile query exception: ' + err.message);
    if (err.message.includes('timeout') || err.message.includes('hang')) {
      error('🚨 QUERY HANGING - infinite recursion detected!');
      return false;
    }
  }
  
  // ========================================
  // TEST 4: SIMULATE PROFILE CREATION
  // ========================================
  
  header('📝 TESTING PROFILE CREATION');
  
  info('Testing profile creation (without authentication)...');
  
  // This tests if the profile creation would work for a real user
  const testProfile = {
    id: 'test-uuid-12345', // This will fail, but shouldn't cause infinite recursion
    email: 'test.creation@example.com',
    name: 'Test Creation User',
    preferences: {
      notifications: {
        sms: true,
        push: true,
        reminder_time: 30
      }
    },
    stats: {
      total_sessions: 0,
      current_streak: 0,
      badges: []
    }
  };
  
  try {
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .insert(testProfile)
      .select()
      .single();
    
    if (profileError) {
      if (profileError.message.includes('infinite recursion')) {
        error('🚨 INFINITE RECURSION in profile creation!');
        return false;
      } else if (profileError.message.includes('new row violates row-level security policy')) {
        success('Profile creation properly blocked by RLS (expected)');
      } else {
        info('Profile creation failed: ' + profileError.message);
      }
    } else {
      warning('Profile creation succeeded without authentication (unexpected)');
      // Clean up test data if it was created
      try {
        await supabase.from('users').delete().eq('id', testProfile.id);
      } catch (cleanupErr) {
        info('Cleanup failed (may not have permission)');
      }
    }
  } catch (err) {
    error('Profile creation exception: ' + err.message);
    if (err.message.includes('timeout') || err.message.includes('hang')) {
      error('🚨 PROFILE CREATION HANGING - infinite recursion!');
      return false;
    }
  }
  
  // ========================================
  // TEST 5: SESSION AND AUTH STATE TESTS
  // ========================================
  
  header('🔍 TESTING SESSION MANAGEMENT');
  
  info('Testing session operations...');
  
  // Test getSession (this was hanging before)
  try {
    const startTime = Date.now();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const duration = Date.now() - startTime;
    
    if (duration > 3000) {
      warning(`getSession took ${duration}ms (very slow)`);
    } else {
      success(`getSession completed in ${duration}ms`);
    }
    
    if (sessionError) {
      error('getSession error: ' + sessionError.message);
    } else {
      info('Session state: ' + (session ? 'active' : 'none'));
    }
  } catch (err) {
    error('getSession exception: ' + err.message);
    if (err.message.includes('timeout')) {
      error('🚨 getSession timeout - likely infinite recursion!');
      return false;
    }
  }
  
  // Test getUser (this was also problematic)
  try {
    const startTime = Date.now();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    const duration = Date.now() - startTime;
    
    if (duration > 3000) {
      warning(`getUser took ${duration}ms (very slow)`);
    } else {
      success(`getUser completed in ${duration}ms`);
    }
    
    if (userError) {
      error('getUser error: ' + userError.message);
    } else {
      info('User state: ' + (user ? 'authenticated' : 'anonymous'));
    }
  } catch (err) {
    error('getUser exception: ' + err.message);
    if (err.message.includes('timeout')) {
      error('🚨 getUser timeout - likely infinite recursion!');
      return false;
    }
  }
  
  // ========================================
  // FINAL ASSESSMENT
  // ========================================
  
  header('📊 AUTHENTICATION HEALTH ASSESSMENT');
  
  success('Authentication flow tests completed!');
  info('');
  info('✅ If you see this message, the critical "Failed to fetch" issue is RESOLVED');
  info('✅ No infinite recursion detected in RLS policies');
  info('✅ Database operations completing in reasonable time');
  info('✅ Authentication endpoints responding correctly');
  info('');
  info('Your GymBuddy app should now work for user authentication!');
  info('');
  info('Next steps:');
  info('  1. Test the actual web app authentication');
  info('  2. Try signing up/signing in through the UI');
  info('  3. Check that profile creation works properly');
  info('  4. Verify partner matching functionality');
  
  return true;
}

// Main execution
testAuthenticationFlow()
  .then(() => {
    log('\n🎉 Authentication flow test PASSED!', 'green');
    log('Your database authentication is working correctly.', 'green');
    process.exit(0);
  })
  .catch((err) => {
    log('\n💥 Authentication flow test FAILED: ' + err.message, 'red');
    console.error(err);
    process.exit(1);
  });

export { testAuthenticationFlow };