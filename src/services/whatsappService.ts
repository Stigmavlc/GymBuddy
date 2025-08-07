// WhatsApp Integration for GymBuddy
// Automated notifications using Evolution API + n8n + Claude

import { supabase } from '@/lib/supabase';
import type { GymSession } from '@/types';

export interface WhatsAppNotification {
  phoneNumber: string;
  message: string;
  partnerName?: string;
}

export interface WhatsAppConfig {
  evolutionApiUrl: string;
  apiKey: string;
  instanceName: string;
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

class WhatsAppService {
  
  // Get WhatsApp configuration from environment
  getConfig(): WhatsAppConfig {
    return {
      evolutionApiUrl: import.meta.env.VITE_EVOLUTION_API_URL || '',
      apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || '',
      instanceName: import.meta.env.VITE_EVOLUTION_INSTANCE_NAME || 'gymbuddy-coordinator',
      n8nWebhookUrl: import.meta.env.VITE_N8N_WEBHOOK_URL || ''
    };
  }

  // Send WhatsApp message via Evolution API
  async sendMessage(phoneNumber: string, message: string): Promise<boolean> {
    const config = this.getConfig();
    
    // Fallback to WhatsApp Web if Evolution API not configured
    if (!config.evolutionApiUrl || !config.apiKey) {
      console.log('Evolution API not configured, falling back to WhatsApp Web');
      return this.sendMessageViaWeb(phoneNumber, message);
    }

    try {
      const cleanPhone = this.formatPhoneNumber(phoneNumber);
      if (!cleanPhone) {
        console.error('Invalid phone number format');
        return false;
      }

      const response = await fetch(`${config.evolutionApiUrl}/message/sendText/${config.instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey
        },
        body: JSON.stringify({
          number: cleanPhone,
          text: message
        })
      });

      if (!response.ok) {
        throw new Error(`WhatsApp API error: ${response.status}`);
      }

      const result = await response.json();
      console.log('WhatsApp message sent via API:', result);
      return true;
    } catch (error) {
      console.error('Failed to send WhatsApp message via API, falling back to Web:', error);
      return this.sendMessageViaWeb(phoneNumber, message);
    }
  }

  // Fallback: Send WhatsApp message via WhatsApp Web
  sendMessageViaWeb(phoneNumber: string, message: string): boolean {
    try {
      // Clean and format phone number
      const cleanPhone = this.formatPhoneNumber(phoneNumber);
      
      if (!cleanPhone) {
        console.error('Invalid phone number format');
        return false;
      }

      // Create WhatsApp Web URL
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      
      // Open WhatsApp Web in new tab
      window.open(whatsappUrl, '_blank');
      
      return true;
    } catch (error) {
      console.error('Failed to send WhatsApp message:', error);
      return false;
    }
  }

  // Format phone number for WhatsApp Web
  private formatPhoneNumber(phone: string): string | null {
    if (!phone) return null;

    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Handle UK numbers (your number: 07763242583)
    if (cleaned.startsWith('07') && cleaned.length === 11) {
      // Convert UK mobile (07...) to international (+447...)
      cleaned = '44' + cleaned.substring(1);
    }
    // Handle if already in international format without +
    else if (cleaned.startsWith('447') && cleaned.length === 13) {
      // Already correct format
    }
    // Handle international format with country code
    else if (cleaned.length >= 10) {
      // Assume it's already in correct international format
    } else {
      return null; // Invalid format
    }

    return cleaned;
  }

  // Validate phone number format
  validatePhoneNumber(phone: string): boolean {
    const formatted = this.formatPhoneNumber(phone);
    return formatted !== null && formatted.length >= 10;
  }

  // Check if WhatsApp Web is supported
  isAvailable(): boolean {
    // WhatsApp Web works on all modern browsers
    return typeof window !== 'undefined' && 'open' in window;
  }

  // Test WhatsApp notification
  async testWhatsApp(phoneNumber: string): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.validatePhoneNumber(phoneNumber)) {
        return { success: false, error: 'Invalid phone number format' };
      }

      const testMessage = '🏋️‍♂️ GymBuddy Test: Your WhatsApp notifications are working perfectly! 💪\n\nThis is a test message from your GymBuddy app. You\'ll receive these notifications when:\n• Both users set availability\n• Sessions are confirmed\n• Sessions are cancelled\n• Workout reminders\n\nNo more SMS costs - WhatsApp is completely FREE! 🎉';

      const success = await this.sendMessage(phoneNumber, testMessage);
      
      if (success) {
        return { success: true };
      } else {
        return { success: false, error: 'Failed to send WhatsApp message' };
      }
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  // Check if both users have set availability for the current week
  async checkBothUsersAvailability(): Promise<{ bothSet: boolean; users: Array<{ id: string; name: string; phone_number?: string; email: string; hasAvailability?: boolean | null }> }> {
    try {
      const { data: users, error } = await supabase
        .from('users')
        .select('id, name, phone_number, email')
        .in('email', ['ivanaguilarmari@gmail.com', 'youssef.dummy@test.com']);

      if (error) throw error;

      if (!users || users.length !== 2) {
        return { bothSet: false, users: [] };
      }

      // Check if both users have availability set for this week
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const availabilityChecks = await Promise.all(
        users.map(async (user) => {
          const { data: availability } = await supabase
            .from('availability')
            .select('*')
            .eq('user_id', user.id)
            .gte('date', startOfWeek.toISOString())
            .lte('date', endOfWeek.toISOString());

          return {
            ...user,
            hasAvailability: availability && availability.length > 0
          };
        })
      );

      const bothSet = availabilityChecks.every(user => user.hasAvailability);

      return { bothSet, users: availabilityChecks };
    } catch (error) {
      console.error('Error checking availability:', error);
      return { bothSet: false, users: [] };
    }
  }

  // Find common availability slots between users
  async findCommonAvailability(): Promise<AvailabilityMatch | null> {
    try {
      const { data: users } = await supabase
        .from('users')
        .select('id')
        .in('email', ['ivanaguilarmari@gmail.com', 'youssef.dummy@test.com']);

      if (!users || users.length !== 2) return null;

      const [user1Id, user2Id] = users.map(u => u.id);

      // Get this week's availability for both users
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);

      const { data: availability1 } = await supabase
        .from('availability')
        .select('*')
        .eq('user_id', user1Id)
        .gte('date', startOfWeek.toISOString())
        .lte('date', endOfWeek.toISOString());

      const { data: availability2 } = await supabase
        .from('availability')
        .select('*')
        .eq('user_id', user2Id)
        .gte('date', startOfWeek.toISOString())
        .lte('date', endOfWeek.toISOString());

      if (!availability1 || !availability2) return null;

      // Find overlapping time slots
      const commonSlots = [];
      
      for (const slot1 of availability1) {
        for (const slot2 of availability2) {
          if (slot1.date === slot2.date) {
            const startTime = Math.max(slot1.start_time, slot2.start_time);
            const endTime = Math.min(slot1.end_time, slot2.end_time);
            
            if (endTime > startTime) {
              const duration = endTime - startTime;
              if (duration >= 2) { // Minimum 2 hours
                commonSlots.push({
                  date: new Date(slot1.date),
                  startTime,
                  endTime,
                  duration
                });
              }
            }
          }
        }
      }

      // Sort by date
      commonSlots.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Suggest 2 non-consecutive days
      const suggestedSessions = [];
      let lastSelectedDate: Date | null = null;

      for (const slot of commonSlots) {
        if (suggestedSessions.length >= 2) break;
        
        if (!lastSelectedDate || 
            slot.date.getTime() - lastSelectedDate.getTime() > 24 * 60 * 60 * 1000) {
          
          suggestedSessions.push({
            date: slot.date,
            startTime: slot.startTime,
            endTime: Math.min(slot.startTime + 4, slot.endTime), // 2-hour sessions (4 * 30min slots)
            dayName: slot.date.toLocaleDateString('en-US', { weekday: 'long' })
          });
          
          lastSelectedDate = slot.date;
        }
      }

      return {
        commonSlots,
        suggestedSessions
      };
    } catch (error) {
      console.error('Error finding common availability:', error);
      return null;
    }
  }

  // Generate availability notification message
  generateAvailabilityMessage(availability: AvailabilityMatch, userName: string, partnerName?: string): string {
    const { commonSlots, suggestedSessions } = availability;
    const partner = partnerName || 'your gym partner';

    let message = `🏋️ *GymBuddy Coordination Update*\n\n`;
    message += `Hey ${userName}! Both you and ${partner} have set your availability. Here's what we found:\n\n`;

    message += `📅 *Available Time Slots:*\n`;
    commonSlots.forEach(slot => {
      const day = slot.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const startTime = this.formatTime(slot.startTime / 2); // Fix: divide by 2 for correct hour
      const endTime = this.formatTime(slot.endTime / 2);     // Fix: divide by 2 for correct hour
      message += `• ${day}: ${startTime} - ${endTime} (${slot.duration}h)\n`;
    });

    if (suggestedSessions.length > 0) {
      message += `\n💡 *Suggested Sessions:*\n`;
      suggestedSessions.forEach((session, index) => {
        const day = session.date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        const startTime = this.formatTime(session.startTime / 2); // Fix: divide by 2 for correct hour
        const endTime = this.formatTime(session.endTime / 2);     // Fix: divide by 2 for correct hour
        message += `${index + 1}. ${day} ${startTime} - ${endTime}\n`;
      });

      message += `\n✅ *Reply to this chat using natural language to confirm or suggest changes!*\n`;
      message += `The AI assistant that Ivan created will help coordinate the final schedule between you and ${partner}.`;
    } else {
      message += `\n❌ No overlapping slots found for 2+ hour sessions.\n`;
      message += `Please adjust your availability in the GymBuddy app.`;
    }

    return message;
  }

  // Format time from 24h to 12h format
  formatTime(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  }

  // Send availability notification to both users
  async sendAvailabilityNotification(): Promise<boolean> {
    try {
      const { bothSet, users } = await this.checkBothUsersAvailability();
      
      if (!bothSet) {
        console.log('Not both users have set availability yet');
        return false;
      }

      const availability = await this.findCommonAvailability();
      if (!availability) {
        console.log('No common availability found');
        return false;
      }

      // Send notification to both users
      const results = await Promise.all(
        users.map(async (user) => {
          if (!user.phone_number) {
            console.log(`No phone number for user ${user.name}`);
            return false;
          }

          // Find the partner (other user)
          const partner = users.find(u => u.id !== user.id);
          const message = this.generateAvailabilityMessage(availability, user.name, partner?.name);
          return await this.sendMessage(user.phone_number, message);
        })
      );

      // Trigger n8n workflow for Claude conversation handling
      const config = this.getConfig();
      if (config.n8nWebhookUrl) {
        try {
          await fetch(config.n8nWebhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              trigger: 'availability_notification_sent',
              users: users.map(u => ({ 
                id: u.id, 
                name: u.name, 
                phone: u.phone_number 
              })),
              availability
            })
          });
        } catch (error) {
          console.error('Failed to trigger n8n workflow:', error);
        }
      }

      return results.every(result => result);
    } catch (error) {
      console.error('Error sending availability notification:', error);
      return false;
    }
  }

