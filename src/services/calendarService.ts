// Google Calendar and Apple Calendar Integration for GymBuddy
import type { GymSession } from '@/types';
import { generateICSFile } from '@/utils/calendarExport';

export interface CalendarConfig {
  googleClientId: string;
  googleClientSecret: string;
  googleApiKey: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description: string;
  startDateTime: string;
  endDateTime: string;
  location: string;
  attendees: Array<{ email: string; displayName?: string }>;
}

class CalendarService {
  private gapi: typeof window.gapi | null = null;
  private isGoogleCalendarReady = false;

  // Get configuration from environment
  getConfig(): CalendarConfig {
    return {
      googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      googleClientSecret: import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '',
      googleApiKey: import.meta.env.VITE_GOOGLE_API_KEY || ''
    };
  }

  // Initialize Google Calendar API
  async initializeGoogleCalendar(): Promise<boolean> {
    const config = this.getConfig();
    
    if (!config.googleClientId || !config.googleApiKey) {
      console.log('Google Calendar credentials not configured');
      return false;
    }

    try {
      // Load Google API script if not already loaded
      if (!window.gapi) {
        await this.loadGoogleAPIScript();
      }

      this.gapi = window.gapi;
      
      await this.gapi!.load('client:auth2', async () => {
        await this.gapi!.client.init({
          apiKey: config.googleApiKey,
          clientId: config.googleClientId,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
          scope: 'https://www.googleapis.com/auth/calendar.events'
        });
      });

      this.isGoogleCalendarReady = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize Google Calendar:', error);
      return false;
    }
  }

