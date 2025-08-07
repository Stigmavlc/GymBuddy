import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';

export function CreateTestUser() {
  const [results, setResults] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const createYoussef = async () => {
    setLoading(true);
    let output = '👥 Creating Youssef Test User...\n\n';

    try {
      // First, try to insert the user directly (this will work if we have service role)
      const youssefUser = {
        id: '331ac976-78f4-4167-8d33-cedf356d2e61',
        email: 'youssef.dummy@test.com',
        name: 'Youssef',
        phone_number: null,
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

      output += '📝 Step 1: Creating Youssef user profile...\n';
      
      // Try to insert user (this might fail due to RLS, that's OK)
      const { error: userError } = await supabase
        .from('users')
        .insert([youssefUser])
        .select();

      if (userError) {
        output += `⚠️  User insert failed (expected): ${userError.message}\n`;
        output += 'This is normal - we need admin privileges to create users\n\n';
      } else {
        output += '✅ User created successfully!\n\n';
      }

      // Now let's add availability data for Youssef
      output += '📅 Step 2: Adding Youssef availability...\n';
      
      const youssefAvailability = [
        { user_id: '331ac976-78f4-4167-8d33-cedf356d2e61', day: 'monday', start_time: 22, end_time: 30 },
        { user_id: '331ac976-78f4-4167-8d33-cedf356d2e61', day: 'wednesday', start_time: 30, end_time: 38 },
        { user_id: '331ac976-78f4-4167-8d33-cedf356d2e61', day: 'saturday', start_time: 16, end_time: 24 }
      ];

      const { data: availData, error: availError } = await supabase
        .from('availability')
        .insert(youssefAvailability)
        .select();

      if (availError) {
        output += `❌ Availability insert failed: ${availError.message}\n\n`;
      } else {
        output += `✅ Added ${availData.length} availability slots for Youssef\n\n`;
      }

      // Verify what we can see now
      output += '🔍 Step 3: Checking results...\n';
      
      const { data: allUsers } = await supabase
        .from('users')
        .select('email, name')
        .in('email', ['ivanaguilarmari@gmail.com', 'youssef.dummy@test.com']);

      output += `Users now visible: ${allUsers?.length || 0}\n`;
      allUsers?.forEach(u => {
        output += `  - ${u.name} (${u.email})\n`;
      });

      const { data: allAvail } = await supabase
        .from('availability')
        .select('user_id, day')
        .in('user_id', ['f8939d4a-c2d3-4c7b-80e2-3a384fc953bd', '331ac976-78f4-4167-8d33-cedf356d2e61']);

      output += `\nAvailability slots: ${allAvail?.length || 0}\n`;

      if (allUsers?.length === 2) {
        output += '\n🎉 SUCCESS! Both users are now visible.\n';
        output += 'You can now run the WhatsApp test at /test-whatsapp\n';
      } else {
        output += '\n⚠️  Still missing Youssef user. Need to use SQL method.\n';
        output += 'Run the SQL from create-youssef-user.sql in Supabase\n';
      }

      setResults(output);

    } catch (error) {
      setResults(`💥 Error: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Create Test User</h1>
        
        <div className="mb-6">
          <Button 
            onClick={createYoussef} 
            disabled={loading}
            className="mb-4"
          >
            {loading ? 'Creating Youssef...' : 'Create Youssef Test User'}
          </Button>
        </div>

        {results && (
          <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap overflow-auto max-h-96">
            {results}
          </div>
        )}
      </div>
    </div>
  );
}