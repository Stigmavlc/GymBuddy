#!/usr/bin/env node

/**
 * RLS Policy Diagnosis Script
 * This script checks the current RLS policies and suggests fixes
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cikoqlryskuczwtfkprq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpa29xbHJ5c2t1Y3p3dGZrcHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMzNzIwODcsImV4cCI6MjA2ODk0ODA4N30.O_DML3t7yZOAJ7LcIqnPSuWCo7_DpeAcqxxIN38TUd8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, debug: false }
});

console.log('🔒 RLS Policy Diagnosis for GymBuddy');
console.log('====================================\n');

async function testTableAccess(tableName, shouldBeBlocked = true) {
  console.log(`Testing ${tableName} table...`);
  
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      if (error.code === '42501' || error.message.includes('row-level security')) {
        console.log(`   ✅ RLS working: ${error.message}`);
        return 'protected';
      } else {
        console.log(`   ❌ Unexpected error: ${error.code} - ${error.message}`);
        return 'error';
      }
    } else {
      if (shouldBeBlocked) {
        console.log(`   🚨 SECURITY ISSUE: Table accessible without authentication!`);
        console.log(`      Found ${count} total rows, returned ${data?.length || 0} rows`);
        return 'unprotected';
      } else {
        console.log(`   ✅ Public table accessible as expected`);
        console.log(`      Found ${count} total rows`);
        return 'public';
      }
    }
  } catch (error) {
    console.log(`   ❌ Query error: ${error.message}`);
    return 'error';
  }
}

async function diagnoseRLS() {
  const results = {
    users: null,
    availability: null,
    sessions: null,
    badges: null,
    user_badges: null,
    challenges: null,
    user_challenges: null
  };
  
  // Test all tables
  results.users = await testTableAccess('users', true);
  console.log();
  
  results.availability = await testTableAccess('availability', true);
  console.log();
  
  results.sessions = await testTableAccess('sessions', true);
  console.log();
  
  results.badges = await testTableAccess('badges', false); // Should be public
  console.log();
  
  results.user_badges = await testTableAccess('user_badges', true);
  console.log();
  
  results.challenges = await testTableAccess('challenges', false); // Should be public
  console.log();
  
  results.user_challenges = await testTableAccess('user_challenges', true);
  console.log();
  
  // Analysis
  console.log('📊 RLS ANALYSIS:');
  console.log('================');
  
  const unprotectedTables = Object.entries(results)
    .filter(([table, status]) => status === 'unprotected')
    .map(([table]) => table);
    
  const errorTables = Object.entries(results)
    .filter(([table, status]) => status === 'error')
    .map(([table]) => table);
  
  if (unprotectedTables.length > 0) {
    console.log('\n🚨 CRITICAL SECURITY ISSUES:');
    unprotectedTables.forEach(table => {
      console.log(`   - ${table} table is not protected by RLS`);
    });
    
    console.log('\n🔧 IMMEDIATE FIXES NEEDED:');
    console.log('Run the following SQL commands in your Supabase SQL editor:');
    console.log();
    
    if (unprotectedTables.includes('users')) {
      console.log('-- Fix users table RLS');
      console.log('ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;');
      console.log('DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;');
      console.log('CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT USING (auth.uid() = id);');
      console.log('CREATE POLICY "Users can update their own profile" ON public.users FOR UPDATE USING (auth.uid() = id);');
      console.log('CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);');
      console.log();
    }
    
    if (unprotectedTables.includes('availability')) {
      console.log('-- Fix availability table RLS');
      console.log('ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;');
      console.log('DROP POLICY IF EXISTS "Users can manage their own availability" ON public.availability;');
      console.log('CREATE POLICY "Users can manage their own availability" ON public.availability FOR ALL USING (auth.uid() = user_id);');
      console.log();
    }
    
    if (unprotectedTables.includes('sessions')) {
      console.log('-- Fix sessions table RLS');
      console.log('ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;');
      console.log('DROP POLICY IF EXISTS "Users can view their own sessions" ON public.sessions;');
      console.log('CREATE POLICY "Users can view their own sessions" ON public.sessions FOR SELECT USING (auth.uid() = ANY(participants));');
      console.log('CREATE POLICY "Users can create sessions they participate in" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = ANY(participants));');
      console.log('CREATE POLICY "Users can update sessions they participate in" ON public.sessions FOR UPDATE USING (auth.uid() = ANY(participants));');
      console.log();
    }
    
    if (unprotectedTables.includes('user_badges')) {
      console.log('-- Fix user_badges table RLS');
      console.log('ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;');
      console.log('DROP POLICY IF EXISTS "Users can view their own badges" ON public.user_badges;');
      console.log('CREATE POLICY "Users can view their own badges" ON public.user_badges FOR SELECT USING (auth.uid() = user_id);');
      console.log();
    }
    
    if (unprotectedTables.includes('user_challenges')) {
      console.log('-- Fix user_challenges table RLS');
      console.log('ALTER TABLE public.user_challenges ENABLE ROW LEVEL SECURITY;');
      console.log('DROP POLICY IF EXISTS "Users can manage their own challenge progress" ON public.user_challenges;');
      console.log('CREATE POLICY "Users can manage their own challenge progress" ON public.user_challenges FOR ALL USING (auth.uid() = user_id);');
      console.log();
    }
  }
  
  if (errorTables.length > 0) {
    console.log('\n⚠️  TABLES WITH ERRORS:');
    errorTables.forEach(table => {
      console.log(`   - ${table} table returned unexpected errors`);
    });
  }
  
  console.log('\n💡 ROOT CAUSE OF 400/401 ERRORS:');
  console.log('=================================');
  
  if (unprotectedTables.length > 0) {
    console.log('Your app is experiencing 400/401 errors because:');
    console.log();
    console.log('1. RLS policies are not properly enforced');
    console.log('2. Frontend code expects authentication-based access control');
    console.log('3. Some queries work (unprotected tables) while others fail');
    console.log('4. This creates inconsistent behavior leading to errors');
    console.log();
    console.log('SOLUTION: Enable and fix RLS policies as shown above.');
    console.log();
  } else {
    console.log('RLS policies appear to be working correctly.');
    console.log('400/401 errors might be caused by:');
    console.log('1. Frontend authentication state issues');
    console.log('2. Invalid query parameters or malformed requests');
    console.log('3. JWT token expiration or corruption');
    console.log('4. Network/CORS configuration problems');
    console.log();
  }
  
  return {
    unprotectedTables,
    errorTables,
    totalIssues: unprotectedTables.length + errorTables.length
  };
}

// Run diagnosis
diagnoseRLS()
  .then((results) => {
    if (results.totalIssues === 0) {
      console.log('🎉 All RLS policies are working correctly!');
      process.exit(0);
    } else {
      console.log(`🚨 Found ${results.totalIssues} RLS policy issues that need immediate attention.`);
      process.exit(1);
    }
  })
  .catch((error) => {
    console.error('💥 Diagnosis failed:', error);
    process.exit(1);
  });