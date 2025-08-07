// Setup script to create test users for GymBuddy WhatsApp testing
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://cikoqlryskuczwtfkprq.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNpa29xbHJ5c2t1Y3p3dGVrcHJxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzM3MjA4NywiZXhwIjoyMDY4OTQ4MDg3fQ.YourServiceRoleKeyHere'; // You'll need to provide this

// Create Supabase client with service role (to bypass RLS)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const users = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001', // Generate UUID for Ivan
    email: 'ivanaguilarmari@gmail.com',
    name: 'Ivan Aguilar',
    phone_number: '+447763242583',
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
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002', // Generate UUID for Youssef
    email: 'youssef.dummy@test.com',
    name: 'Youssef (Test)',
    phone_number: '+447123456789',
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
  }
];

async function setupTestUsers() {
  console.log('🚀 Setting up test users for GymBuddy WhatsApp testing...');
  
  try {
    // Insert users
    const { data, error } = await supabase
      .from('users')
      .insert(users)
      .select();

    if (error) {
      console.error('❌ Error creating users:', error);
      return;
    }

    console.log('✅ Successfully created test users:');
    data.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ${user.phone_number}`);
    });

    console.log('\n📱 Ready for WhatsApp testing!');
    console.log('Next steps:');
    console.log('1. Both users can now log in to the app');
    console.log('2. Set availability for both users');
    console.log('3. WhatsApp notifications will be sent automatically');
    
  } catch (error) {
    console.error('💥 Setup failed:', error);
  }
}

setupTestUsers();