#!/usr/bin/env node

/**
 * Comprehensive Supabase Connection and RLS Policy Test
 * 
 * This script tests:
 * 1. Basic Supabase connectivity
 * 2. Authentication endpoints
 * 3. RLS policies for availability table
 * 4. User table access patterns
 * 5. Database health check
 * 
 * For user: Ivan (ivanaguilarmari@gmail.com)
 * Environment: https://cikoqlryskuczwtfkprq.supabase.co
 */

import { createClient } from '@supabase/supabase-js';

// Environment configuration
const SUPABASE_URL = 'https://cikoqlryskuczwtfkprq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpa29xbHJ5c2t1Y3p3dGZrcHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzIwODcsImV4cCI6MjA2ODk0ODA4N30.O_DML3t7yZOAJ7LcIqnPSuWCo7_DpeAcqxxIN38TUd8';

// Test user details
const TEST_USER_EMAIL = 'ivanaguilarmari@gmail.com';

// Global test results
let testResults = {
  totalTests: 0,
  passedTests: 0,
  failedTests: 0,
  errors: [],
  warnings: []
};

// Utility functions
function logTest(testName, status, details = '') {
  testResults.totalTests++;
  const statusIcon = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⚠️';
  console.log(`${statusIcon} ${testName}: ${status}`);
  
  if (details) {
    console.log(`   ${details}`);
  }
  
  if (status === 'PASS') {
    testResults.passedTests++;
  } else if (status === 'FAIL') {
    testResults.failedTests++;
    testResults.errors.push(`${testName}: ${details || 'Failed'}`);
  } else {
    testResults.warnings.push(`${testName}: ${details || 'Warning'}`);
  }
}

function logSection(sectionName) {
  console.log(`\n🔍 ${sectionName}`);
  console.log('─'.repeat(50));
}

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    debug: true,
    persistSession: false,
    autoRefreshToken: false
  }
});

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test 1: Environment and Configuration Check
async function testEnvironmentSetup() {
  logSection('Environment and Configuration Check');
  
  try {
    // Check URL format
    const urlPattern = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;
    if (urlPattern.test(SUPABASE_URL)) {
      logTest('Supabase URL Format', 'PASS', `Valid URL: ${SUPABASE_URL}`);
    } else {
      logTest('Supabase URL Format', 'FAIL', `Invalid URL format: ${SUPABASE_URL}`);
    }
    
    // Check key format (JWT)
    const keyPattern = /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    if (keyPattern.test(SUPABASE_ANON_KEY)) {
      logTest('Anon Key Format', 'PASS', 'Valid JWT format');
    } else {
      logTest('Anon Key Format', 'FAIL', 'Invalid JWT format');
    }
    
    // Decode and check JWT payload
    try {
      const payload = JSON.parse(atob(SUPABASE_ANON_KEY.split('.')[1]));
      logTest('JWT Payload', 'PASS', `Role: ${payload.role}, Expires: ${new Date(payload.exp * 1000).toISOString()}`);
      
      // Check expiry
      if (payload.exp * 1000 > Date.now()) {
        logTest('JWT Expiry', 'PASS', `Token valid until ${new Date(payload.exp * 1000).toISOString()}`);
      } else {
        logTest('JWT Expiry', 'FAIL', 'Token has expired');
      }
    } catch (error) {
      logTest('JWT Decode', 'FAIL', `Unable to decode JWT: ${error.message}`);
    }
    
  } catch (error) {
    logTest('Environment Setup', 'FAIL', error.message);
  }
}

// Test 2: Basic Connectivity
async function testBasicConnectivity() {
  logSection('Basic Connectivity Test');
  
  try {
    // Test basic HTTP connectivity
    const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      timeout: 10000
    });
    
    if (response.status === 404 || response.ok) {
      logTest('HTTP Connectivity', 'PASS', `Response: ${response.status} ${response.statusText}`);
    } else {
      logTest('HTTP Connectivity', 'FAIL', `Response: ${response.status} ${response.statusText}`);
    }
    
    // Check CORS headers
    const corsOrigin = response.headers.get('access-control-allow-origin');
    if (corsOrigin === '*' || corsOrigin) {
      logTest('CORS Configuration', 'PASS', `Allow-Origin: ${corsOrigin || 'null'}`);
    } else {
      logTest('CORS Configuration', 'WARN', 'No CORS headers found');
    }
    
  } catch (error) {
    logTest('Basic Connectivity', 'FAIL', error.message);
  }
}

