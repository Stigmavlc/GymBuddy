// Telegram Integration for GymBuddy
// Automated notifications using Telegram Bot + n8n + Claude

import { supabase } from '@/lib/supabase';
// import type { GymSession } from '@/types';

export interface TelegramNotification {
  chatId: string;
  message: string;
  partnerName?: string;
}

export interface TelegramConfig {
  botUrl: string;
  botUsername: string;
  apiKey: string;
  n8nWebhookUrl: string;
}

export interface AvailabilityMatch {
  commonSlots: Array<{
    date: Date;
    startTime: number;
    endTime: number;
    duration: number;
  }>;
  suggestedSessions: Array<{
    date: Date;
    startTime: number;
    endTime: number;
    dayName: string;
  }>;
}

class TelegramService {
  
  // Get Telegram configuration from environment
  getConfig(): TelegramConfig {
    return {
      botUrl: import.meta.env.VITE_TELEGRAM_BOT_URL || '',
      botUsername: import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '@gymbuddy_bot',
      apiKey: import.meta.env.VITE_TELEGRAM_API_KEY || '',
      n8nWebhookUrl: import.meta.env.VITE_N8N_WEBHOOK_URL || ''
    };
  }

  // Send Telegram message via bot API
  async sendMessage(chatId: string, message: string): Promise<boolean> {
    const config = this.getConfig();
    
    if (!config.botUrl) {
      console.warn('Telegram bot URL not configured. Falling back to web interface.');
      this.openTelegramChat(config.botUsername);
      return false;
    }

    try {
      const response = await fetch(`${config.botUrl}/send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: chatId,
          message: message,
          parse_mode: 'HTML'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ Telegram message sent successfully:', result);
      return true;

    } catch (error) {
      console.error('❌ Failed to send Telegram message:', error);
      // Fallback: open Telegram chat
      this.openTelegramChat(config.botUsername, message);
      return false;
    }
  }

  // Fallback: Open Telegram chat in browser/app
  openTelegramChat(botUsername: string, prefilledMessage?: string): void {
    const message = prefilledMessage ? `?text=${encodeURIComponent(prefilledMessage)}` : '';
    const telegramUrl = `https://t.me/${botUsername.replace('@', '')}${message}`;
    
    console.log('🔄 Opening Telegram chat as fallback:', telegramUrl);
    window.open(telegramUrl, '_blank');
  }

  // Get user's Telegram chat ID (placeholder - would need to be set manually)
  getTelegramChatId(userId: string): string | null {
    // In a real implementation, you'd store chat IDs in your database
    // For now, return null to trigger fallback behavior
    
    // Example mapping (you'd replace this with database lookup):
    const chatIdMappings: Record<string, string> = {
      'ivan': import.meta.env.VITE_IVAN_TELEGRAM_CHAT_ID || '',
      'youssef': import.meta.env.VITE_YOUSSEF_TELEGRAM_CHAT_ID || ''
    };

    return chatIdMappings[userId.toLowerCase()] || null;
  }

  // Check if both users have set their availability recently
  async checkMutualAvailability(): Promise<boolean> {
    try {
      const { data: availabilities, error } = await supabase
        .from('availability')
        .select('user_id, updated_at')
        .gte('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('Error checking availability:', error);
        return false;
      }

      // Check if we have availability from both Ivan and Youssef within the last 24 hours
      const uniqueUsers = new Set(availabilities?.map(a => a.user_id) || []);
      return uniqueUsers.size >= 2;

    } catch (error) {
      console.error('Error in checkMutualAvailability:', error);
      return false;
    }
  }

  // Find overlapping availability slots
  async findAvailabilityMatches(): Promise<AvailabilityMatch> {
    try {
      const { data: availabilities, error } = await supabase
        .from('availability')
        .select('*')
        .gte('date', new Date().toISOString().split('T')[0])
        .order('date', { ascending: true });

      if (error) throw error;

      // Group by date and find overlapping slots
      const availabilityByDate: Record<string, Array<{day: string, start_time: number, end_time: number, date: string}>> = {};
      availabilities?.forEach(slot => {
        const dateKey = slot.date;
        if (!availabilityByDate[dateKey]) {
          availabilityByDate[dateKey] = [];
        }
        availabilityByDate[dateKey].push(slot);
      });

      const commonSlots: Array<{date: Date, startTime: number, endTime: number, duration: number}> = [];
      const suggestedSessions: Array<{date: Date, startTime: number, endTime: number, dayName: string}> = [];

      // Find overlapping time slots for each date
      Object.entries(availabilityByDate).forEach(([dateStr, slots]) => {
        if (slots.length >= 2) { // Both users have availability on this date
          // Find overlapping hours (simplified logic)
          const overlaps = this.findTimeOverlaps(slots);
          overlaps.forEach(overlap => {
            commonSlots.push({
              date: new Date(dateStr),
              startTime: overlap.start,
              endTime: overlap.end,
              duration: overlap.end - overlap.start
            });
          });
        }
      });

      // Generate suggested sessions (prefer 2 non-consecutive days)
      const sortedSlots = commonSlots
        .filter(slot => slot.duration >= 1) // At least 1 hour
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      let lastSelectedDate: Date | null = null;
      for (const slot of sortedSlots) {
        if (suggestedSessions.length >= 2) break;
        
        // Ensure non-consecutive days
        if (!lastSelectedDate || Math.abs(slot.date.getTime() - lastSelectedDate.getTime()) > 24 * 60 * 60 * 1000) {
          suggestedSessions.push({
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            dayName: slot.date.toLocaleDateString('en-US', { weekday: 'long' })
          });
          lastSelectedDate = slot.date;
        }
      }

      return { commonSlots, suggestedSessions };

    } catch (error) {
      console.error('Error finding availability matches:', error);
      return { commonSlots: [], suggestedSessions: [] };
    }
  }

  // Helper function to find time overlaps (simplified)
  private findTimeOverlaps(slots: Array<{day: string, start_time: number, end_time: number}>): Array<{ start: number; end: number }> {
    // This is a simplified version - you might want to implement more sophisticated logic
    const overlaps: Array<{ start: number; end: number }> = [];
    
    for (let i = 0; i < slots.length - 1; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        const slot1 = slots[i];
        const slot2 = slots[j];
        
        // Find overlap between two time ranges
        const start = Math.max(slot1.start_time, slot2.start_time);
        const end = Math.min(slot1.end_time, slot2.end_time);
        
        if (start < end) {
          overlaps.push({ start, end });
        }
      }
    }
    
    return overlaps;
  }

  // Send availability notification to both users
  async sendAvailabilityNotification(): Promise<{ success: boolean; message: string }> {
    try {
      console.log('🔍 Checking for mutual availability...');
      
      const hasMutualAvailability = await this.checkMutualAvailability();
      if (!hasMutualAvailability) {
        return {
          success: false,
          message: 'No mutual availability found. Both users need to set their schedules.'
        };
      }

      const matches = await this.findAvailabilityMatches();
      if (matches.suggestedSessions.length === 0) {
        return {
          success: false,
          message: 'No overlapping time slots found. Please adjust your availability.'
        };
      }

      // Create notification message
      const suggestions = matches.suggestedSessions
        .map(session => 
          `🗓️ <b>${session.dayName}</b> (${session.date.toLocaleDateString()}) at ${session.startTime}:00-${session.endTime}:00`
        )
        .join('\\n');

      const message = `🏋️ <b>GymBuddy Schedule Coordination</b>

Both of you have set your availability! Here are the optimal workout times:

${suggestions}

The AI coordinator is ready to help you finalize these sessions. Just message the bot with any questions or to confirm!

💪 Ready to crush those workouts together?`;

      // Send notifications
      const config = this.getConfig();
      let sentCount = 0;

      // Try to send to Ivan
      const ivanChatId = this.getTelegramChatId('ivan');
      if (ivanChatId) {
        const ivanSuccess = await this.sendMessage(ivanChatId, message);
        if (ivanSuccess) sentCount++;
      } else {
        console.log('💬 Opening Telegram for Ivan (no chat ID configured)');
        this.openTelegramChat(config.botUsername, message.replace(/<[^>]*>/g, ''));
      }

      // Try to send to Youssef
      const youssefChatId = this.getTelegramChatId('youssef');
      if (youssefChatId) {
        const youssefSuccess = await this.sendMessage(youssefChatId, message);
        if (youssefSuccess) sentCount++;
      } else {
        console.log('💬 Opening Telegram for Youssef (no chat ID configured)');
        this.openTelegramChat(config.botUsername, message.replace(/<[^>]*>/g, ''));
      }

      // Trigger n8n workflow for Claude coordination
      if (config.n8nWebhookUrl) {
        try {
          await fetch(config.n8nWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              event: 'availability_notification_sent',
              matches: matches,
              timestamp: new Date().toISOString(),
              platform: 'telegram'
            })
          });
          console.log('🔔 n8n workflow triggered for coordination');
        } catch (error) {
          console.error('Failed to trigger n8n workflow:', error);
        }
      }