  // Load Google API script dynamically
  private loadGoogleAPIScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src*="apis.google.com"]')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google API script'));
      document.head.appendChild(script);
    });
  }

  // Check if user is signed in to Google
  async isGoogleSignedIn(): Promise<boolean> {
    if (!this.isGoogleCalendarReady) {
      await this.initializeGoogleCalendar();
    }

    if (!this.gapi) return false;

    const authInstance = this.gapi.auth2.getAuthInstance();
    return authInstance && authInstance.isSignedIn.get();
  }

  // Sign in to Google Calendar
  async signInToGoogle(): Promise<boolean> {
    if (!this.isGoogleCalendarReady) {
      const initialized = await this.initializeGoogleCalendar();
      if (!initialized) return false;
    }

    try {
      const authInstance = this.gapi!.auth2.getAuthInstance();
      await authInstance.signIn();
      return true;
    } catch (error) {
      console.error('Google sign-in failed:', error);
      return false;
    }
  }

  // Create Google Calendar event
  async createGoogleCalendarEvent(session: GymSession, partnerEmail: string, partnerName: string = 'Partner'): Promise<string | null> {
    try {
      const isSignedIn = await this.isGoogleSignedIn();
      if (!isSignedIn) {
        const signedIn = await this.signInToGoogle();
        if (!signedIn) {
          throw new Error('Google Calendar authentication required');
        }
      }

      const event = this.convertSessionToCalendarEvent(session, partnerEmail, partnerName);
      
      const response = await this.gapi!.client.calendar.events.insert({
        calendarId: 'primary',
        resource: {
          summary: event.summary,
          description: event.description,
          start: {
            dateTime: event.startDateTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          end: {
            dateTime: event.endDateTime,
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
          },
          location: event.location,
          attendees: event.attendees,
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'popup', minutes: 30 },
              { method: 'email', minutes: 60 }
            ]
          }
        }
      });

      return response.result.id;
    } catch (error) {
      console.error('Failed to create Google Calendar event:', error);
      return null;
    }
  }

  // Convert GymSession to CalendarEvent format
  private convertSessionToCalendarEvent(session: GymSession, partnerEmail: string, partnerName: string): CalendarEvent {
    const formatDateTime = (date: Date, hour: number): string => {
      const d = new Date(date);
      d.setHours(hour, 0, 0, 0);
      return d.toISOString();
    };

    return {
      id: session.id,
      summary: `💪 Gym Session with ${partnerName}`,
      description: `GymBuddy workout session

Time: ${this.formatTime(session.startTime)} - ${this.formatTime(session.endTime)}

Don't forget to bring:
• Water bottle
• Gym clothes  
• Good energy!

Created by GymBuddy App`,
      startDateTime: formatDateTime(session.date, session.startTime),
      endDateTime: formatDateTime(session.date, session.endTime),
      location: 'Gym',
      attendees: [{ email: partnerEmail, displayName: partnerName }]
    };
  }

  // Format time for display
  private formatTime(hour: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:00 ${period}`;
  }

  // Create Apple Calendar event (using .ics download)
  async createAppleCalendarEvent(session: GymSession, partnerName: string = 'Partner'): Promise<boolean> {
    try {
      const icsContent = generateICSFile(session, partnerName);
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      
      // For Apple Calendar, we'll trigger a download which can be opened with Calendar app
      const link = document.createElement('a');
      link.href = url;
      link.download = `gym-session-${session.date.toISOString().split('T')[0]}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Failed to create Apple Calendar event:', error);
      return false;
    }
  }

  // Create calendar event in both Google and Apple Calendar
  async createCalendarEvents(session: GymSession, partnerEmail: string, partnerName: string = 'Partner'): Promise<{ google: string | null; apple: boolean }> {
    const results = {
      google: null as string | null,
      apple: false
    };

    // Try Google Calendar first
    try {
      results.google = await this.createGoogleCalendarEvent(session, partnerEmail, partnerName);
    } catch (error) {
      console.error('Google Calendar creation failed:', error);
    }

    // Create Apple Calendar event (ICS download)
    try {
      results.apple = await this.createAppleCalendarEvent(session, partnerName);
    } catch (error) {
      console.error('Apple Calendar creation failed:', error);
    }

    return results;
  }

  // Send calendar invitation via email (fallback method)
  async sendCalendarInvitation(session: GymSession, partnerEmail: string, partnerName: string): Promise<boolean> {
    try {
      // ICS content generation handled in generateICSFile
      // const icsContent = generateICSFile(session, partnerName);
      
      // This would typically integrate with your email service
      // For now, we'll create a mailto link
      const subject = encodeURIComponent(`💪 Gym Session Invitation - ${this.formatTime(session.startTime)}`);
      const body = encodeURIComponent(`Hi ${partnerName}!

You've been invited to a gym session:

📅 Date: ${session.date.toLocaleDateString()}
⏰ Time: ${this.formatTime(session.startTime)} - ${this.formatTime(session.endTime)}
📍 Location: Gym

The calendar event is attached. You can also manually add this to your calendar.

See you at the gym! 💪

- GymBuddy`);

      const mailtoLink = `mailto:${partnerEmail}?subject=${subject}&body=${body}`;
      window.open(mailtoLink);
      
      return true;
    } catch (error) {
      console.error('Failed to send calendar invitation:', error);
      return false;
    }
  }

  // Delete Google Calendar event
  async deleteGoogleCalendarEvent(eventId: string): Promise<boolean> {
    try {
      const isSignedIn = await this.isGoogleSignedIn();
      if (!isSignedIn) return false;

      await this.gapi!.client.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });

      return true;
    } catch (error) {
      console.error('Failed to delete Google Calendar event:', error);
      return false;
    }
  }

  // Check if Google Calendar is available and configured
  isGoogleCalendarAvailable(): boolean {
    const config = this.getConfig();
    return !!(config.googleClientId && config.googleApiKey);
  }

  // Test calendar integration
  async testCalendarIntegration(): Promise<{ google: boolean; apple: boolean; email: boolean }> {
    const results = {
      google: false,
      apple: true, // Apple Calendar works via ICS files (always available)
      email: true  // Email works via mailto (always available)
    };

    // Test Google Calendar
    try {
      if (this.isGoogleCalendarAvailable()) {
        results.google = await this.initializeGoogleCalendar();
      }
    } catch (error) {
      console.error('Google Calendar test failed:', error);
    }

    return results;
  }
}

// Create singleton instance
export const calendarService = new CalendarService();

// Calendar integration templates and helpers
export const CALENDAR_TEMPLATES = {
  WORKOUT_SESSION: (partnerName: string, date: string, time: string) => ({
    title: `💪 Gym Session with ${partnerName}`,
    description: `GymBuddy workout session on ${date} at ${time}. Don't forget your water bottle and gym clothes!`,
    location: 'Gym'
  }),
  
  WORKOUT_REMINDER: (partnerName: string, timeUntil: string) => ({
    title: `🔔 Gym Session Reminder`,
    description: `Your workout with ${partnerName} starts in ${timeUntil}. Time to get ready!`,
    location: 'Gym'
  })
};

// Global calendar integration helpers
declare global {
  interface Window {
    gapi: {
      load: (api: string, callback: () => void) => void;
      client: {
        init: (config: object) => Promise<void>;
        calendar: {
          events: {
            insert: (params: object) => Promise<{ result: { id: string } }>;
            delete: (params: object) => Promise<void>;
          };
        };
      };
      auth2: {
        getAuthInstance: () => {
          isSignedIn: { get: () => boolean };
          signIn: () => Promise<void>;
        };
      };
    };
  }
}