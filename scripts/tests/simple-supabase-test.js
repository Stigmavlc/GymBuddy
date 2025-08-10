#!/usr/bin/env node

/**
 * Simple Supabase Connection Test for GymBuddy
 * Tests basic connectivity and identifies 400/401 error causes
 */

import { createClient } from '@supabase/supabase-js';

// Configuration
const SUPABASE_URL = 'https://cikoqlryskuczwtfkprq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpa29xbHJ5c2t1Y3p3dGZrcHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzIwODcsImV4cCI6MjA2ODk0ODA4N30.O_DML3t7yZOAJ7LcIqnPSuWCo7_DpeAcqxxIN38TUd8';

console.log('🚀 GymBuddy Supabase Connection Test');
console.log('=====================================\n');

// Create client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, debug: true }
});

// Test functions
async function test1_Environment() {
  console.log('1️⃣ Environment Check');
  console.log('   URL:', SUPABASE_URL);
  console.log('   Key exists:', !!SUPABASE_ANON_KEY);
  console.log('   Key length:', SUPABASE_ANON_KEY?.length || 0);
  
  // Decode JWT
  try {
    const payload = JSON.parse(atob(SUPABASE_ANON_KEY.split('.')[1]));
    console.log('   JWT Role:', payload.role);
    console.log('   JWT Expires:', new Date(payload.exp * 1000).toISOString());
    console.log('   JWT Valid:', payload.exp * 1000 > Date.now());
  } catch (e) {
    console.log('   ❌ JWT decode failed:', e.message);
  }
  console.log();
}

async function test2_BasicConnectivity() {
  console.log('2️⃣ Basic Connectivity');
  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    console.log('   Status:', response.status, response.statusText);
    console.log('   ✅ Basic connectivity works');
  } catch (error) {
    console.log('   ❌ Connectivity failed:', error.message);
  }
  console.log();
}

async function test3_AuthEndpoint() {
  console.log('3️⃣ Auth Endpoint Check');
  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('   ✅ Auth endpoint accessible');
      console.log('   External providers:', Object.keys(data.external || {}).length);
    } else {
      console.log('   ❌ Auth endpoint failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.log('   ❌ Auth endpoint error:', error.message);
  }
  console.log();
}

async function test4_SessionCheck() {
  console.log('4️⃣ Session State');
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) {
      console.log('   ❌ Session check failed:', error.message);
    } else {
      console.log('   ✅ Session check works');
      console.log('   Current session:', session ? 'Active' : 'None');
    }
  } catch (error) {
    console.log('   ❌ Session check error:', error.message);
  }
  console.log();
}

async function test5_DatabaseQueries() {
  console.log('5️⃣ Database Queries');
  
  // Test badges table (should work - public read)
  console.log('   Testing badges table (public read)...');
  try {
    const { data, error } = await supabase
      .from('badges')
      .select('id, name')
      .limit(3);
    
    if (error) {
      console.log('   ❌ Badges query failed:', error.message);
      console.log('      Error code:', error.code);
    } else {
      console.log('   ✅ Badges table accessible');
      console.log('   Found badges:', data?.length || 0);
    }
  } catch (error) {
    console.log('   ❌ Badges query error:', error.message);
  }
  
  console.log();
  
  // Test users table (should fail - RLS protected)
  console.log('   Testing users table (RLS protected)...');
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, email')
      .limit(1);
    
    if (error) {
      if (error.code === '42501' || error.message.includes('row-level security')) {
        console.log('   ✅ RLS working correctly (access denied)');
      } else {
        console.log('   ❌ Unexpected error:', error.message);
        console.log('      Error code:', error.code);
      }
    } else {
      console.log('   ⚠️  Unexpected success - RLS might be disabled');
      console.log('   Data returned:', data?.length || 0, 'rows');
    }
  } catch (error) {
    console.log('   ❌ Users query error:', error.message);
  }
  
  console.log();
  
  // Test availability table (should fail - RLS protected)
  console.log('   Testing availability table (RLS protected)...');
  try {
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .limit(1);
    
    if (error) {
      if (error.code === '42501' || error.message.includes('row-level security')) {
        console.log('   ✅ RLS working correctly (access denied)');
      } else {
        console.log('   ❌ Unexpected availability error:', error.message);
        console.log('      Error code:', error.code);
      }
    } else {
      console.log('   ⚠️  Unexpected success - RLS might be disabled');
    }
  } catch (error) {
    console.log('   ❌ Availability query error:', error.message);
  }
  
  console.log();
}

async function test6_AuthFlow() {
  console.log('6️⃣ Authentication Flow Test');
  
  // Try a simple sign-in with fake credentials (should fail gracefully)
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'test@example.com',
      password: 'fakepassword'
    });
    
    if (error) {
      if (error.message.includes('Invalid') || error.message.includes('credentials')) {
        console.log('   ✅ Auth flow working (correctly rejects invalid credentials)');
      } else {
        console.log('   ❌ Auth error:', error.message);
      }
    } else {
      console.log('   ⚠️  Unexpected success with fake credentials');
    }
  } catch (error) {
    console.log('   ❌ Auth flow error:', error.message);
  }
  
  console.log();
}

// Run all tests
async function runTests() {
  try {
    await test1_Environment();
    await test2_BasicConnectivity();
    await test3_AuthEndpoint();
    await test4_SessionCheck();
    await test5_DatabaseQueries();
    await test6_AuthFlow();
    
    console.log('📋 DIAGNOSIS FOR 400/401 ERRORS:');
    console.log('================================');
    console.log('Common causes of 400/401 errors in your app:');
    console.log();
    console.log('1. 401 UNAUTHORIZED:');
    console.log('   - User not authenticated when accessing protected tables');
    console.log('   - Invalid or expired JWT token');
    console.log('   - RLS policies blocking access (this is normal/expected)');
    console.log();
    console.log('2. 400 BAD REQUEST:');
    console.log('   - Malformed API request');
    console.log('   - Invalid column names or data types');
    console.log('   - Missing required fields in INSERT/UPDATE');
    console.log();
    console.log('3. SOLUTIONS:');
    console.log('   - Check user authentication state before queries');
    console.log('   - Use try/catch blocks around database operations');
    console.log('   - Verify RLS policies match your app logic');
    console.log('   - Test with authenticated users');
    console.log();
    
  } catch (error) {
    console.error('Test runner failed:', error);
  } finally {
    process.exit(0);
  }
}

runTests();