// Test 3: Authentication Endpoints
async function testAuthenticationEndpoints() {
  logSection('Authentication Endpoints Test');
  
  try {
    // Test auth settings endpoint
    const authResponse = await fetch(`${SUPABASE_URL}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (authResponse.ok) {
      const authData = await authResponse.json();
      logTest('Auth Settings Endpoint', 'PASS', `External providers: ${Object.keys(authData.external || {}).length}`);
    } else {
      logTest('Auth Settings Endpoint', 'FAIL', `${authResponse.status} ${authResponse.statusText}`);
    }
    
    // Test session endpoint (should return null for unauthenticated)
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    if (!sessionError && session.session === null) {
      logTest('Session Check', 'PASS', 'No active session (expected for unauthenticated)');
    } else if (sessionError) {
      logTest('Session Check', 'FAIL', sessionError.message);
    } else {
      logTest('Session Check', 'WARN', 'Unexpected active session');
    }
    
  } catch (error) {
    logTest('Authentication Endpoints', 'FAIL', error.message);
  }
}

// Test 4: Database Connectivity and Basic Queries
async function testDatabaseConnectivity() {
  logSection('Database Connectivity Test');
  
  try {
    // Test connection to users table (should fail due to RLS without auth)
    const { data, error, count } = await supabase
      .from('users')
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      // Expected for RLS-protected table without authentication
      if (error.code === '42501' || error.message.includes('row-level security')) {
        logTest('Users Table RLS', 'PASS', 'RLS is correctly blocking unauthenticated access');
      } else {
        logTest('Users Table Query', 'FAIL', `${error.code}: ${error.message}`);
      }
    } else {
      logTest('Users Table Query', 'WARN', 'Unexpected success - RLS might be misconfigured');
    }
    
    // Test badges table (should be readable by anyone according to schema)
    const { data: badgesData, error: badgesError } = await supabase
      .from('badges')
      .select('id, name')
      .limit(5);
    
    if (!badgesError && badgesData) {
      logTest('Badges Table Read', 'PASS', `Found ${badgesData.length} badges`);
    } else if (badgesError) {
      logTest('Badges Table Read', 'FAIL', badgesError.message);
    }
    
  } catch (error) {
    logTest('Database Connectivity', 'FAIL', error.message);
  }
}

// Test 5: RLS Policies Analysis
async function testRLSPolicies() {
  logSection('Row-Level Security Policies Test');
  
  try {
    // Test availability table (should be blocked without auth)
    const { data: availabilityData, error: availabilityError } = await supabase
      .from('availability')
      .select('*')
      .limit(1);
    
    if (availabilityError) {
      if (availabilityError.code === '42501' || availabilityError.message.includes('row-level security')) {
        logTest('Availability Table RLS', 'PASS', 'RLS correctly blocking unauthenticated access');
      } else {
        logTest('Availability Table RLS', 'FAIL', `Unexpected error: ${availabilityError.message}`);
      }
    } else {
      logTest('Availability Table RLS', 'FAIL', 'RLS not working - unauthenticated access allowed');
    }
    
    // Test sessions table (should be blocked without auth)
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('sessions')
      .select('*')
      .limit(1);
    
    if (sessionsError) {
      if (sessionsError.code === '42501' || sessionsError.message.includes('row-level security')) {
        logTest('Sessions Table RLS', 'PASS', 'RLS correctly blocking unauthenticated access');
      } else {
        logTest('Sessions Table RLS', 'FAIL', `Unexpected error: ${sessionsError.message}`);
      }
    } else {
      logTest('Sessions Table RLS', 'FAIL', 'RLS not working - unauthenticated access allowed');
    }
    
  } catch (error) {
    logTest('RLS Policies', 'FAIL', error.message);
  }
}

// Test 6: Authentication Flow Test
async function testAuthenticationFlow() {
  logSection('Authentication Flow Test');
  
  try {
    // Test sign-up with a test email (this should work but we won't confirm)
    const testEmail = `test-${Date.now()}@example.com`;
    const testPassword = 'TestPassword123!';
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword
    });
    
    if (!signUpError && signUpData.user) {
      logTest('Sign-up Flow', 'PASS', 'Sign-up endpoint accessible');
      
      // Clean up by attempting to sign out
      await supabase.auth.signOut();
      
    } else if (signUpError) {
      // Check if it's a rate limiting or expected error
      if (signUpError.message.includes('rate') || signUpError.message.includes('limit')) {
        logTest('Sign-up Flow', 'WARN', 'Rate limited (normal protection)');
      } else {
        logTest('Sign-up Flow', 'FAIL', signUpError.message);
      }
    }
    
  } catch (error) {
    logTest('Authentication Flow', 'FAIL', error.message);
  }
}

// Test 7: Health Check and Performance
async function testHealthAndPerformance() {
  logSection('Health Check and Performance Test');
  
  try {
    // Test response time for different endpoints
    const endpoints = [
      { name: 'REST API', url: `${SUPABASE_URL}/rest/v1/` },
      { name: 'Auth API', url: `${SUPABASE_URL}/auth/v1/settings` },
    ];
    
    for (const endpoint of endpoints) {
      const startTime = Date.now();
      try {
        const response = await fetch(endpoint.url, {
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          },
          timeout: 5000
        });
        const responseTime = Date.now() - startTime;
        
        if (responseTime < 1000) {
          logTest(`${endpoint.name} Response Time`, 'PASS', `${responseTime}ms`);
        } else if (responseTime < 3000) {
          logTest(`${endpoint.name} Response Time`, 'WARN', `${responseTime}ms (slow)`);
        } else {
          logTest(`${endpoint.name} Response Time`, 'FAIL', `${responseTime}ms (too slow)`);
        }
      } catch (error) {
        logTest(`${endpoint.name} Response Time`, 'FAIL', error.message);
      }
    }
    
  } catch (error) {
    logTest('Health Check', 'FAIL', error.message);
  }
}

// Test 8: Error Simulation (Common 400/401 scenarios)
async function testCommonErrors() {
  logSection('Common Error Scenarios Test');
  
  try {
    // Test with invalid API key
    const invalidClient = createClient(SUPABASE_URL, 'invalid-key');
    const { data, error } = await invalidClient.from('badges').select('*').limit(1);
    
    if (error && (error.message.includes('Invalid API key') || error.message.includes('JWT'))) {
      logTest('Invalid API Key Handling', 'PASS', 'Correctly rejects invalid keys');
    } else {
      logTest('Invalid API Key Handling', 'FAIL', 'Should reject invalid API keys');
    }
    
    // Test malformed request
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: 'invalid-json'
      });
      
      if (response.status >= 400) {
        logTest('Malformed Request Handling', 'PASS', `Correctly returns ${response.status}`);
      } else {
        logTest('Malformed Request Handling', 'FAIL', 'Should reject malformed requests');
      }
    } catch (error) {
      logTest('Malformed Request Handling', 'PASS', 'Network layer correctly handles errors');
    }
    
  } catch (error) {
    logTest('Common Error Scenarios', 'FAIL', error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 GymBuddy Supabase Connection and RLS Policy Test');
  console.log('━'.repeat(70));
  console.log(`📅 Test Date: ${new Date().toISOString()}`);
  console.log(`🌐 Supabase URL: ${SUPABASE_URL}`);
  console.log(`👤 Test User: ${TEST_USER_EMAIL}`);
  console.log('━'.repeat(70));
  
  // Run all test suites
  await testEnvironmentSetup();
  await sleep(500);
  
  await testBasicConnectivity();
  await sleep(500);
  
  await testAuthenticationEndpoints();
  await sleep(500);
  
  await testDatabaseConnectivity();
  await sleep(500);
  
  await testRLSPolicies();
  await sleep(500);
  
  await testAuthenticationFlow();
  await sleep(500);
  
  await testHealthAndPerformance();
  await sleep(500);
  
  await testCommonErrors();
  
  // Final results
  console.log('\n📊 TEST RESULTS SUMMARY');
  console.log('━'.repeat(50));
  console.log(`✅ Passed: ${testResults.passedTests}/${testResults.totalTests}`);
  console.log(`❌ Failed: ${testResults.failedTests}/${testResults.totalTests}`);
  console.log(`⚠️  Warnings: ${testResults.warnings.length}`);
  
  if (testResults.failedTests === 0) {
    console.log('\n🎉 ALL TESTS PASSED! Supabase connection is healthy.');
  } else {
    console.log('\n🚨 ISSUES DETECTED:');
    testResults.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }
  
  if (testResults.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    testResults.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }
  
  // Recommendations
  console.log('\n💡 RECOMMENDATIONS FOR 400/401 ERRORS:');
  console.log('   1. Check browser console for specific error messages');
  console.log('   2. Verify authentication state before making requests');
  console.log('   3. Ensure RLS policies match your application logic');
  console.log('   4. Use service role key for admin operations');
  console.log('   5. Check CORS configuration in Supabase dashboard');
  
  // Return overall status
  return {
    success: testResults.failedTests === 0,
    passed: testResults.passedTests,
    failed: testResults.failedTests,
    warnings: testResults.warnings.length,
    errors: testResults.errors
  };
}

// Check if this script is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllTests()
    .then((results) => {
      process.exit(results.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Test runner crashed:', error);
      process.exit(1);
    });
}

export { runAllTests };