  // Create calendar events when session is confirmed
  async createSessionCalendarEvents(session: GymSession, users: Array<{ id: string; name: string; phone_number?: string; email: string }>): Promise<boolean> {
    try {
      // Import calendar service dynamically to avoid circular imports
      const { calendarService } = await import('@/services/calendarService');
      
      const [user1, user2] = users;
      
      // Create calendar events for both users
      const results = await Promise.all([
        calendarService.createCalendarEvents(
          session,
          user2.email || 'partner@gymbuddy.app',
          user2.name
        ),
        calendarService.createCalendarEvents(
          session,
          user1.email || 'partner@gymbuddy.app', 
          user1.name
        )
      ]);

      const success = results.some(result => result.google || result.apple);
      
      if (success) {
        // Send calendar confirmation messages
        await Promise.all(
          users.map(async (user) => {
            if (user.phone_number) {
              const message = `📅 *Calendar Event Created!*\n\nYour gym session has been added to your calendar! 🎉\n\n✅ Google Calendar: ${results[0].google ? 'Added' : 'Manual setup needed'}\n✅ Apple Calendar: Download the .ics file to add to your calendar\n\n⏰ Don't forget to set your alarm 30 minutes before!\n\n_Sent from GymBuddy_`;
              await this.sendMessage(user.phone_number, message);
            }
          })
        );
      }

      return success;
    } catch (error) {
      console.error('Error creating calendar events:', error);
      return false;
    }
  }

