import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';

export function DiagnosticTest() {
  const { user, profile } = useAuth();
  const [results, setResults] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    let output = '🔍 GymBuddy Diagnostic Test\n\n';

    try {
      // Step 1: Check current user
      output += '👤 Step 1: Current Authentication\n';
      output += `Auth User ID: ${user?.id || 'Not logged in'}\n`;
      output += `Auth Email: ${user?.email || 'N/A'}\n`;
      output += `Profile exists: ${profile ? 'Yes' : 'No'}\n`;
      if (profile) {
        output += `Profile Name: ${profile.name}\n`;
        output += `Profile Phone: ${profile.phone_number || 'Not set'}\n`;
      }

      // Step 2: Check users table
      output += '\n👥 Step 2: Users Table\n';
      const { data: allUsers, error: usersError } = await supabase
        .from('users')
        .select('id, email, name, phone_number');

      if (usersError) {
        output += `❌ Error reading users: ${usersError.message}\n`;
      } else {
        output += `Users found: ${allUsers?.length || 0}\n`;
        allUsers?.forEach(u => {
          output += `  - ${u.name} (${u.email}) - Phone: ${u.phone_number || 'Not set'}\n`;
        });
      }

      // Step 3: Check availability table
      output += '\n📅 Step 3: Availability Table\n';
      const { data: allAvailability, error: availError } = await supabase
        .from('availability')
        .select('user_id, day, start_time, end_time');

      if (availError) {
        output += `❌ Error reading availability: ${availError.message}\n`;
      } else {
        output += `Availability slots found: ${allAvailability?.length || 0}\n`;
        allAvailability?.forEach(a => {
          output += `  - User ${a.user_id.substring(0, 8)}...: ${a.day} ${a.start_time/2}:00-${a.end_time/2}:00\n`;
        });
      }

      // Step 4: Check current user's availability
      if (user) {
        output += '\n🎯 Step 4: Current User\'s Availability\n';
        const { data: myAvailability, error: myAvailError } = await supabase
          .from('availability')
          .select('day, start_time, end_time')
          .eq('user_id', user.id);

        if (myAvailError) {
          output += `❌ Error reading my availability: ${myAvailError.message}\n`;
        } else {
          output += `My availability slots: ${myAvailability?.length || 0}\n`;
          myAvailability?.forEach(a => {
            output += `  - ${a.day}: ${a.start_time/2}:00-${a.end_time/2}:00\n`;
          });
        }
      }

      // Step 5: Check specific emails
      output += '\n📧 Step 5: Target Users Check\n';
      const { data: targetUsers, error: targetError } = await supabase
        .from('users')
        .select('id, email, name, phone_number')
        .in('email', ['ivanaguilarmari@gmail.com', 'youssef.dummy@test.com']);

      if (targetError) {
        output += `❌ Error finding target users: ${targetError.message}\n`;
      } else {
        output += `Target users found: ${targetUsers?.length || 0}\n`;
        targetUsers?.forEach(u => {
          output += `  - ${u.name} (${u.email}) - ${u.id}\n`;
        });
      }

      output += '\n🎯 Diagnosis:\n';
      if (!profile) {
        output += '❌ User profile missing - need to create profile in users table\n';
      }
      if (allUsers?.length === 0) {
        output += '❌ No users in users table - RLS or data issue\n';
      }
      if (allAvailability?.length === 0) {
        output += '❌ No availability data found - RLS or data issue\n';
      }

      setResults(output);

    } catch (error) {
      setResults(`💥 Diagnostic failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">GymBuddy Diagnostic</h1>
        
        <div className="mb-6">
          <Button 
            onClick={runDiagnostic} 
            disabled={loading}
            className="mb-4"
          >
            {loading ? 'Running Diagnostic...' : 'Run Diagnostic Test'}
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