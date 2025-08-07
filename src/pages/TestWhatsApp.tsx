import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { whatsappService } from '@/services/whatsappService';

export function TestWhatsApp() {
  const [results, setResults] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const runTest = async () => {
    setLoading(true);
    setResults('🧪 Testing WhatsApp Logic (Option B) - No actual messages sent\n\n');

    try {
      // Step 1: Check both users availability
      const availabilityCheck = await whatsappService.checkBothUsersAvailability();
      
      let output = '📋 Step 1: Checking if both users have availability...\n';
      output += `✅ Both set: ${availabilityCheck.bothSet}\n`;
      output += `📊 Users found: ${availabilityCheck.users.length}\n\n`;
      
      availabilityCheck.users.forEach(user => {
        output += `  - ${user.name} (${user.email}): ${user.hasAvailability ? '✅' : '❌'} availability, Phone: ${user.phone_number || 'Not set'}\n`;
      });

      if (!availabilityCheck.bothSet) {
        output += '\n❌ Test stopped: Not both users have availability\n';
        setResults(output);
        setLoading(false);
        return;
      }

      // Step 2: Find common availability
      output += '\n🔍 Step 2: Finding common availability...\n';
      const commonAvailability = await whatsappService.findCommonAvailability();
      
      if (!commonAvailability) {
        output += '❌ No common availability found\n';
        setResults(output);
        setLoading(false);
        return;
      }

      output += `✅ Common slots found: ${commonAvailability.commonSlots.length}\n`;
      output += `💡 Suggested sessions: ${commonAvailability.suggestedSessions.length}\n\n`;

      commonAvailability.commonSlots.forEach(slot => {
        const day = new Date(slot.date).toLocaleDateString('en-US', { weekday: 'long' });
        const startTime = whatsappService.formatTime(slot.startTime / 2);
        const endTime = whatsappService.formatTime(slot.endTime / 2);
        output += `  - ${day}: ${startTime} - ${endTime} (${slot.duration}h)\n`;
      });

      output += '\n💡 Suggested sessions:\n';
      commonAvailability.suggestedSessions.forEach((session, index) => {
        const startTime = whatsappService.formatTime(session.startTime / 2);
        const endTime = whatsappService.formatTime(session.endTime / 2);
        output += `  ${index + 1}. ${session.dayName}: ${startTime} - ${endTime}\n`;
      });

      // Step 3: Generate messages
      output += '\n📱 Step 3: WhatsApp messages that would be sent:\n\n';
      
      availabilityCheck.users.forEach(user => {
        if (user.phone_number) {
          const partner = availabilityCheck.users.find(u => u.id !== user.id);
          output += `📨 Message for ${user.name} (${user.phone_number}):\n`;
          output += '━'.repeat(60) + '\n';
          const message = whatsappService.generateAvailabilityMessage(commonAvailability, user.name, partner?.name);
          output += message + '\n';
          output += '━'.repeat(60) + '\n\n';
        } else {
          output += `📨 ${user.name}: No phone number set (test account)\n\n`;
        }
      });

      output += '🎉 Test completed successfully!\n';
      output += '✅ The WhatsApp notification system is working correctly\n';
      output += '📱 For live testing, deploy the Heroku Evolution API app\n';

      setResults(output);

    } catch (error) {
      setResults(`💥 Test failed: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">WhatsApp Logic Test</h1>
        
        <div className="mb-6">
          <Button 
            onClick={runTest} 
            disabled={loading}
            className="mb-4"
          >
            {loading ? 'Testing...' : 'Run WhatsApp Logic Test'}
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