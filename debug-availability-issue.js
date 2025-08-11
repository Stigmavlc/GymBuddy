// Debug script to investigate availability and badge issues
// Run this in browser console after logging in to GymBuddy

console.log('🔍 GymBuddy Debug - Investigating Availability and Badge Issues');

// Check if we have access to the supabase client
if (typeof window !== 'undefined' && window.supabase) {
  const supabase = window.supabase;
  
  async function debugAvailabilityIssue() {
    console.log('\n📋 === AVAILABILITY DEBUG SESSION ===');
    
    try {
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error('❌ No authenticated user found:', userError);
        return;
      }
      
      console.log('✅ Current user:', { id: user.id, email: user.email });
      
      // Test direct availability query
      console.log('\n🔍 Testing direct availability query...');
      const { data: availabilityData, error: availabilityError, status } = await supabase
        .from('availability')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      console.log('📊 Availability Query Result:', {
        data: availabilityData,
        error: availabilityError,
        status: status,
        count: availabilityData?.length || 0
      });
      
      if (availabilityError) {
        console.error('❌ Availability query error details:', {
          message: availabilityError.message,
          code: availabilityError.code,
          details: availabilityError.details,
          hint: availabilityError.hint
        });
      }
      
      // Test badge queries
      console.log('\n🏆 Testing badge queries...');
      
      // Test badges table access
      const { data: badgesData, error: badgesError } = await supabase
        .from('badges')
        .select('*')
        .limit(5);
      
      console.log('📊 Badges Table Access:', {
        data: badgesData,
        error: badgesError,
        count: badgesData?.length || 0
      });
      
      // Test user_badges access
      const { data: userBadgesData, error: userBadgesError } = await supabase
        .from('user_badges')
        .select('*')
        .eq('user_id', user.id);
      
      console.log('📊 User Badges Query Result:', {
        data: userBadgesData,
        error: userBadgesError,
        count: userBadgesData?.length || 0
      });
      
      if (userBadgesError) {
        console.error('❌ User badges query error details:', {
          message: userBadgesError.message,
          code: userBadgesError.code,
          details: userBadgesError.details,
          hint: userBadgesError.hint
        });
      }
      
      // Test user profile access
      console.log('\n👤 Testing user profile access...');
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      console.log('📊 User Profile Access:', {
        data: profileData,
        error: profileError
      });
      
      console.log('\n📋 === DEBUG SUMMARY ===');
      console.log('Availability Query Success:', !availabilityError);
      console.log('Badges Table Access Success:', !badgesError);
      console.log('User Badges Query Success:', !userBadgesError);
      console.log('Profile Access Success:', !profileError);
      
      if (availabilityData && availabilityData.length > 0) {
        console.log('\n📅 Sample availability data:', availabilityData[0]);
        console.log('Total availability slots found:', availabilityData.length);
      } else {
        console.log('\n⚠️ No availability data found - this explains the empty calendar');
      }
      
    } catch (error) {
      console.error('💥 Debug session failed:', error);
    }
  }
  
  // Run the debug session
  debugAvailabilityIssue();
  
} else {
  console.error('❌ Supabase client not found. Make sure you are on the GymBuddy website.');
  console.log('💡 Try running this after the page has fully loaded.');
}

// Export debug function for manual testing
window.debugGymBuddy = function() {
  console.log('🔄 Running manual debug session...');
  if (window.supabase) {
    debugAvailabilityIssue();
  } else {
    console.error('❌ Supabase not available');
  }
};