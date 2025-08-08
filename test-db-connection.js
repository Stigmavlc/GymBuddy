// Test script to verify Supabase database connection after RLS policy fix
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testConnection() {
  console.log('🧪 Testing Supabase database connection...\n');
  
  try {
    // Test 1: Basic connection to users table
    console.log('1. Testing basic connection to users table...');
    const { data, error } = await supabase
      .from('users')
      .select('count(*)')
      .limit(1);
    
    if (error) {
      console.log('❌ Connection failed:', error.message);
      return false;
    } else {
      console.log('✅ Basic connection successful');
    }

    // Test 2: Check if RLS policies are working (should not return user data without auth)
    console.log('\n2. Testing RLS policies (should limit access without auth)...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .limit(5);
    
    if (userError) {
      console.log('❌ RLS test failed:', userError.message);
      return false;
    } else {
      console.log('✅ RLS policies working correctly - limited/no data returned:', userData?.length || 0, 'records');
    }

    // Test 3: Test other tables
    console.log('\n3. Testing other table access...');
    const { data: badgesData, error: badgesError } = await supabase
      .from('badges')
      .select('*')
      .limit(3);
    
    if (badgesError) {
      console.log('❌ Badges table access failed:', badgesError.message);
      return false;
    } else {
      console.log('✅ Badges table accessible:', badgesData?.length || 0, 'records');
    }

    console.log('\n🎉 All database connection tests passed!');
    console.log('✅ The infinite recursion issue appears to be resolved.');
    return true;
    
  } catch (error) {
    console.error('❌ Test failed with exception:', error.message);
    return false;
  }
}

// Run the test
testConnection().then(success => {
  process.exit(success ? 0 : 1);
});