  // Send session confirmation with calendar integration
  async sendSessionConfirmation(session: GymSession, users: Array<{ id: string; name: string; phone_number?: string; email: string }>): Promise<boolean> {
    try {
      const [user1, user2] = users;
      
      // Send confirmation messages
      const confirmationResults = await Promise.all(
        users.map(async (user, index) => {
          if (!user.phone_number) return false;
          
          const partner = index === 0 ? user2 : user1;
          const day = session.date.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          });
          const time = this.formatTime(session.startTime);
          
          const message = WHATSAPP_TEMPLATES.SESSION_CONFIRMED(partner.name, day, time);
          return await this.sendMessage(user.phone_number, message);
        })
      );

      // Create calendar events
      const calendarResult = await this.createSessionCalendarEvents(session, users);
      
      console.log('Session confirmation sent:', confirmationResults.every(r => r));
      console.log('Calendar events created:', calendarResult);
      
      return confirmationResults.every(result => result);
    } catch (error) {
      console.error('Error sending session confirmation:', error);
      return false;
    }
  }
}

// Create singleton instance
export const whatsappService = new WhatsAppService();

// WhatsApp Message Templates for GymBuddy
export const WHATSAPP_TEMPLATES = {
  AVAILABILITY_READY: (partnerName: string) => 
    `🏋️‍♂️ *GymBuddy Alert*\n\nGreat news! Both you and *${partnerName}* have set your availability! 🎉\n\nYou can now find matching workout times and schedule your sessions together.\n\n👉 Open GymBuddy to see your options\n💪 Let's get those gains!\n\n_Sent from GymBuddy - Free WhatsApp notifications_`,

  SESSION_CONFIRMED: (partnerName: string, day: string, time: string) => 
    `💪 *GymBuddy: Session Confirmed!*\n\nYour workout is locked in! 🔥\n\n👥 *Partner:* ${partnerName}\n📅 *Day:* ${day}\n⏰ *Time:* ${time}\n\nSee you at the gym! Let's crush this workout together! 🏋️‍♂️\n\n_Sent from GymBuddy - Free WhatsApp notifications_`,

  SESSION_CANCELLED: (partnerName: string, day: string, time: string) => 
    `❌ *GymBuddy: Session Cancelled*\n\n${partnerName} had to cancel your workout:\n\n📅 *Original Day:* ${day}\n⏰ *Original Time:* ${time}\n\nDon't worry - you can reschedule anytime in the app! 💪\n\n👉 Open GymBuddy to find new times\n\n_Sent from GymBuddy - Free WhatsApp notifications_`,

  SESSION_REMINDER: (partnerName: string, timeUntil: string) => 
    `⏰ *GymBuddy Reminder*\n\nYour workout starts soon! 🔥\n\n👥 *Partner:* ${partnerName}\n⏰ *Starting in:* ${timeUntil}\n\nTime to get pumped! 💪 Grab your gear and head to the gym!\n\n_Sent from GymBuddy - Free WhatsApp notifications_`,

  PARTNER_JOINED: (partnerName: string) => 
    `🎉 *GymBuddy: Your Partner Joined!*\n\n*${partnerName}* just created their GymBuddy account! 🙌\n\nYou can now:\n✅ Set your availability\n✅ Find matching workout times\n✅ Schedule sessions together\n\n👉 Open GymBuddy to get started\n💪 Let's make those fitness goals happen!\n\n_Sent from GymBuddy - Free WhatsApp notifications_`,

  AVAILABILITY_UPDATED: (partnerName: string) => 
    `📅 *GymBuddy: Schedule Updated*\n\n*${partnerName}* just updated their availability! 🔄\n\nThere might be new matching workout times available.\n\n👉 Check GymBuddy for fresh options\n💪 More opportunities to train together!\n\n_Sent from GymBuddy - Free WhatsApp notifications_`
};