      return {
        success: true,
        message: sentCount > 0 
          ? `✅ Telegram notifications sent to ${sentCount} user(s)!`
          : '✅ Telegram chats opened for manual coordination!'
      };

    } catch (error) {
      console.error('❌ Error sending availability notification:', error);
      return {
        success: false,
        message: 'Failed to send notification. Please try again.'
      };
    }
  }

  // Test Telegram integration
  async testTelegram(): Promise<{ success: boolean; message: string }> {
    const config = this.getConfig();
    
    if (!config.botUrl) {
      this.openTelegramChat(config.botUsername, '🧪 Testing GymBuddy Telegram integration!');
      return {
        success: true,
        message: '🔄 Telegram chat opened for manual testing (bot URL not configured)'
      };
    }

    try {
      // Test bot status
      const response = await fetch(`${config.botUrl}/`);
      if (!response.ok) {
        throw new Error(`Bot not responding: ${response.status}`);
      }

      const status = await response.json();
      console.log('🤖 Telegram bot status:', status);

      return {
        success: true,
        message: `✅ Telegram bot is working! Status: ${status.status || 'Active'}`
      };

    } catch (error) {
      console.error('❌ Telegram test failed:', error);
      return {
        success: false,
        message: 'Telegram bot is not responding. Please check deployment.'
      };
    }
  }
}

// Export singleton instance
export const telegramService = new TelegramService();
export default telegramService;