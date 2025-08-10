#!/usr/bin/env node

// ========================================
// COMPREHENSIVE DATABASE CONNECTIVITY TEST
// ========================================
// 
// This script tests the Supabase database connection and RLS policies
// to ensure the authentication issues are resolved.
//
// Usage: node test-database-connectivity.js
// Make sure you have the environment variables set:
// - VITE_SUPABASE_URL
// - VITE_SUPABASE_ANON_KEY
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
  log('\n' + '='.repeat(50), 'cyan');
  log(colors.bold + message + colors.reset, 'cyan');
  log('='.repeat(50), 'cyan');
}

async function testDatabaseConnectivity() {
  header('🔍 GYMBUDDY DATABASE CONNECTIVITY TEST');
  
  // ========================================
  // STEP 1: ENVIRONMENT SETUP
  // ========================================
  
  info('🔧 Checking environment variables...');
  
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl) {
    error('VITE_SUPABASE_URL not found in environment variables');
    return false;
  }
  
  if (!supabaseAnonKey) {
    error('VITE_SUPABASE_ANON_KEY not found in environment variables');
    return false;
  }
  
  success('Environment variables found');
  info(`Supabase URL: ${supabaseUrl}`);
  info(`Anon Key Preview: ${supabaseAnonKey.substring(0, 20)}...`);
  
  // ========================================
  // STEP 2: INITIALIZE SUPABASE CLIENT
  // ========================================
  
  info('\n📡 Initializing Supabase client...');
  
  let supabase;
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false
      }
    });
    success('Supabase client initialized');
  } catch (err) {
    error('Failed to initialize Supabase client: ' + err.message);
    return false;
  }
  
  // ========================================
  // STEP 3: BASIC CONNECTIVITY TEST
  // ========================================
  
  info('\n🌐 Testing basic connectivity...');
  
  try {
    // Test basic network connectivity to Supabase
    const response = await fetch(supabaseUrl + '/rest/v1/', {
      method: 'HEAD',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': 'Bearer ' + supabaseAnonKey
      }
    });
    
    if (response.ok) {
      success(`Basic connectivity test passed (${response.status})`);
    } else {
      error(`Basic connectivity test failed with status: ${response.status}`);
      return false;
    }
  } catch (err) {
    error('Network connectivity failed: ' + err.message);
    if (err.message.includes('Failed to fetch')) {
      warning('This looks like a CORS or network configuration issue');
    }
    return false;
  }
  
  // ========================================
  // STEP 4: RLS POLICY TESTS
  // ========================================
  
  header('🔐 TESTING RLS POLICIES');
  
  // Test 1: Badges table (should be readable by authenticated users)
  info('Testing badges table access...');
  try {
    const { data: badges, error: badgesError } = await supabase
      .from('badges')
      .select('id, name')
      .limit(1);
    
    if (badgesError) {
      error('Badges query failed: ' + badgesError.message);
      if (badgesError.message.includes('infinite recursion')) {
        error('🚨 INFINITE RECURSION DETECTED in badges table RLS policies!');
      }
    } else {
      success('Badges table accessible');
      info(`Found ${badges ? badges.length : 0} badges`);
    }
  } catch (err) {
    error('Badges query exception: ' + err.message);
  }
  
  // Test 2: Challenges table (should be readable by authenticated users)
  info('\nTesting challenges table access...');
  try {
    const { data: challenges, error: challengesError } = await supabase
      .from('challenges')
      .select('id, name')
      .limit(1);
    
    if (challengesError) {
      error('Challenges query failed: ' + challengesError.message);
      if (challengesError.message.includes('infinite recursion')) {
        error('🚨 INFINITE RECURSION DETECTED in challenges table RLS policies!');
      }
    } else {
      success('Challenges table accessible');
      info(`Found ${challenges ? challenges.length : 0} challenges`);
    }
  } catch (err) {
    error('Challenges query exception: ' + err.message);
  }
  
  // Test 3: Users table (this is where the main problem was)
  info('\nTesting users table access...');
  try {
    // This should work without authentication (basic read policy)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, email, name')
      .limit(1);
    
    if (usersError) {
      error('Users query failed: ' + usersError.message);
      if (usersError.message.includes('infinite recursion')) {
        error('🚨 INFINITE RECURSION DETECTED in users table RLS policies!');
        error('The "Users can view partner profile" policy likely has circular references');
      }
      if (usersError.code === 'PGRST116') {
        warning('Users table query failed due to RLS restrictions (this may be expected for anonymous access)');
      }
    } else {
      success('Users table accessible');
      info(`Found ${users ? users.length : 0} users`);
    }
  } catch (err) {
    error('Users query exception: ' + err.message);
  }
  
  // ========================================
  // STEP 5: AUTHENTICATION FLOW TEST
  // ========================================
  
  header('🔐 TESTING AUTHENTICATION FLOW');
  
  // Test auth settings endpoint
  info('Testing auth configuration...');
  try {
    const response = await fetch(supabaseUrl + '/auth/v1/settings', {
      method: 'GET',
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': 'Bearer ' + supabaseAnonKey
      }
    });
    
    if (response.ok) {
      const settings = await response.json();
      success('Auth configuration accessible');
      info('Email signup enabled: ' + (settings.disable_signup ? 'false' : 'true'));
      info('Email confirmation required: ' + (settings.email_confirm ? 'true' : 'false'));
    } else {
      warning(`Auth settings returned status: ${response.status}`);
    }
  } catch (err) {
    warning('Auth settings check failed: ' + err.message);
  }
  
  // Test session retrieval (should not hang)
  info('\nTesting session retrieval...');
  try {
    const startTime = Date.now();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    const duration = Date.now() - startTime;
    
    if (sessionError) {
      error('Session retrieval failed: ' + sessionError.message);
    } else {
      success(`Session retrieval completed in ${duration}ms`);
      if (session) {
        info('Active session found');
      } else {
        info('No active session (expected for this test)');
      }
    }
  } catch (err) {
    error('Session retrieval exception: ' + err.message);
    if (err.message.includes('timeout') || err.message.includes('hang')) {
      error('🚨 SESSION RETRIEVAL HANGING - likely RLS infinite recursion!');
    }
  }
  
  // ========================================
  // STEP 6: TEST USER PROFILE OPERATIONS
  // ========================================
  
  header('👤 TESTING USER PROFILE OPERATIONS');
  
  info('Testing user profile creation flow...');
  
  // This tests the most common failure scenario
  try {
    // Try to read from users table with a specific user ID pattern
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .eq('email', 'test@example.com')
      .maybeSingle();
    
    if (error) {
      if (error.message.includes('infinite recursion')) {
        error('🚨 INFINITE RECURSION in user profile queries!');
        error('This blocks all authentication operations');
      } else {
        warning('User profile query failed (may be expected): ' + error.message);
      }
    } else {
      success('User profile queries working');
      if (data) {
        info('Test user found');
      } else {
        info('No test user (expected)');
      }
    }
  } catch (err) {
    error('User profile query exception: ' + err.message);
  }
  
  // ========================================
  // STEP 7: PERFORMANCE TEST
  // ========================================
  
  header('⚡ PERFORMANCE TESTS');
  
  info('Testing query performance (watching for hangs)...');
  
  const performanceTests = [
    { name: 'badges', query: () => supabase.from('badges').select('count', { count: 'exact', head: true }) },
    { name: 'challenges', query: () => supabase.from('challenges').select('count', { count: 'exact', head: true }) },
    { name: 'users', query: () => supabase.from('users').select('count', { count: 'exact', head: true }) },
  ];
  
  for (const test of performanceTests) {
    try {
      const startTime = Date.now();
      const { count, error } = await test.query();
      const duration = Date.now() - startTime;
      
      if (error) {
        error(`${test.name} count failed: ${error.message}`);
      } else if (duration > 5000) {
        warning(`${test.name} count took ${duration}ms (very slow, possible RLS issue)`);
      } else if (duration > 1000) {
        warning(`${test.name} count took ${duration}ms (slow)`);
      } else {
        success(`${test.name} count: ${count || 'N/A'} (${duration}ms)`);
      }
    } catch (err) {
      error(`${test.name} count exception: ${err.message}`);
    }
  }
  
  // ========================================
  // STEP 8: FINAL SUMMARY
  // ========================================
  
  header('📋 TEST SUMMARY');
  
  info('Database connectivity test completed');
  info('Check the results above for any errors or warnings');
  info('');
  info('If you see "infinite recursion" errors:');
  info('  1. Run the fix SQL script in your Supabase dashboard');
  info('  2. Clear your browser cache');
  info('  3. Restart your development server');
  info('');
  info('If you see CORS errors:');
  info('  1. Check Supabase dashboard Settings > API');
  info('  2. Add your domain to allowed origins');
  info('  3. Verify environment variables are correct');
  info('');
  info('For production deployment issues:');
  info('  1. Ensure environment variables are set at build time');
  info('  2. Verify the VITE_ prefix is used');
  info('  3. Check that the build includes the environment variables');
  
  return true;
}

// Main execution
testDatabaseConnectivity()
  .then(() => {
    log('\n✅ Test completed successfully', 'green');
    process.exit(0);
  })
  .catch((err) => {
    log('\n❌ Test failed: ' + err.message, 'red');
    console.error(err);
    process.exit(1);
  });

export { testDatabaseConnectivity };